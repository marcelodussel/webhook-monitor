import type { WebhookEndpoint, WebhookEvent } from "@/types/webhook";

/** Stable IDs for public preview (deep links, reload). */
export const PREVIEW_IDS = {
  stripeEndpoint: "preview-ep-stripe",
  githubEndpoint: "preview-ep-github",
  shopifyEndpoint: "preview-ep-shopify",
  eventStripeRecent: "preview-ev-stripe-recent",
  eventGithubFailed: "preview-ev-github-failed",
  eventShopifyReceived: "preview-ev-shopify-received",
  eventStripeReplayed: "preview-ev-stripe-replayed",
} as const;

export function samplePayloadBodies() {
  const stripeBody = JSON.stringify(
    {
      id: "evt_1NxYZ2",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_a1b2",
          amount_total: 4200,
          currency: "usd",
          customer_email: "ada@example.com",
        },
      },
    },
    null,
    2,
  );
  const ghBody = JSON.stringify(
    {
      action: "opened",
      number: 142,
      pull_request: { title: "Add retry logic", user: { login: "octocat" } },
      repository: { full_name: "acme/api" },
    },
    null,
    2,
  );
  const shopBody = JSON.stringify(
    {
      id: 820982911946154500,
      email: "ada@example.com",
      total_price: "199.00",
      currency: "USD",
      line_items: [{ title: "Mechanical keyboard", quantity: 1 }],
    },
    null,
    2,
  );
  return { stripeBody, ghBody, shopBody };
}

export function buildSeededStore(input: {
  stripeEndpointId: string;
  githubEndpointId: string;
  shopifyEndpointId: string;
  eventIds: readonly [string, string, string, string];
  nowMs?: number;
}): { endpoints: WebhookEndpoint[]; events: WebhookEvent[] } {
  const { stripeEndpointId, githubEndpointId, shopifyEndpointId, eventIds } = input;
  const now = input.nowMs ?? Date.now();
  const { stripeBody, ghBody, shopBody } = samplePayloadBodies();

  const endpoints: WebhookEndpoint[] = [
    {
      id: stripeEndpointId,
      name: "Stripe — production",
      createdAt: new Date(now - 86400000 * 6).toISOString(),
      defaultDestinationUrl: "https://app.acme.io/webhooks/stripe",
    },
    { id: githubEndpointId, name: "GitHub Actions", createdAt: new Date(now - 86400000 * 4).toISOString() },
    {
      id: shopifyEndpointId,
      name: "Shopify orders",
      createdAt: new Date(now - 86400000 * 2).toISOString(),
      defaultDestinationUrl: "https://app.acme.io/wh/shopify",
    },
  ];

  const [ev0, ev1, ev2, ev3] = eventIds;

  const events: WebhookEvent[] = [
    {
      id: ev0,
      endpointId: stripeEndpointId,
      receivedAt: new Date(now - 1000 * 60 * 3).toISOString(),
      method: "POST",
      path: "/",
      status: "processed",
      replayCount: 0,
      sourceIp: "3.18.12.63",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1709,v1=8c2a…",
        "user-agent": "Stripe/1.0",
      },
      query: {},
      bodyPreview: stripeBody.slice(0, 120),
      fullBody: stripeBody,
    },
    {
      id: ev1,
      endpointId: githubEndpointId,
      receivedAt: new Date(now - 1000 * 60 * 17).toISOString(),
      method: "POST",
      path: "/",
      status: "failed",
      replayCount: 1,
      sourceIp: "140.82.115.247",
      headers: {
        "content-type": "application/json",
        "x-github-event": "pull_request",
        "x-hub-signature-256": "sha256=abc…",
      },
      query: { source: "actions" },
      bodyPreview: ghBody.slice(0, 120),
      fullBody: ghBody,
      lastError: "Destination returned 502 Bad Gateway after 3 retries",
    },
    {
      id: ev2,
      endpointId: shopifyEndpointId,
      receivedAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
      method: "POST",
      path: "/",
      status: "received",
      replayCount: 0,
      sourceIp: "23.227.38.32",
      headers: {
        "content-type": "application/json",
        "x-shopify-topic": "orders/create",
        "x-shopify-hmac-sha256": "k4n2…",
      },
      query: {},
      bodyPreview: shopBody.slice(0, 120),
      fullBody: shopBody,
    },
    {
      id: ev3,
      endpointId: stripeEndpointId,
      receivedAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
      method: "POST",
      path: "/",
      status: "replayed",
      replayCount: 2,
      sourceIp: "3.18.12.63",
      headers: { "content-type": "application/json", "stripe-signature": "t=1708,v1=de4f…" },
      query: {},
      bodyPreview: stripeBody.slice(0, 120),
      fullBody: stripeBody,
    },
  ];

  return { endpoints, events };
}

let previewCache: { endpoints: WebhookEndpoint[]; events: WebhookEvent[] } | null = null;

function getPreviewStoreSnapshot() {
  if (!previewCache) {
    previewCache = buildSeededStore({
      stripeEndpointId: PREVIEW_IDS.stripeEndpoint,
      githubEndpointId: PREVIEW_IDS.githubEndpoint,
      shopifyEndpointId: PREVIEW_IDS.shopifyEndpoint,
      eventIds: [
        PREVIEW_IDS.eventStripeRecent,
        PREVIEW_IDS.eventGithubFailed,
        PREVIEW_IDS.eventShopifyReceived,
        PREVIEW_IDS.eventStripeReplayed,
      ],
    });
  }
  return previewCache;
}

export function getPreviewEndpoints(): WebhookEndpoint[] {
  const { endpoints } = getPreviewStoreSnapshot();
  return [...endpoints].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function getPreviewEventsAll(): WebhookEvent[] {
  const { events } = getPreviewStoreSnapshot();
  return [...events].sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt));
}

export function getPreviewEventsForEndpoint(endpointId: string): WebhookEvent[] {
  return getPreviewEventsAll().filter((e) => e.endpointId === endpointId);
}

export function getPreviewEventById(eventId: string): WebhookEvent | undefined {
  return getPreviewStoreSnapshot().events.find((e) => e.id === eventId);
}
