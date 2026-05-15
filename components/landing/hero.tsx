import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { APP_NAME, INGEST_BASE_URL } from "@/lib/config";
import { LANDING_GRID_CLASS, LANDING_SECTION_PAD } from "./constants";
import { getAppDisplayVersion } from "./version";

const DEMO_LOG_TIME = "17:20:03";

function LogLine({
  method,
  endpointId,
  event,
  status,
  ms,
  fail,
}: {
  method: string;
  endpointId: string;
  event: string;
  status: number;
  ms: number;
  fail?: boolean;
}) {
  const statusClass = fail ? "text-destructive" : "text-primary";
  return (
    <>
      <div className="space-y-1 border-b border-border/40 pb-2 text-[11px] leading-snug last:border-0 last:pb-0 sm:hidden">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="shrink-0 text-muted-foreground">{DEMO_LOG_TIME}</span>
          <span className="shrink-0 rounded bg-info/15 px-1.5 py-0.5 text-[10px] font-semibold text-info">{method}</span>
          <span className="min-w-0 truncate font-mono text-foreground">/hooks/{endpointId}</span>
          <span className={`ml-auto shrink-0 tabular-nums ${statusClass}`}>{status}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{ms}ms</span>
        </div>
        <div className="min-w-0 truncate text-muted-foreground">{event}</div>
      </div>
      <div className="hidden min-w-0 grid-cols-[auto_auto_auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 text-[12px] leading-relaxed sm:grid">
        <span className="text-muted-foreground">{DEMO_LOG_TIME}</span>
        <span className="rounded bg-info/15 px-1.5 py-0.5 text-[10px] font-semibold text-info">{method}</span>
        <span className="text-foreground">/hooks/{endpointId}</span>
        <span className="min-w-0 truncate text-muted-foreground">{event}</span>
        <span className={`text-right tabular-nums ${statusClass}`}>{status}</span>
        <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">{ms}ms</span>
      </div>
    </>
  );
}

function HeroTerminal({ ingestHost }: { ingestHost: string }) {
  return (
    <div className="relative min-w-0 max-w-full">
      <div className="pointer-events-none absolute -inset-2 -z-10 rounded-2xl bg-primary/10 blur-3xl sm:-inset-4" />
      <div className="max-w-full overflow-hidden rounded-xl border border-border bg-card/80 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/70 bg-background/40 px-3 py-2.5 sm:px-4">
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
          </div>
          <span className="min-w-0 truncate text-center font-mono text-[11px] text-muted-foreground sm:text-left">
            {ingestHost} — live
          </span>
          <span className="shrink-0 font-mono text-[11px] text-primary max-sm:hidden">● streaming</span>
          <span className="shrink-0 font-mono text-[11px] text-primary sm:hidden">●</span>
        </div>
        <div className="max-h-[460px] min-w-0 overflow-x-auto overflow-y-auto p-3 font-mono text-[12px] leading-relaxed sm:p-4">
          <div className="w-full min-w-0 space-y-2">
            <LogLine method="POST" endpointId="ep_stripe" event="checkout.session.completed" status={202} ms={31} />
            <LogLine method="POST" endpointId="ep_github" event="pull_request.opened" status={202} ms={28} />
            <LogLine method="POST" endpointId="ep_shopify" event="orders/create" status={202} ms={44} />
            <LogLine method="POST" endpointId="ep_stripe" event="invoice.paid" status={202} ms={22} />
            <LogLine method="POST" endpointId="ep_discord" event="message.create" status={500} ms={812} fail />
            <LogLine
              method="POST"
              endpointId="ep_stripe"
              event="customer.subscription.updated"
              status={202}
              ms={36}
            />
            <LogLine method="POST" endpointId="ep_github" event="push" status={202} ms={25} />
            <div className="pt-2 text-[10px] leading-snug break-words text-muted-foreground sm:text-[12px] sm:leading-relaxed">
              <span className="text-primary">λ </span>
              ingest-handler · warm path · dynamodb.put · s3.put
            </div>
            <div className="text-[10px] leading-snug break-words text-muted-foreground sm:text-[12px] sm:leading-relaxed">
              <span className="text-primary">λ </span>
              app-api · outbound replay · allowlist:ok · headers.stripped
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingHero() {
  const version = getAppDisplayVersion();
  let ingestHost = "ingest";
  try {
    ingestHost = new URL(INGEST_BASE_URL).host;
  } catch {
    ingestHost = INGEST_BASE_URL.replace(/^https?:\/\//, "").split("/")[0] || "ingest";
  }

  return (
    <section className="relative border-b border-border/60">
      <div
        className={`pointer-events-none absolute inset-0 overflow-hidden ${LANDING_GRID_CLASS} [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]`}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[520px] opacity-70"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 0%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 70%)",
        }}
      />
      <div
        className={`relative mx-auto grid min-w-0 max-w-7xl gap-12 py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28 ${LANDING_SECTION_PAD}`}
      >
        <div className="flex min-w-0 flex-col justify-center">
          <div className="inline-flex w-fit max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-pulse" />
            <span className="text-foreground">v{version}</span>
            <span className="text-border">·</span>
            <span>Next.js · SAM · TypeScript</span>
          </div>
          <h1 className="mt-6 text-balance break-words text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[58px]">
            Build, inspect, and replay webhooks on a fully <span className="text-primary">serverless</span> AWS
            architecture.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {APP_NAME} is a webhook observability platform built with Next.js and AWS serverless infrastructure for
            capturing, debugging, replaying, and inspecting real-world webhook traffic.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/endpoints"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card/50 px-4 py-2.5 text-sm font-medium hover:bg-accent"
            >
              Create endpoint
            </Link>
            <a
              href="#architecture"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card/50 px-4 py-2.5 text-sm font-medium hover:bg-accent"
            >
              View Architecture
            </a>
          </div>
          <dl className="mt-12 grid grid-cols-1 gap-6 border-t border-border/60 pt-6 text-sm sm:grid-cols-3">
            {[
              ["Split control plane", "App API + Ingest API"],
              ["Persistence model", "S3 Bucket + DynamoDB"],
              ["Replay safety", "Sanitize + Allowlist"],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dd className="break-words font-mono text-lg font-semibold text-foreground sm:text-xl">{v}</dd>
                <dt className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="min-w-0">
          <HeroTerminal ingestHost={ingestHost} />
        </div>
      </div>
    </section>
  );
}
