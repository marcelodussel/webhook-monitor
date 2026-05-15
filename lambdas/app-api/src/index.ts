import {
  BatchWriteItemCommand,
  ConditionalCheckFailedException,
  DynamoDBClient,
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { DeleteObjectsCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { log } from "./logger.js";
import crypto from "node:crypto";
import { Readable } from "node:stream";

const EVENTS_TABLE = process.env.EVENTS_TABLE ?? "";
const ENDPOINTS_TABLE = process.env.ENDPOINTS_TABLE ?? "";
const PAYLOADS_BUCKET = process.env.PAYLOADS_BUCKET ?? "";
const APP_API_KEY = process.env.APP_API_KEY ?? "";
const INGEST_BASE_URL = process.env.INGEST_BASE_URL ?? "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
const AI_USAGE_TABLE = process.env.AI_USAGE_TABLE ?? "";
const AI_EXPLAIN_MAX_PER_DAY_RAW = process.env.AI_EXPLAIN_MAX_PER_DAY ?? "";
const REPLAY_ALLOWED_HOSTS = process.env.REPLAY_ALLOWED_HOSTS ?? "";

const ddb = new DynamoDBClient({});
const s3 = new S3Client({});

const REPLAY_STRIP_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-forwarded-host",
  "x-amzn-trace-id",
  "x-amz-cf-id",
  "x-amz-request-id",
]);

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function getHeader(event: APIGatewayProxyEventV2, name: string): string | undefined {
  const headers = event.headers ?? {};
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target && v != null) return String(v);
  }
  return undefined;
}

function requireApiKey(event: APIGatewayProxyEventV2): APIGatewayProxyResultV2 | null {
  if (!APP_API_KEY) return json(500, { error: "Server misconfiguration" });
  const provided = getHeader(event, "x-api-key");
  if (!provided || provided !== APP_API_KEY) return json(401, { error: "Unauthorized" });
  return null;
}

async function readJsonBody<T>(event: APIGatewayProxyEventV2): Promise<T | null> {
  if (!event.body) return null;
  const buf = Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8");
  try {
    return JSON.parse(buf.toString("utf8")) as T;
  } catch {
    return null;
  }
}

function looksTextual(contentType: string | undefined): boolean {
  if (!contentType) return true;
  const ct = contentType.toLowerCase();
  if (ct.startsWith("text/")) return true;
  if (ct.includes("json")) return true;
  if (ct.includes("xml")) return true;
  if (ct.includes("x-www-form-urlencoded")) return true;
  return false;
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === "string") return Buffer.from(body);

  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  // In AWS SDK v3 in Lambda, Body is typically a Readable stream; fallback just in case.
  return Buffer.from(String(body));
}

function parseLimit(raw: string | undefined, fallback: number): number {
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(200, Math.floor(n)));
}

function buildIngestUrl(endpointId: string): string {
  if (INGEST_BASE_URL) return `${INGEST_BASE_URL}/${endpointId}`;
  return endpointId;
}

function buildIngestUrlWithToken(input: { endpointId: string; ingestToken?: string }): string {
  const base = buildIngestUrl(input.endpointId);
  if (!input.ingestToken) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}token=${encodeURIComponent(input.ingestToken)}`;
}

function normalizeStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== undefined && v !== null) out[k.toLowerCase()] = String(v);
  }
  return out;
}

function buildForwardHeaders(stored: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(stored)) {
    const lk = k.toLowerCase();
    if (REPLAY_STRIP_HEADERS.has(lk)) continue;
    if (lk === "content-type" || lk.startsWith("x-")) out[lk] = v;
  }
  return out;
}

function parseHttpDestination(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;

    // Disallow non-standard ports for demo safety.
    if (url.port && url.port !== "80" && url.port !== "443") return null;

    const host = url.hostname.toLowerCase();
    if (isForbiddenReplayHost(host)) return null;

    const allowedHosts = parseAllowedHosts(REPLAY_ALLOWED_HOSTS);
    if (allowedHosts.length > 0 && !isHostAllowed(host, allowedHosts)) return null;

    return url.toString();
  } catch {
    return null;
  }
}

function parseAllowedHosts(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isHostAllowed(host: string, allowed: string[]): boolean {
  for (const rule of allowed) {
    if (rule === host) return true;
    // Suffix match for subdomains: allow "example.com" to match "*.example.com".
    if (host.endsWith(`.${rule}`)) return true;
  }
  return false;
}

function isForbiddenReplayHost(host: string): boolean {
  if (!host) return true;
  if (host === "localhost") return true;
  if (host.endsWith(".localhost")) return true;

  // Block common internal DNS suffixes for demo safety.
  if (host.endsWith(".local")) return true;
  if (host.endsWith(".internal")) return true;

  if (isIpv4Literal(host)) return isPrivateIpv4(host);
  if (isIpv6Literal(host)) return isPrivateIpv6(host);
  return false;
}

function isIpv4Literal(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return false;
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return false;
  }
  return true;
}

function isPrivateIpv4(host: string): boolean {
  const [a, b] = host.split(".").map((p) => Number(p));

  // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8
  if (a === 0 || a === 10 || a === 127) return true;

  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  return false;
}

function isIpv6Literal(host: string): boolean {
  // URL.hostname returns IPv6 without brackets in most runtimes; be defensive.
  const h = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  return /^[0-9a-f:]+$/i.test(h) && h.includes(":");
}

function isPrivateIpv6(host: string): boolean {
  const h = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  const lower = h.toLowerCase();

  // loopback
  if (lower === "::1") return true;

  // Unique local addresses fc00::/7
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;

  // Link-local fe80::/10
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb"))
    return true;

  return false;
}

function redactHeadersForAi(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const lk = k.toLowerCase();
    if (lk === "authorization") continue;
    if (lk === "cookie" || lk === "set-cookie") continue;
    if (lk.includes("signature")) continue;
    if (lk.includes("hmac")) continue;
    if (lk.includes("secret")) continue;
    out[lk] = v;
  }
  return out;
}

function truncateBytesUtf8(input: string, maxBytes: number): string {
  const buf = Buffer.from(input, "utf8");
  if (buf.byteLength <= maxBytes) return input;
  return buf.subarray(0, maxBytes).toString("utf8");
}

function parseAiExplainMaxPerDay(raw: string): number {
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return 100;
  return Math.max(1, Math.min(100_000, Math.floor(n)));
}

/** Epoch seconds for DynamoDB TTL: end of UTC calendar day for `utcDateYmd` plus 36h buffer. */
function usageItemTtlEpochSeconds(utcDateYmd: string): number {
  const parts = utcDateYmd.split("-");
  if (parts.length !== 3) return Math.floor(Date.now() / 1000) + 86400 * 3;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return Math.floor(Date.now() / 1000) + 86400 * 3;
  }
  return Math.floor(Date.UTC(y, m - 1, d + 1) / 1000) + 36 * 3600;
}

type ReserveAiExplainResult = "ok" | "limit" | "misconfig";

async function reserveAiExplainSlot(): Promise<ReserveAiExplainResult> {
  const table = AI_USAGE_TABLE.trim();
  const max = parseAiExplainMaxPerDay(AI_EXPLAIN_MAX_PER_DAY_RAW);
  if (!table || max < 1) return "misconfig";

  const utcDate = new Date().toISOString().slice(0, 10);
  const pk = `explainDay#${utcDate}`;
  const ttl = usageItemTtlEpochSeconds(utcDate);

  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: pk } },
        UpdateExpression: "ADD explainCount :one SET #ttl = :ttl",
        ExpressionAttributeNames: { "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":one": { N: "1" },
          ":ttl": { N: String(ttl) },
          ":max": { N: String(max) },
        },
        ConditionExpression: "attribute_not_exists(explainCount) OR explainCount < :max",
      }),
    );
    return "ok";
  } catch (err: unknown) {
    if (err instanceof ConditionalCheckFailedException) return "limit";
    throw err;
  }
}

async function geminiExplain(input: {
  eventId: string;
  endpointId: string;
  method: string;
  contentType?: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  bodyText: string;
  status: string;
  lastError?: string;
}): Promise<string> {
  const apiKey = GEMINI_API_KEY.trim();
  if (!apiKey) {
    return "AI explain is not configured (set GEMINI_API_KEY / Google AI Studio API key on the app API).";
  }

  const model = GEMINI_MODEL.trim() || "gemini-2.0-flash";
  const prompt = {
    eventId: input.eventId,
    endpointId: input.endpointId,
    method: input.method,
    contentType: input.contentType ?? "",
    status: input.status,
    lastError: input.lastError ?? "",
    headers: redactHeadersForAi(input.headers),
    query: input.query,
    body: truncateBytesUtf8(input.bodyText, 32_000),
  };

  const systemText =
    "You are an expert webhook debugging assistant. Provide concise, practical bullets. Never include secrets; assume payload may be sensitive.";
  const userInstructions =
    "Explain this webhook event: summarize what it is, highlight likely integration issues, and suggest the next 2-3 debugging steps. If body is JSON, give a short field-by-field summary of the top-level keys.";
  const userPayload = JSON.stringify(prompt);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [
        {
          role: "user",
          parts: [{ text: `${userInstructions}\n\n${userPayload}` }],
        },
      ],
      generationConfig: { temperature: 0.2 },
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    return `AI explain failed (HTTP ${res.status}).`;
  }

  try {
    const data = JSON.parse(text) as {
      promptFeedback?: { blockReason?: string };
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const block = data.promptFeedback?.blockReason;
    if (block) {
      return `AI explain was blocked (${block}). Try a smaller or less sensitive payload preview.`;
    }
    const parts = data.candidates?.[0]?.content?.parts;
    if (parts?.length) {
      const combined = parts
        .map((p) => (typeof p.text === "string" ? p.text : ""))
        .join("")
        .trim();
      if (combined) return combined;
    }
  } catch {
    // ignore
  }

  return "AI explain returned an unexpected response.";
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const start = Date.now();

  const authErr = requireApiKey(event);
  if (authErr) return authErr;

  if (!EVENTS_TABLE || !ENDPOINTS_TABLE || !PAYLOADS_BUCKET) {
    return json(500, { error: "Server misconfiguration" });
  }

  const method = event.requestContext.http.method.toUpperCase();
  const path = event.rawPath ?? "";

  try {
    // GET /api/endpoints
    if (method === "GET" && path === "/api/endpoints") {
      const res = await ddb.send(new ScanCommand({ TableName: ENDPOINTS_TABLE }));
      const endpoints =
        res.Items?.map((it) => {
          const v = unmarshall(it) as Record<string, unknown>;
          return {
            id: String(v.id ?? ""),
            name: String(v.name ?? ""),
            createdAt: String(v.createdAt ?? ""),
            defaultDestinationUrl:
              v.defaultDestinationUrl != null && String(v.defaultDestinationUrl).trim()
                ? String(v.defaultDestinationUrl)
                : undefined,
            ingestToken:
              v.ingestToken != null && String(v.ingestToken).trim() ? String(v.ingestToken) : undefined,
          };
        }).filter((e) => e.id && e.name && e.createdAt) ?? [];

      endpoints.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      return json(200, { endpoints });
    }

    // POST /api/endpoints
    if (method === "POST" && path === "/api/endpoints") {
      const input = await readJsonBody<{ name?: string; defaultDestinationUrl?: string }>(event);
      const name = input?.name?.trim();
      if (!name) return json(400, { error: "Missing field name" });

      const endpoint = {
        id: crypto.randomUUID(),
        name,
        createdAt: new Date().toISOString(),
        defaultDestinationUrl: input?.defaultDestinationUrl?.trim() || undefined,
        ingestToken: crypto.randomUUID(),
      };

      await ddb.send(
        new PutItemCommand({
          TableName: ENDPOINTS_TABLE,
          Item: marshall(endpoint, { removeUndefinedValues: true }),
          ConditionExpression: "attribute_not_exists(#id)",
          ExpressionAttributeNames: { "#id": "id" },
        }),
      );

      return json(200, { endpoint, ingestUrl: buildIngestUrlWithToken({ endpointId: endpoint.id, ingestToken: endpoint.ingestToken }) });
    }

    // DELETE /api/endpoints/{endpointId}
    if (method === "DELETE" && path.startsWith("/api/endpoints/") && !path.endsWith("/events")) {
      const endpointId = event.pathParameters?.endpointId?.trim();
      if (!endpointId) return json(400, { error: "Missing path parameter endpointId" });

      const exists = await ddb.send(
        new GetItemCommand({
          TableName: ENDPOINTS_TABLE,
          Key: { id: { S: endpointId } },
          ProjectionExpression: "id",
        }),
      );
      if (!exists.Item) return json(404, { error: "Unknown endpoint" });

      let exclusiveStartKey: Record<string, AttributeValue> | undefined;
      for (;;) {
        const q = await ddb.send(
          new QueryCommand({
            TableName: EVENTS_TABLE,
            KeyConditionExpression: "endpointId = :e",
            ExpressionAttributeValues: { ":e": { S: endpointId } },
            ExclusiveStartKey: exclusiveStartKey,
          }),
        );
        const pageItems = q.Items ?? [];
        exclusiveStartKey = q.LastEvaluatedKey;

        const rows: { sk: string; payloadS3Key?: string }[] = [];
        for (const it of pageItems) {
          const v = unmarshall(it) as Record<string, unknown>;
          const sk = String(v.sk ?? "");
          if (!sk) continue;
          rows.push({
            sk,
            payloadS3Key:
              v.payloadS3Key != null && String(v.payloadS3Key).trim()
                ? String(v.payloadS3Key)
                : undefined,
          });
        }

        const s3Keys = [...new Set(rows.map((r) => r.payloadS3Key).filter(Boolean) as string[])];
        if (s3Keys.length > 0) {
          for (let i = 0; i < s3Keys.length; i += 1000) {
            const chunk = s3Keys.slice(i, i + 1000);
            const delRes = await s3.send(
              new DeleteObjectsCommand({
                Bucket: PAYLOADS_BUCKET,
                Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
              }),
            );
            if (delRes.Errors?.length) {
              log({ level: "warn", msg: "delete_endpoint_s3_errors", endpointId, errors: delRes.Errors });
            }
          }
        }

        if (rows.length > 0) {
          for (let i = 0; i < rows.length; i += 25) {
            const chunk = rows.slice(i, i + 25);
            let unprocessed =
              (
                await ddb.send(
                  new BatchWriteItemCommand({
                    RequestItems: {
                      [EVENTS_TABLE]: chunk.map((r) => ({
                        DeleteRequest: {
                          Key: { endpointId: { S: endpointId }, sk: { S: r.sk } },
                        },
                      })),
                    },
                  }),
                )
              ).UnprocessedItems?.[EVENTS_TABLE] ?? [];
            let guard = 0;
            while (unprocessed.length && guard < 10) {
              guard += 1;
              await new Promise((r) => setTimeout(r, 50 * guard));
              unprocessed =
                (
                  await ddb.send(
                    new BatchWriteItemCommand({
                      RequestItems: { [EVENTS_TABLE]: unprocessed },
                    }),
                  )
                ).UnprocessedItems?.[EVENTS_TABLE] ?? [];
            }
            if (unprocessed.length) {
              return json(500, { error: "Failed to delete some events; try again" });
            }
          }
        }

        if (!exclusiveStartKey) break;
      }

      await ddb.send(
        new DeleteItemCommand({
          TableName: ENDPOINTS_TABLE,
          Key: { id: { S: endpointId } },
        }),
      );

      log({ level: "info", msg: "delete_endpoint", endpointId, durationMs: Date.now() - start });
      return json(200, { ok: true });
    }

    // GET /api/endpoints/{endpointId}/events?limit=50
    if (method === "GET" && path.startsWith("/api/endpoints/") && path.endsWith("/events")) {
      const endpointId = event.pathParameters?.endpointId?.trim();
      if (!endpointId) return json(400, { error: "Missing path parameter endpointId" });

      const limit = parseLimit(event.queryStringParameters?.limit, 50);
      const res = await ddb.send(
        new QueryCommand({
          TableName: EVENTS_TABLE,
          KeyConditionExpression: "endpointId = :e",
          ExpressionAttributeValues: { ":e": { S: endpointId } },
          ScanIndexForward: false,
          Limit: limit,
        }),
      );

      const events =
        res.Items?.map((it) => {
          const v = unmarshall(it) as Record<string, unknown>;
          return {
            id: String(v.eventId ?? ""),
            endpointId: String(v.endpointId ?? ""),
            receivedAt: String(v.receivedAt ?? ""),
            method: String(v.method ?? ""),
            path: v.path != null ? String(v.path) : undefined,
            headers: (v.headers as Record<string, string> | undefined) ?? {},
            query: (v.query as Record<string, string> | undefined) ?? {},
            bodyPreview: String(v.bodyPreview ?? ""),
            payloadS3Key: v.payloadS3Key != null ? String(v.payloadS3Key) : undefined,
            status: String(v.status ?? "received"),
            sourceIp: v.sourceIp != null ? String(v.sourceIp) : undefined,
            destinationUrl: v.destinationUrl != null ? String(v.destinationUrl) : undefined,
            replayCount: Number(v.replayCount ?? 0) || 0,
            lastError: v.lastError != null ? String(v.lastError) : undefined,
          };
        }).filter((e) => e.id && e.endpointId && e.receivedAt) ?? [];

      return json(200, { events });
    }

    // POST /api/events/{eventId}/replay
    if (method === "POST" && path.startsWith("/api/events/") && path.endsWith("/replay")) {
      const eventId = event.pathParameters?.eventId?.trim();
      if (!eventId) return json(400, { error: "Missing path parameter eventId" });

      const res = await ddb.send(
        new QueryCommand({
          TableName: EVENTS_TABLE,
          IndexName: "EventIdIndex",
          KeyConditionExpression: "eventId = :id",
          ExpressionAttributeValues: { ":id": { S: eventId } },
          Limit: 1,
        }),
      );

      const item = res.Items?.[0];
      if (!item) return json(404, { error: "Not found" });

      const v = unmarshall(item) as Record<string, unknown>;
      const endpointId = String(v.endpointId ?? "");
      const sk = String(v.sk ?? "");
      const payloadS3Key = v.payloadS3Key != null ? String(v.payloadS3Key) : "";
      if (!endpointId || !sk || !payloadS3Key) {
        return json(404, { error: "Not found" });
      }

      const input = await readJsonBody<{ destinationUrl?: string }>(event);
      let destinationUrl = parseHttpDestination(input?.destinationUrl);

      if (!destinationUrl) {
        const endpointRes = await ddb.send(
          new GetItemCommand({
            TableName: ENDPOINTS_TABLE,
            Key: { id: { S: endpointId } },
            ProjectionExpression: "defaultDestinationUrl",
          }),
        );
        const endpoint = endpointRes.Item ? (unmarshall(endpointRes.Item) as Record<string, unknown>) : {};
        destinationUrl = parseHttpDestination(
          endpoint.defaultDestinationUrl != null ? String(endpoint.defaultDestinationUrl) : undefined,
        );
      }

      if (!destinationUrl) return json(400, { error: "Missing or invalid destinationUrl" });

      const obj = await s3.send(
        new GetObjectCommand({
          Bucket: PAYLOADS_BUCKET,
          Key: payloadS3Key,
        }),
      );
      const bodyBuf = await streamToBuffer(obj.Body);
      const replayHeaders = buildForwardHeaders(normalizeStringRecord(v.headers));

      let ok = false;
      let statusCode = 0;
      let lastError: string | undefined;

      try {
        const replayRes = await fetch(destinationUrl, {
          method: "POST",
          headers: replayHeaders,
          body: bodyBuf as unknown as BodyInit,
        });
        ok = replayRes.ok;
        statusCode = replayRes.status;
        if (!ok) lastError = `HTTP ${statusCode}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }

      const storedLastError = lastError || "Replay failed";
      const updateRes = await ddb.send(
        new UpdateItemCommand({
          TableName: EVENTS_TABLE,
          Key: {
            endpointId: { S: endpointId },
            sk: { S: sk },
          },
          UpdateExpression: ok
            ? "SET #status = :status, replayCount = if_not_exists(replayCount, :zero) + :one, destinationUrl = :destination REMOVE lastError"
            : "SET #status = :status, replayCount = if_not_exists(replayCount, :zero) + :one, destinationUrl = :destination, lastError = :lastError",
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":status": { S: ok ? "replayed" : "failed" },
            ":zero": { N: "0" },
            ":one": { N: "1" },
            ":destination": { S: destinationUrl },
            ...(!ok ? { ":lastError": { S: storedLastError } } : {}),
          },
          ReturnValues: "UPDATED_NEW",
        }),
      );

      const replayCount = Number(updateRes.Attributes?.replayCount?.N ?? v.replayCount ?? 0) || 0;
      const durationMs = Date.now() - start;
      log({
        level: ok ? "info" : "warn",
        msg: "replay",
        eventId,
        endpointId,
        ok,
        statusCode,
        durationMs,
        error: ok ? undefined : storedLastError,
      });

      return json(200, { ok, statusCode, replayCount });
    }

    // POST /api/events/{eventId}/explain
    if (method === "POST" && path.startsWith("/api/events/") && path.endsWith("/explain")) {
      const eventId = event.pathParameters?.eventId?.trim();
      if (!eventId) return json(400, { error: "Missing path parameter eventId" });

      const res = await ddb.send(
        new QueryCommand({
          TableName: EVENTS_TABLE,
          IndexName: "EventIdIndex",
          KeyConditionExpression: "eventId = :id",
          ExpressionAttributeValues: { ":id": { S: eventId } },
          Limit: 1,
        }),
      );

      const item = res.Items?.[0];
      if (!item) return json(404, { error: "Not found" });

      const v = unmarshall(item) as Record<string, unknown>;
      const endpointId = String(v.endpointId ?? "");
      const payloadS3Key = v.payloadS3Key != null ? String(v.payloadS3Key) : "";
      if (!endpointId || !payloadS3Key) return json(404, { error: "Not found" });

      const obj = await s3.send(
        new GetObjectCommand({
          Bucket: PAYLOADS_BUCKET,
          Key: payloadS3Key,
        }),
      );
      const bodyBuf = await streamToBuffer(obj.Body);
      const contentType =
        obj.ContentType ??
        obj.Metadata?.["content-type"] ??
        (typeof v.headers === "object" && v.headers
          ? String((v.headers as Record<string, string>)["content-type"] ?? "")
          : undefined);

      const bodyText = looksTextual(contentType) ? bodyBuf.toString("utf8") : bodyBuf.toString("base64");

      if (!GEMINI_API_KEY.trim()) {
        const explanation =
          "AI explain is not configured (set GEMINI_API_KEY / Google AI Studio API key on the app API).";
        const durationMs = Date.now() - start;
        log({ level: "info", msg: "ai_explain", durationMs, eventId, endpointId, configured: false });
        return json(200, { explanation });
      }

      const reserve = await reserveAiExplainSlot();
      if (reserve === "misconfig") {
        return json(500, { error: "Server misconfiguration (AI usage table or rate limit)" });
      }
      if (reserve === "limit") {
        return json(429, {
          error: "AI explain daily limit reached (UTC). Try again tomorrow or ask the operator to raise AiExplainMaxPerDay.",
        });
      }

      const explanation = await geminiExplain({
        eventId,
        endpointId,
        method: String(v.method ?? ""),
        contentType,
        headers: (v.headers as Record<string, string> | undefined) ?? {},
        query: (v.query as Record<string, string> | undefined) ?? {},
        bodyText,
        status: String(v.status ?? "received"),
        lastError: v.lastError != null ? String(v.lastError) : undefined,
      });

      const durationMs = Date.now() - start;
      log({ level: "info", msg: "ai_explain", durationMs, eventId, endpointId, configured: true });
      return json(200, { explanation });
    }

    // GET /api/events/{eventId}?endpointId=...
    if (method === "GET" && path.startsWith("/api/events/")) {
      const eventId = event.pathParameters?.eventId?.trim();
      if (!eventId) return json(400, { error: "Missing path parameter eventId" });

      const res = await ddb.send(
        new QueryCommand({
          TableName: EVENTS_TABLE,
          IndexName: "EventIdIndex",
          KeyConditionExpression: "eventId = :id",
          ExpressionAttributeValues: { ":id": { S: eventId } },
          Limit: 1,
        }),
      );

      const item = res.Items?.[0];
      if (!item) return json(404, { error: "Not found" });

      const v = unmarshall(item) as Record<string, unknown>;
      const requestedEndpointId = event.queryStringParameters?.endpointId?.trim();
      const actualEndpointId = String(v.endpointId ?? "");
      if (requestedEndpointId && requestedEndpointId !== actualEndpointId) {
        return json(404, { error: "Not found" });
      }

      const payloadS3Key = v.payloadS3Key != null ? String(v.payloadS3Key) : undefined;
      let fullBody: string | undefined;

      if (payloadS3Key) {
        const obj = await s3.send(
          new GetObjectCommand({
            Bucket: PAYLOADS_BUCKET,
            Key: payloadS3Key,
          }),
        );
        const bodyBuf = await streamToBuffer(obj.Body);
        const contentType =
          obj.ContentType ??
          obj.Metadata?.["content-type"] ??
          (typeof v.headers === "object" && v.headers
            ? String((v.headers as Record<string, string>)["content-type"] ?? "")
            : undefined);

        if (looksTextual(contentType)) fullBody = bodyBuf.toString("utf8");
        else fullBody = bodyBuf.toString("base64");
      }

      const eventOut = {
        id: String(v.eventId ?? ""),
        endpointId: actualEndpointId,
        receivedAt: String(v.receivedAt ?? ""),
        method: String(v.method ?? ""),
        path: v.path != null ? String(v.path) : undefined,
        headers: (v.headers as Record<string, string> | undefined) ?? {},
        query: (v.query as Record<string, string> | undefined) ?? {},
        bodyPreview: String(v.bodyPreview ?? ""),
        fullBody,
        payloadS3Key,
        status: String(v.status ?? "received"),
        sourceIp: v.sourceIp != null ? String(v.sourceIp) : undefined,
        destinationUrl: v.destinationUrl != null ? String(v.destinationUrl) : undefined,
        replayCount: Number(v.replayCount ?? 0) || 0,
        lastError: v.lastError != null ? String(v.lastError) : undefined,
      };

      return json(200, { event: eventOut });
    }

    return json(404, { error: "Not found" });
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    log({ level: "error", msg: "app_api_failed", durationMs, error: message, path, method });
    return json(502, { error: "Server error" });
  } finally {
    const durationMs = Date.now() - start;
    log({ level: "info", msg: "app_api", durationMs, path, method });
  }
}