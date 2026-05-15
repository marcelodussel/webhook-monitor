import Link from "next/link";
import { GitBranch } from "lucide-react";
import { samplePayload } from "./content";
import { prettyJson } from "./pretty-json";
import { LANDING_SECTION_PAD } from "./constants";
import { SectionHeader } from "./section-header";

export function LandingEventPreview() {
  return (
    <section className="border-b border-border/60 py-24">
      <div className={`mx-auto max-w-7xl ${LANDING_SECTION_PAD}`}>
        <SectionHeader
          eyebrow="INSPECTOR / 06"
          title="Inspect stored webhook events end to end."
          desc="Headers, metadata, full JSON body, replay and all the details from your app API and S3-backed payloads."
        />
        <div className="mt-12 overflow-hidden rounded-xl border border-border bg-card/60">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-background/40 px-5 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                202 ACCEPTED
              </span>
              <span className="font-mono text-xs text-foreground">evt_1NxYZ2eZvKYlo2C0</span>
              <span className="font-mono text-xs text-muted-foreground">
                · stripe · 2026-05-14T17:20:00Z · 31ms
              </span>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-accent"
            >
              <GitBranch className="h-3.5 w-3.5" /> Replay
            </Link>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
            <div className="border-b border-border/70 p-5 lg:border-b-0 lg:border-r">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Headers</div>
              <ul className="mt-3 space-y-2 font-mono text-[12px]">
                {[
                  ["content-type", "application/json"],
                  ["user-agent", "Stripe/1.0"],
                  ["stripe-signature", "t=1715,v1=8c2a…"],
                  ["x-request-id", "req_4f7a"],
                ].map(([k, v]) => (
                  <li key={k} className="grid grid-cols-[110px_1fr] gap-2">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="truncate">{v}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Metadata
              </div>
              <ul className="mt-3 space-y-1.5 font-mono text-[12px] text-muted-foreground">
                <li>
                  endpoint <span className="text-foreground">stripe-prod</span>
                </li>
                <li>
                  region <span className="text-foreground">us-east-1</span>
                </li>
                <li>
                  s3.key <span className="text-foreground">payloads/evt_1Nx…</span>
                </li>
                <li>
                  replays <span className="text-foreground">0</span>
                </li>
              </ul>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-relaxed">
              <code>{prettyJson(samplePayload)}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
