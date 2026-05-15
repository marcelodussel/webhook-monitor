import { CheckCircle2 } from "lucide-react";
import { secItems } from "./content";
import { SectionHeader } from "./section-header";

export function LandingSecurity() {
  return (
    <section className="border-b border-border/60 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="SECURITY & OPS / 05"
          title="Security-minded defaults."
          desc="Concrete controls from SAM through the app: private encrypted payloads, tokenized ingest, replay header sanitization, and an authenticated app API."
        />
        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4">
          {secItems.map((s) => (
            <div
              key={s.t}
              className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-4 transition-colors hover:border-primary/40"
            >
              <s.icon className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm">{s.t}</span>
              <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-primary/70" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
