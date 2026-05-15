export type EventStatus = "received" | "processed" | "failed" | "replayed";

export type WebhookEvent = {
  id: string;
  endpointId: string;
  receivedAt: string;
  method: string;
  path?: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  bodyPreview: string;
  fullBody?: string;
  payloadS3Key?: string;
  status: EventStatus;
  sourceIp?: string;
  destinationUrl?: string;
  replayCount: number;
  lastError?: string;
};

export type WebhookEndpoint = {
  id: string;
  name: string;
  createdAt: string;
  defaultDestinationUrl?: string;
  ingestToken?: string;
};
