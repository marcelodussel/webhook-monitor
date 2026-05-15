import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PREVIEW_IDS,
  buildSeededStore,
  getPreviewEndpoints,
  getPreviewEventById,
  getPreviewEventsAll,
  getPreviewEventsForEndpoint,
  samplePayloadBodies,
} from "../lib/previewDataset.ts";

describe("samplePayloadBodies", () => {
  it("returns parseable JSON with expected top-level keys", () => {
    const { stripeBody, ghBody, shopBody } = samplePayloadBodies();
    const stripe = JSON.parse(stripeBody) as { type?: string };
    const gh = JSON.parse(ghBody) as { action?: string };
    const shop = JSON.parse(shopBody) as { line_items?: unknown[] };
    assert.equal(stripe.type, "checkout.session.completed");
    assert.equal(gh.action, "opened");
    assert.ok(Array.isArray(shop.line_items));
  });
});

describe("buildSeededStore", () => {
  const nowMs = 1_700_000_000_000;
  const stripeId = "ep-stripe-1";
  const githubId = "ep-github-1";
  const shopifyId = "ep-shopify-1";
  const eventIds = ["ev-0", "ev-1", "ev-2", "ev-3"] as const;

  it("creates three endpoints and four events with correct statuses", () => {
    const { endpoints, events } = buildSeededStore({
      stripeEndpointId: stripeId,
      githubEndpointId: githubId,
      shopifyEndpointId: shopifyId,
      eventIds,
      nowMs,
    });
    assert.equal(endpoints.length, 3);
    assert.equal(events.length, 4);
    assert.deepEqual(
      events.map((e) => e.status),
      ["processed", "failed", "received", "replayed"],
    );
  });

  it("caps bodyPreview at 120 characters", () => {
    const { events } = buildSeededStore({
      stripeEndpointId: stripeId,
      githubEndpointId: githubId,
      shopifyEndpointId: shopifyId,
      eventIds,
      nowMs,
    });
    for (const e of events) {
      assert.equal(e.bodyPreview.length, 120);
    }
  });

  it("assigns events to the correct endpoint ids", () => {
    const { events } = buildSeededStore({
      stripeEndpointId: stripeId,
      githubEndpointId: githubId,
      shopifyEndpointId: shopifyId,
      eventIds,
      nowMs,
    });
    assert.equal(events[0]?.endpointId, stripeId);
    assert.equal(events[1]?.endpointId, githubId);
    assert.equal(events[2]?.endpointId, shopifyId);
    assert.equal(events[3]?.endpointId, stripeId);
  });
});

describe("preview getters (stable PREVIEW_IDS)", () => {
  it("getPreviewEventById returns known events", () => {
    const ev = getPreviewEventById(PREVIEW_IDS.eventStripeRecent);
    assert.ok(ev);
    assert.equal(ev.id, PREVIEW_IDS.eventStripeRecent);
    assert.equal(ev.endpointId, PREVIEW_IDS.stripeEndpoint);
  });

  it("getPreviewEventById returns undefined for unknown id", () => {
    assert.equal(getPreviewEventById("no-such-event"), undefined);
  });

  it("getPreviewEventsForEndpoint filters by endpoint", () => {
    const list = getPreviewEventsForEndpoint(PREVIEW_IDS.stripeEndpoint);
    assert.ok(list.every((e) => e.endpointId === PREVIEW_IDS.stripeEndpoint));
    assert.ok(list.length >= 1);
  });

  it("getPreviewEndpoints and getPreviewEventsAll sort newest first", () => {
    const endpoints = getPreviewEndpoints();
    const events = getPreviewEventsAll();
    for (let i = 1; i < endpoints.length; i++) {
      assert.ok(
        new Date(endpoints[i - 1]!.createdAt) >= new Date(endpoints[i]!.createdAt),
        "endpoints sorted by createdAt desc",
      );
    }
    for (let i = 1; i < events.length; i++) {
      assert.ok(
        new Date(events[i - 1]!.receivedAt) >= new Date(events[i]!.receivedAt),
        "events sorted by receivedAt desc",
      );
    }
  });
});
