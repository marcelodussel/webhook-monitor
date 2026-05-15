"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PreviewBanner } from "@/components/PreviewBanner";
import { EventTable, EventTableSkeleton } from "@/components/EventTable";
import { fetchDashboardPageData } from "@/lib/readWithPreview";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WebhookEndpoint, WebhookEvent } from "@/types/webhook";

export default function DashboardPage() {
  const [filter, setFilter] = useState<string>("all");
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Avoid synchronous setState directly in effect body (repo eslint rule).
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);
      setIsPreview(false);
      try {
        const { endpoints: eps, events: evs, isPreview: preview } = await fetchDashboardPageData(
          filter,
        );
        if (cancelled) return;
        setEndpoints(eps);
        setEvents(evs);
        setIsPreview(preview);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filter]);

  const filterLabel = useMemo(() => {
    if (filter === "all") return "All endpoints";
    return endpoints.find((e) => e.id === filter)?.name ?? "Endpoint";
  }, [endpoints, filter]);

  const summaryLine = useMemo(() => {
    if (loading) {
      if (filter === "all") {
        return "0 events across 0 endpoints.";
      }
      return `0 events for ${filterLabel}.`;
    }
    const n = events.length;
    const eventWord = n === 1 ? "event" : "events";
    if (filter === "all") {
      const m = endpoints.length;
      const epWord = m === 1 ? "endpoint" : "endpoints";
      return `${n} ${eventWord} across ${m} ${epWord}.`;
    }
    return `${n} ${eventWord} for ${filterLabel}.`;
  }, [loading, filter, filterLabel, events.length, endpoints.length]);

  return (
    <AppShell>
      {isPreview && <PreviewBanner />}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p
            className={`mt-1 text-sm text-muted-foreground ${loading ? "tabular-nums" : ""}`}
            aria-live="polite"
            aria-busy={loading}
          >
            {summaryLine}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose an event to inspect its payload, headers, and replay options.
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-3 md:w-auto md:flex-row md:items-center">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full min-w-0 md:w-[220px]">
              <SelectValue placeholder="Filter by endpoint" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All endpoints</SelectItem>
              {endpoints.map((ep) => (
                <SelectItem key={ep.id} value={ep.id}>
                  {ep.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link
            href="/endpoints"
            className="inline-flex w-full items-center justify-center rounded-md border bg-card px-3 py-2 text-center text-sm font-medium hover:bg-accent md:w-auto md:py-1.5"
          >
            Manage endpoints
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <EventTableSkeleton />
      ) : (
        <EventTable
          events={events}
          endpoints={endpoints}
          emptyHint={
            <>
              Head to{" "}
              <Link href="/endpoints" className="text-primary hover:underline">
                Endpoints
              </Link>{" "}
              and send a webhook to its ingest URL.
            </>
          }
        />
      )}
    </AppShell>
  );
}
