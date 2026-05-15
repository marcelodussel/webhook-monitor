import type { WebhookEndpoint, WebhookEvent } from "@/types/webhook";

const API_KEY_LS = "hookline.apiKey";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function isApiAccessDenied(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

function getApiBaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!v) return "";
  return v.replace(/\/+$/, "");
}

function getIngestBaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_INGEST_BASE_URL?.trim();
  if (!v) return "";
  return v.replace(/\/+$/, "");
}

function getApiKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(API_KEY_LS) ?? "";
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("Missing NEXT_PUBLIC_API_BASE_URL");

  const apiKey = getApiKey();

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || "Invalid JSON response" };
  }

  if (!res.ok) {
    const errObj = data as { error?: unknown } | null;
    const msg = typeof errObj?.error === "string" ? errObj.error : `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }

  return data as T;
}

export async function fetchEndpoints(): Promise<WebhookEndpoint[]> {
  const data = await requestJson<{ endpoints: WebhookEndpoint[] }>("/api/endpoints");
  return data.endpoints ?? [];
}

export async function fetchEvents(input?: {
  endpointId?: string;
  limit?: number;
}): Promise<WebhookEvent[]> {
  if (!input?.endpointId) return [];
  const limit = input.limit ?? 50;
  const data = await requestJson<{ events: WebhookEvent[] }>(
    `/api/endpoints/${encodeURIComponent(input.endpointId)}/events?limit=${encodeURIComponent(String(limit))}`,
  );
  return data.events ?? [];
}

export async function fetchEvent(input: {
  eventId: string;
  endpointId?: string;
}): Promise<WebhookEvent> {
  const qp = input.endpointId ? `?endpointId=${encodeURIComponent(input.endpointId)}` : "";
  const data = await requestJson<{ event: WebhookEvent }>(
    `/api/events/${encodeURIComponent(input.eventId)}${qp}`,
  );
  return data.event;
}

export async function replayEvent(input: {
  eventId: string;
  destinationUrl?: string;
}): Promise<{ ok: boolean; statusCode: number; replayCount: number }> {
  const data = await requestJson<{ ok: boolean; statusCode: number; replayCount: number }>(
    `/api/events/${encodeURIComponent(input.eventId)}/replay`,
    {
      method: "POST",
      body: JSON.stringify(input.destinationUrl ? { destinationUrl: input.destinationUrl } : {}),
    },
  );
  return data;
}

export async function createEndpoint(input: {
  name: string;
  defaultDestinationUrl?: string;
}): Promise<{ endpoint: WebhookEndpoint; ingestUrl: string }> {
  const data = await requestJson<{ endpoint: WebhookEndpoint; ingestUrl: string }>("/api/endpoints", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data;
}

export async function deleteEndpoint(input: { endpointId: string }): Promise<void> {
  await requestJson<{ ok: boolean }>(
    `/api/endpoints/${encodeURIComponent(input.endpointId)}`,
    { method: "DELETE" },
  );
}

export async function sendTestWebhook(input: {
  endpointId: string;
  ingestToken?: string;
  body?: unknown;
}): Promise<{ eventId: string; endpointId: string }> {
  const base = getIngestBaseUrl();
  if (!base) throw new Error("Missing NEXT_PUBLIC_INGEST_BASE_URL");
  if (!input.endpointId.trim()) throw new Error("Missing endpointId");

  const tokenSuffix = input.ingestToken?.trim()
    ? `?token=${encodeURIComponent(input.ingestToken.trim())}`
    : "";
  const res = await fetch(`${base}/${encodeURIComponent(input.endpointId)}${tokenSuffix}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      input.body ?? {
        event: "hookline.test",
        sentAt: new Date().toISOString(),
        value: Math.floor(Math.random() * 10_000),
      },
    ),
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || "Invalid JSON response" };
  }

  if (!res.ok) {
    const errObj = data as { error?: unknown } | null;
    const msg = typeof errObj?.error === "string" ? errObj.error : `Request failed (${res.status})`;
    throw new Error(msg);
  }

  const out = data as { eventId?: unknown; endpointId?: unknown };
  const eventId = typeof out.eventId === "string" ? out.eventId : "";
  const endpointId = typeof out.endpointId === "string" ? out.endpointId : "";
  if (!eventId || !endpointId) throw new Error("Unexpected ingest response");
  return { eventId, endpointId };
}

export async function explainEvent(input: { eventId: string }): Promise<{ explanation: string }> {
  const data = await requestJson<{ explanation: string }>(
    `/api/events/${encodeURIComponent(input.eventId)}/explain`,
    { method: "POST", body: JSON.stringify({}) },
  );
  if (!data.explanation) throw new Error("Missing explanation");
  return data;
}

