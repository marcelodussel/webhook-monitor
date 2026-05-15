"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { WebhookEvent, WebhookEndpoint } from "@/types/webhook";
import { CopyButton } from "./CopyButton";
import { StatusBadge } from "./StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";

function timeAgo(iso: string) {
  const diff = Date.now() - +new Date(iso);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function shortEventId(id: string) {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

const rowFocusClass =
  "cursor-pointer transition-colors hover:bg-accent/30 focus-visible:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background";

const DESKTOP_TABLE_COLGROUP = (
  <colgroup>
    <col className="w-14 lg:w-28" />
    <col className="w-18 lg:w-28" />
    <col className="w-18 lg:w-40" />
    <col className="w-24 lg:w-28" />
    <col className="min-w-0 w-auto" />
    <col className="w-31 lg:w-40" />
  </colgroup>
);

const DESKTOP_TABLE_HEAD = (
  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
    <tr>
      <th className="px-2 py-2.5 font-medium lg:px-3">Time</th>
      <th className="px-2 font-medium lg:px-3">Method</th>
      <th className="px-2 font-medium lg:px-3">Endpoint</th>
      <th className="px-2 font-medium lg:px-3">Status</th>
      <th className="px-2 font-medium lg:px-3">Body</th>
      <th className="px-2 font-medium lg:px-3">ID</th>
    </tr>
  </thead>
);

export function EventTableSkeleton() {
  return (
    <>
      <div className="space-y-3 md:hidden" aria-busy="true" aria-label="Loading events">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-5 w-12 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-[min(100%,14rem)]" />
            <Skeleton className="h-10 w-full" />
            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden md:-mx-4 md:block lg:mx-0">
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table
            className="w-full min-w-[720px] table-fixed text-sm"
            aria-busy="true"
            aria-label="Loading events"
          >
            {DESKTOP_TABLE_COLGROUP}
            {DESKTOP_TABLE_HEAD}
            <tbody>
              {Array.from({ length: 7 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-2 py-3 align-middle whitespace-nowrap lg:px-3">
                    <Skeleton className="h-4 w-12" />
                  </td>
                  <td className="px-2 py-3 align-middle lg:px-3">
                    <Skeleton className="h-5 w-10 rounded-md" />
                  </td>
                  <td className="min-w-0 px-2 py-3 align-middle lg:px-3">
                    <Skeleton className="h-4 w-28 max-w-full" />
                  </td>
                  <td className="px-2 py-3 align-middle lg:px-3">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </td>
                  <td className="min-w-0 px-2 py-3 align-middle lg:px-3">
                    <Skeleton className="h-4 w-full max-w-[14rem]" />
                  </td>
                  <td className="px-2 py-3 align-middle lg:px-3">
                    <div className="flex min-w-0 items-center gap-1">
                      <Skeleton className="h-4 min-w-0 flex-1" />
                      <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function EventTable({
  events,
  endpoints,
  emptyHint,
}: {
  events: WebhookEvent[];
  endpoints: WebhookEndpoint[];
  emptyHint?: React.ReactNode;
}) {
  const router = useRouter();
  const epMap = new Map(endpoints.map((e) => [e.id, e]));

  const goToEvent = useCallback(
    (eventId: string, e: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
      if ("key" in e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
      } else if (e.metaKey || e.ctrlKey) {
        window.open(`/events/${eventId}`, "_blank", "noopener,noreferrer");
        return;
      }
      router.push(`/events/${eventId}`);
    },
    [router],
  );

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
        <p className="text-sm font-medium">No events yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {emptyHint ?? "Simulate an incoming webhook from the Endpoints page to see events here."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {events.map((ev) => {
          const ep = epMap.get(ev.endpointId);
          const label = ep?.name ?? "Unknown";
          const aria = `View event details: ${shortEventId(ev.id)}, ${label}, ${ev.method}, ${ev.status}`;
          return (
            <div
              key={ev.id}
              tabIndex={0}
              role="link"
              aria-label={aria}
              className={`rounded-lg border border-border bg-card p-4 ${rowFocusClass}`}
              onClick={(e) => goToEvent(ev.id, e)}
              onKeyDown={(e) => goToEvent(ev.id, e)}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {timeAgo(ev.receivedAt)}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {ev.method}
                </span>
                <StatusBadge status={ev.status} />
              </div>
              <p
                className="mt-2 truncate text-sm font-medium text-foreground"
                title={label}
              >
                {label}
              </p>
              <code
                className="mt-2 line-clamp-2 block break-all font-mono text-xs text-muted-foreground"
                title={ev.bodyPreview}
              >
                {ev.bodyPreview}
              </code>
              <div className="mt-3 flex min-w-0 items-center justify-between gap-2 border-t border-border pt-3">
                <code
                  className="min-w-0 truncate font-mono text-xs text-muted-foreground"
                  title={ev.id}
                >
                  {shortEventId(ev.id)}
                </code>
                <CopyButton
                  value={ev.id}
                  iconOnly
                  aria-label="Copy event ID"
                  className="h-9 w-9 shrink-0"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden md:-mx-4 md:block lg:mx-0">
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[720px] table-fixed text-sm">
            {DESKTOP_TABLE_COLGROUP}
            {DESKTOP_TABLE_HEAD}
            <tbody>
              {events.map((ev) => {
                const ep = epMap.get(ev.endpointId);
                const label = ep?.name ?? "Unknown";
                return (
                  <tr
                    key={ev.id}
                    tabIndex={0}
                    role="link"
                    aria-label={`View event details: ${shortEventId(ev.id)}, ${label}, ${ev.method}, ${ev.status}`}
                    className={`border-t border-border ${rowFocusClass}`}
                    onClick={(e) => goToEvent(ev.id, e)}
                    onKeyDown={(e) => goToEvent(ev.id, e)}
                  >
                    <td className="px-2 lg:px-3 py-3 align-middle text-muted-foreground whitespace-nowrap">
                      {timeAgo(ev.receivedAt)}
                    </td>
                    <td className="px-2 lg:px-3 py-3 align-middle">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {ev.method}
                      </span>
                    </td>
                    <td className="min-w-0 px-2 lg:px-3 py-3 align-middle">
                      <span className="block truncate font-medium text-foreground" title={label}>
                        {label}
                      </span>
                    </td>
                    <td className="px-2 lg:px-3 py-3 align-middle">
                      <StatusBadge status={ev.status} />
                    </td>
                    <td className="min-w-0 px-2 lg:px-3 py-3 align-middle">
                      <code
                        className="line-clamp-1 block min-w-0 w-full font-mono text-xs text-muted-foreground"
                        title={ev.bodyPreview}
                      >
                        {ev.bodyPreview}
                      </code>
                    </td>
                    <td className="px-2 lg:px-3 py-3 align-middle">
                      <div className="flex min-w-0 items-center gap-1">
                        <code
                          className="min-w-0 truncate font-mono text-xs text-muted-foreground"
                          title={ev.id}
                        >
                          {shortEventId(ev.id)}
                        </code>
                        <CopyButton value={ev.id} iconOnly aria-label="Copy event ID" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
