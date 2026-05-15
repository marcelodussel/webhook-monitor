import { CheckCircle2 } from "lucide-react";
import { secItems } from "./content";
import { LANDING_SECTION_PAD } from "./constants";
import { SectionHeader } from "./section-header";

export function LandingSecurity() {
  return (
    <section className="border-b border-border/60 py-24">
      <div className={`mx-auto max-w-7xl ${LANDING_SECTION_PAD}`}>
        <SectionHeader
          eyebrow="SECURITY & OPS / 05"
          title="Security-minded defaults."
          desc="Concrete controls from SAM through the app: private encrypted payloads, tokenized ingest, replay header sanitization, and an authenticated app API."
        />
        <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          {secItems.map((s) => (
            <div
              key={s.t}
              className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card/50 p-4 transition-colors hover:border-primary/40"
            >
              <s.icon className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 text-pretty text-sm">{s.t}</span>
              <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-primary/70" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
