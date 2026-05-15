import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { DynamoDBClient, GetItemCommand, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { marshall } from "@aws-sdk/util-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

const ddbMock = mockClient(DynamoDBClient);
const s3Mock = mockClient(S3Client);

const API_KEY = "test-api-key";
const EVENT_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const ENDPOINT_ID = "00000000-0000-4000-8000-000000000001";

function appApiEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "POST /api/events/{eventId}/replay",
    rawPath: `/api/events/${EVENT_ID}/replay`,
    rawQueryString: "",
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
    },
    requestContext: {
      accountId: "123456789012",
      apiId: "api",
      domainName: "localhost",
      domainPrefix: "api",
      http: {
        method: "POST",
        path: `/api/events/${EVENT_ID}/replay`,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "hookline-test",
      },
      routeKey: "POST /api/events/{eventId}/replay",
      stage: "$default",
      requestId: "test-request-id",
      time: "01/Jan/2024:00:00:00 +0000",
      timeEpoch: 1704067200000,
    },
    pathParameters: { eventId: EVENT_ID },
    isBase64Encoded: false,
    ...overrides,
  };
}

function ingestEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "POST /hooks/{endpointId}",
    rawPath: `/hooks/${ENDPOINT_ID}`,
    rawQueryString: "token=wrong",
    headers: { "content-type": "application/json" },
    queryStringParameters: { token: "wrong" },
    requestContext: {
      accountId: "123456789012",
      apiId: "api",
      domainName: "localhost",
      domainPrefix: "api",
      http: {
        method: "POST",
        path: `/hooks/${ENDPOINT_ID}`,
        protocol: "HTTP/1.1",
        sourceIp: "203.0.113.1",
        userAgent: "hookline-test",
      },
      routeKey: "POST /hooks/{endpointId}",
      stage: "$default",
      requestId: "test-request-id",
      time: "01/Jan/2024:00:00:00 +0000",
      timeEpoch: 1704067200000,
    },
    pathParameters: { endpointId: ENDPOINT_ID },
    body: '{"ping":true}',
    isBase64Encoded: false,
    ...overrides,
  };
}

function mockStoredEvent() {
  ddbMock.on(QueryCommand).resolves({
    Items: [
      marshall({
        endpointId: ENDPOINT_ID,
        sk: `RECEIVED#2024-01-01T00:00:00.000Z#${EVENT_ID}`,
        eventId: EVENT_ID,
        payloadS3Key: `endpoints/${ENDPOINT_ID}/events/${EVENT_ID}/body.raw`,
        headers: { "content-type": "application/json" },
        replayCount: 0,
      }),
    ],
  });
  ddbMock.on(GetItemCommand).resolves({
    Item: marshall({ id: ENDPOINT_ID }),
  });
}

async function invokeHandler(
  handler: APIGatewayProxyHandlerV2,
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  const res = await handler(event, {} as never, () => {});
  if (res === undefined || typeof res === "string") {
    assert.fail("expected structured API Gateway response");
  }
  return res;
}

describe("app-api handler", () => {
  let handler: APIGatewayProxyHandlerV2;

  before(async () => {
    process.env.APP_API_KEY = API_KEY;
    process.env.EVENTS_TABLE = "test-events";
    process.env.ENDPOINTS_TABLE = "test-endpoints";
    process.env.PAYLOADS_BUCKET = "test-payloads";
    process.env.REPLAY_ALLOWED_HOSTS = "webhook.site";
    process.env.INGEST_BASE_URL = "https://ingest.example.com/hooks";

    ddbMock.reset();
    s3Mock.reset();

    const mod = await import("../lambdas/app-api/src/index.ts");
    handler = mod.handler;
  });

  after(() => {
    ddbMock.reset();
    s3Mock.reset();
  });

  beforeEach(() => {
    ddbMock.reset();
    s3Mock.reset();
  });

  it("returns 401 when x-api-key is missing", async () => {
    const res = await invokeHandler(
      handler,
      appApiEvent({
        headers: { "content-type": "application/json" },
      }),
    );
    assert.equal(res.statusCode, 401);
    assert.match(String(res.body), /Unauthorized/);
  });

  it("rejects replay to a host outside ReplayAllowedHosts", async () => {
    mockStoredEvent();

    const res = await invokeHandler(
      handler,
      appApiEvent({
        body: JSON.stringify({ destinationUrl: "https://example.com/callback" }),
      }),
    );

    assert.equal(res.statusCode, 400);
    assert.match(String(res.body), /invalid destinationUrl/);
    assert.equal(s3Mock.commandCalls(GetObjectCommand).length, 0);
  });

  it("rejects replay to private IPs even when allowlist is set", async () => {
    mockStoredEvent();

    const res = await invokeHandler(
      handler,
      appApiEvent({
        body: JSON.stringify({ destinationUrl: "https://127.0.0.1/internal" }),
      }),
    );

    assert.equal(res.statusCode, 400);
    assert.match(String(res.body), /invalid destinationUrl/);
    assert.equal(s3Mock.commandCalls(GetObjectCommand).length, 0);
  });

  it("accepts replay to an allowlisted host", async () => {
    mockStoredEvent();
    s3Mock.on(GetObjectCommand).resolves({
      Body: Buffer.from('{"ok":true}'),
    } as never);
    ddbMock.on(UpdateItemCommand).resolves({
      Attributes: { replayCount: { N: "1" } },
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response("ok", { status: 200 }) as unknown as Response;

    try {
      const res = await invokeHandler(
        handler,
        appApiEvent({
          body: JSON.stringify({ destinationUrl: "https://webhook.site/unique-id" }),
        }),
      );

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(String(res.body));
      assert.equal(body.ok, true);
      assert.equal(body.statusCode, 200);
      assert.equal(s3Mock.commandCalls(GetObjectCommand).length, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("ingest handler", () => {
  let handler: APIGatewayProxyHandlerV2;

  before(async () => {
    process.env.EVENTS_TABLE = "test-events";
    process.env.ENDPOINTS_TABLE = "test-endpoints";
    process.env.PAYLOADS_BUCKET = "test-payloads";

    ddbMock.reset();
    s3Mock.reset();

    const mod = await import("../lambdas/ingest/src/index.ts");
    handler = mod.handler;
  });

  after(() => {
    ddbMock.reset();
    s3Mock.reset();
  });

  beforeEach(() => {
    ddbMock.reset();
    s3Mock.reset();
  });

  it("returns 401 when ingest token does not match", async () => {
    ddbMock.on(GetItemCommand).resolves({
      Item: { ingestToken: { S: "expected-token" } },
    });

    const res = await invokeHandler(handler, ingestEvent());

    assert.equal(res.statusCode, 401);
    assert.match(String(res.body), /Unauthorized/);
    assert.equal(s3Mock.commandCalls(PutObjectCommand).length, 0);
  });

  it("returns 404 when endpoint has no stored token", async () => {
    ddbMock.on(GetItemCommand).resolves({ Item: {} });

    const res = await invokeHandler(
      handler,
      ingestEvent({
        queryStringParameters: { token: "any" },
        rawQueryString: "token=any",
      }),
    );

    assert.equal(res.statusCode, 404);
    assert.match(String(res.body), /Unknown endpointId/);
  });
});
