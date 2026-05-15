import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { marshall } from "@aws-sdk/util-dynamodb";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ulid } from "ulid";
import { log } from "./logger.js";

const EVENTS_TABLE = process.env.EVENTS_TABLE ?? "";
const ENDPOINTS_TABLE = process.env.ENDPOINTS_TABLE ?? "";
const PAYLOADS_BUCKET = process.env.PAYLOADS_BUCKET ?? "";

const ddb = new DynamoDBClient({});
const s3 = new S3Client({});

const BODY_PREVIEW_MAX = 2048;

function normalizeHeaders(
  headers: APIGatewayProxyEventV2["headers"] | undefined,
): Record<string, string> {
  if (!headers) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v !== undefined && v !== null) out[k.toLowerCase()] = String(v);
  }
  return out;
}

function normalizeQuery(
  q: APIGatewayProxyEventV2["queryStringParameters"] | undefined,
): Record<string, string> {
  if (!q) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return out;
}

function getHeader(event: APIGatewayProxyEventV2, name: string): string | undefined {
  const headers = event.headers ?? {};
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target && v != null) return String(v);
  }
  return undefined;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const start = Date.now();
  const endpointId = event.pathParameters?.endpointId?.trim();

  if (!endpointId) {
    log({ level: "warn", msg: "ingest_missing_endpoint", durationMs: Date.now() - start });
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "Missing path parameter endpointId" }),
    };
  }

  if (!EVENTS_TABLE || !ENDPOINTS_TABLE || !PAYLOADS_BUCKET) {
    log({ level: "error", msg: "ingest_misconfigured", endpointId, durationMs: Date.now() - start });
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "Server misconfiguration" }),
    };
  }

  const eventId = ulid();
  const receivedAt = new Date().toISOString();
  const headersNorm = normalizeHeaders(event.headers);
  const contentType = headersNorm["content-type"] ?? "application/octet-stream";
  const bodyBuf = event.body
    ? Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8")
    : Buffer.alloc(0);
  const payloadS3Key = `endpoints/${endpointId}/events/${eventId}/body.raw`;
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  const query = normalizeQuery(event.queryStringParameters);
  const sourceIp = event.requestContext.http.sourceIp;

  try {
    // Minimal abuse control: require a per-endpoint ingest token when configured.
    // Token can be provided as `?token=...` or `x-hookline-token: ...`.
    const tokenProvided = (event.queryStringParameters?.token ?? getHeader(event, "x-hookline-token") ?? "").trim();
    const endpointRes = await ddb.send(
      new GetItemCommand({
        TableName: ENDPOINTS_TABLE,
        Key: { id: { S: endpointId } },
        ProjectionExpression: "ingestToken",
      }),
    );

    const storedToken =
      endpointRes.Item && "ingestToken" in endpointRes.Item && endpointRes.Item.ingestToken?.S
        ? String(endpointRes.Item.ingestToken.S)
        : "";

    if (!storedToken) {
      // If the endpoint doesn't exist (or hasn't been created via the app API), don't accept writes.
      log({ level: "warn", msg: "ingest_unknown_endpoint", endpointId, durationMs: Date.now() - start });
      return {
        statusCode: 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Unknown endpointId" }),
      };
    }

    if (!tokenProvided || tokenProvided !== storedToken) {
      log({ level: "warn", msg: "ingest_unauthorized", endpointId, durationMs: Date.now() - start });
      return {
        statusCode: 401,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: PAYLOADS_BUCKET,
        Key: payloadS3Key,
        Body: bodyBuf,
        ContentType: contentType,
        Metadata: { "content-type": contentType },
      }),
    );

    const bodyPreview = bodyBuf.subarray(0, BODY_PREVIEW_MAX).toString("utf8");

    await ddb.send(
      new PutItemCommand({
        TableName: EVENTS_TABLE,
        Item: marshall(
          {
            endpointId,
            sk: `RECEIVED#${receivedAt}#${eventId}`,
            eventId,
            receivedAt,
            method,
            path,
            headers: headersNorm,
            query,
            bodyPreview,
            payloadS3Key,
            status: "received",
            sourceIp,
            replayCount: 0,
          },
          { removeUndefinedValues: true },
        ),
      }),
    );

    const durationMs = Date.now() - start;
    log({
      level: "info",
      msg: "ingest",
      endpointId,
      eventId,
      status: "received",
      durationMs,
      method,
      payloadS3Key,
    });

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, endpointId }),
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    log({
      level: "error",
      msg: "ingest_failed",
      endpointId,
      eventId,
      durationMs,
      error: message,
    });
    return {
      statusCode: 502,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "Ingest failed", eventId, endpointId }),
    };
  }
}
