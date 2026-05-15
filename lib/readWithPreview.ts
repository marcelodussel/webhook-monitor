import {
  fetchEndpoints,
  fetchEvent,
  fetchEvents,
  isApiAccessDenied,
} from "@/lib/apiClient";
import type { WebhookEndpoint, WebhookEvent } from "@/types/webhook";
import {
  getPreviewEndpoints,
  getPreviewEventById,
  getPreviewEventsAll,
  getPreviewEventsForEndpoint,
} from "@/lib/previewDataset";

export async function fetchEndpointsOrPreview(): Promise<{
  endpoints: WebhookEndpoint[];
  isPreview: boolean;
}> {
  try {
    const endpoints = await fetchEndpoints();
    return { endpoints, isPreview: false };
  } catch (e) {
    if (!isApiAccessDenied(e)) throw e;
    return { endpoints: getPreviewEndpoints(), isPreview: true };
  }
}

export async function fetchDashboardPageData(filter: string): Promise<{
  endpoints: WebhookEndpoint[];
  events: WebhookEvent[];
  isPreview: boolean;
}> {
  const epResult = await fetchEndpointsOrPreview();
  if (epResult.isPreview) {
    const events =
      filter === "all"
        ? getPreviewEventsAll().slice(0, 50)
        : getPreviewEventsForEndpoint(filter).slice(0, 50);
    return { endpoints: epResult.endpoints, events, isPreview: true };
  }

  const eps = epResult.endpoints;
  try {
    if (filter === "all") {
      const perEndpoint = await Promise.all(
        eps.map(async (ep) => fetchEvents({ endpointId: ep.id, limit: 25 })),
      );
      const merged = perEndpoint
        .flat()
        .sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt));
      return { endpoints: eps, events: merged.slice(0, 50), isPreview: false };
    }
    const evs = await fetchEvents({ endpointId: filter, limit: 50 });
    return { endpoints: eps, events: evs, isPreview: false };
  } catch (e) {
    if (!isApiAccessDenied(e)) throw e;
    const events =
      filter === "all"
        ? getPreviewEventsAll().slice(0, 50)
        : getPreviewEventsForEndpoint(filter).slice(0, 50);
    return { endpoints: getPreviewEndpoints(), events, isPreview: true };
  }
}

export type EventPageLoadResult =
  | { ok: true; event: WebhookEvent; endpoints: WebhookEndpoint[]; isPreview: boolean }
  | { ok: false; reason: "notfound" };

export async function fetchEventPageDataOrPreview(eventId: string): Promise<EventPageLoadResult> {
  let accessDenied = false;
  let event: WebhookEvent | null = null;
  let endpoints: WebhookEndpoint[] = [];

  try {
    event = await fetchEvent({ eventId });
  } catch (e) {
    if (isApiAccessDenied(e)) accessDenied = true;
    else throw e;
  }

  try {
    endpoints = await fetchEndpoints();
  } catch (e) {
    if (isApiAccessDenied(e)) accessDenied = true;
    else throw e;
  }

  if (accessDenied) {
    const previewEvent = getPreviewEventById(eventId);
    if (!previewEvent) return { ok: false, reason: "notfound" };
    return {
      ok: true,
      event: previewEvent,
      endpoints: getPreviewEndpoints(),
      isPreview: true,
    };
  }

  if (!event) return { ok: false, reason: "notfound" };

  return { ok: true, event, endpoints, isPreview: false };
}
