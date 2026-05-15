"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, AlertTriangle, Repeat, Sparkles, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { JsonPanel } from "@/components/JsonPanel";
import { CopyButton } from "@/components/CopyButton";
import { ReplayModal } from "@/components/ReplayModal";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PreviewBanner } from "@/components/PreviewBanner";
import { explainEvent } from "@/lib/apiClient";
import { fetchEventPageDataOrPreview } from "@/lib/readWithPreview";
import { INGEST_BASE_URL } from "@/lib/config";
import type { WebhookEndpoint, WebhookEvent } from "@/types/webhook";

function KvTable({ data, empty }: { data: Record<string, string>; empty: string }) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <p className="px-3 py-4 text-xs text-muted-foreground">{empty}</p>;
  }
  return (
    <table className="w-full text-sm">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-b last:border-0">
            <td className="w-1/3 px-3 py-2 align-top font-mono text-xs text-muted-foreground">
              {k}
            </td>
            <td className="px-3 py-2 align-top font-mono text-xs break-all">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [event, setEvent] = useState<WebhookEvent | null>(null);
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replayOpen, setReplayOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);

  const loadEvent = useCallback(
    async (options?: { isCancelled?: () => boolean; showLoading?: boolean }) => {
      const isCancelled = options?.isCancelled ?? (() => false);
      const showLoading = options?.showLoading ?? true;

      // Avoid synchronous setState directly in effect body (repo eslint rule).
      await Promise.resolve();
      if (isCancelled()) return;

      if (showLoading) setLoading(true);
      setLoadError(null);
      setIsPreview(false);
      let shouldNotFound = false;
      try {
        const result = await fetchEventPageDataOrPreview(eventId);
        if (isCancelled()) return;
        if (!result.ok) {
          shouldNotFound = true;
          return;
        }
        setEvent(result.event);
        setEndpoints(result.endpoints);
        setIsPreview(result.isPreview);
      } catch (e) {
        if (isCancelled()) return;
        const msg = e instanceof Error ? e.message : String(e);
        setLoadError(msg);
      } finally {
        if (isCancelled()) return;
        if (showLoading) setLoading(false);
      }
      if (shouldNotFound && !isCancelled()) notFound();
    },
    [eventId],
  );

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      void loadEvent({ isCancelled: () => cancelled });
    });

    return () => {
      cancelled = true;
    };
  }, [loadEvent]);

  const endpoint = useMemo(() => {
    if (!event) return undefined;
    return endpoints.find((e) => e.id === event.endpointId);
  }, [endpoints, event]);

  if (!loading && !event && !loadError) notFound();

  const handleAi = async () => {
    if (!event || isPreview) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await explainEvent({ eventId: event.id });
      setAiResult(res.explanation);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setAiResult(`AI explain failed: ${msg}`);
    } finally {
      setAiLoading(false);
    }
  };

  const ingestUrl = event ? `${INGEST_BASE_URL}/${event.endpointId}` : "";
  const curl =
    event && ingestUrl
      ? `curl -X ${event.method} ${ingestUrl} \\
  -H 'content-type: application/json' \\
  -d '${(event.fullBody ?? event.bodyPreview).replace(/\n/g, "")}'`
      : "";

  return (
    <AppShell>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to events
      </Link>

      {isPreview && <PreviewBanner className="mt-4" />}

      {loadError && (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {endpoint?.name ?? "Event"}{" "}
              {event && (
                <span className="font-mono text-base font-normal text-muted-foreground">
                  · {event.id.slice(0, 8)}
                </span>
              )}
            </h1>
            {event && <StatusBadge status={event.status} />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {event
              ? `${new Date(event.receivedAt).toLocaleString()} · from ${event.sourceIp ?? "unknown"}`
              : loading
                ? "Loading…"
                : "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={handleAi}
            disabled={aiLoading || isPreview}
            title={isPreview ? "Add an API key in Settings to use AI explain" : undefined}
          >
            {aiLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Explain with AI
          </Button>
          <Button
            className="gap-1.5"
            onClick={() => setReplayOpen(true)}
            disabled={!event || isPreview}
            title={isPreview ? "Add an API key in Settings to replay events" : undefined}
          >
            <Repeat className="h-3.5 w-3.5" /> Replay
          </Button>
        </div>
      </div>

      {event?.lastError && (
        <Alert variant="destructive" className="mt-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Delivery failed</AlertTitle>
          <AlertDescription>{event.lastError}</AlertDescription>
        </Alert>
      )}

      {(aiLoading || aiResult) && (
        <div className="mt-6 rounded-xl border bg-card p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" /> AI explanation
          </div>
          {aiLoading ? (
            <div className="space-y-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{aiResult}</pre>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-1.5 rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Method</p>
          <p className="font-mono text-sm">
            {event ? `${event.method}${event.path ?? ""}` : "—"}
          </p>
        </div>
        <div className="space-y-1.5 rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Replays</p>
          <p className="text-sm">
            {event ? `${event.replayCount} ${event.destinationUrl ? `→ ${event.destinationUrl}` : ""}` : "—"}
          </p>
        </div>
        <div className="space-y-1.5 rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Endpoint</p>
          <Link
            href="/endpoints"
            className="text-sm text-foreground hover:text-primary hover:underline"
          >
            {endpoint?.name ?? "—"}
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card">
          <div className="border-b px-3 py-2 text-sm font-medium">Headers</div>
          <KvTable data={event?.headers ?? {}} empty="No headers." />
        </div>
        <div className="rounded-xl border bg-card">
          <div className="border-b px-3 py-2 text-sm font-medium">Query string</div>
          <KvTable data={event?.query ?? {}} empty="No query parameters." />
        </div>
      </div>

      <div className="mt-6">
        <JsonPanel
          raw={event?.fullBody ?? event?.bodyPreview ?? ""}
          subtitle={
            event
              ? event.fullBody
                ? "Full payload from storage. Replay posts this exact body."
                : "Preview may be truncated — full payload loads with the event."
              : undefined
          }
        />
      </div>

      <div className="mt-6 rounded-xl border bg-card p-5">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Reproduce this request</p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Copy and run locally. Add your ingest token as a{" "}
              <span className="font-mono text-[11px] text-foreground/85">?token=…</span> query
              parameter or <span className="font-mono text-[11px] text-foreground/85">x-hookline-token</span>{" "}
              header. Without it, ingest returns 401.
            </p>
          </div>
          <CopyButton value={curl} label="Copy curl" className="shrink-0" />
        </div>
        <pre className="overflow-x-auto rounded-md bg-background/60 p-3 font-mono text-xs text-muted-foreground">
{curl}
        </pre>
      </div>

      <ReplayModal
        eventId={event?.id ?? ""}
        defaultUrl={endpoint?.defaultDestinationUrl}
        open={replayOpen}
        onOpenChange={setReplayOpen}
        previewDisabled={isPreview}
        onReplayed={() => {
          void loadEvent({ showLoading: false });
        }}
      />
    </AppShell>
  );
}
