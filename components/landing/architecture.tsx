import type { ComponentType, SVGProps } from "react";
import { Database, Eye, Globe, Network, Zap } from "lucide-react";
import { LANDING_SECTION_PAD } from "./constants";
import { SectionHeader } from "./section-header";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const nodes: { label: string; sub: string; icon: Icon }[] = [
  { label: "Webhook Provider", sub: "Stripe · GitHub · Shopify", icon: Globe },
  { label: "API Gateway", sub: "HTTP API · token gated", icon: Network },
  { label: "Lambda", sub: "ingest-handler · ts", icon: Zap },
  { label: "DynamoDB + S3", sub: "metadata + raw payload", icon: Database },
  { label: "Dashboard UI", sub: "inspect · replay", icon: Eye },
];

export function LandingArchitecture() {
  return (
    <section id="architecture" className="relative border-b border-border/60 py-24">
      <div className={`mx-auto max-w-7xl ${LANDING_SECTION_PAD}`}>
        <SectionHeader
          eyebrow="ARCHITECTURE / 01"
          title="Event-driven, serverless by design."
          desc="A single ingest path from public webhook providers through API Gateway and Lambda into S3 durable storage and DynamoDB metadata."
        />
        <div className="mt-14">
          <div className="rounded-xl border border-border bg-card/40 p-6 sm:p-10">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-5 md:items-stretch">
              {nodes.map((n, i) => (
                <div key={n.label} className="relative">
                  <div className="group flex h-full flex-col rounded-lg border border-border bg-background/60 p-5 transition-colors hover:border-primary/50">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/30">
                        <n.icon className="h-4 w-4" />
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">0{i + 1}</span>
                    </div>
                    <div className="text-sm font-semibold">{n.label}</div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">{n.sub}</div>
                  </div>
                  {i < nodes.length - 1 ? (
                    <div className="hidden md:block">
                      <div className="absolute right-[-14px] top-1/2 z-10 h-px w-7 -translate-y-1/2 bg-gradient-to-r from-primary/60 to-primary/10" />
                      <div className="absolute right-[-18px] top-1/2 z-10 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_var(--primary)] animate-pulse" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 border-t border-border/60 pt-6 text-xs sm:grid-cols-5">
              {[
                "Event-driven ingestion",
                "Payload archival",
                "Queryable metadata",
                "Replay pipeline",
                "Structured logging",
              ].map((l) => (
                <div key={l} className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  <span className="truncate">{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
