import { Boxes } from "lucide-react";
import { getLandingDecisions } from "./content";
import { LANDING_GRID_CLASS, LANDING_SECTION_PAD } from "./constants";
import { SectionHeader } from "./section-header";

export function LandingDecisions() {
  const decisions = getLandingDecisions();
  return (
    <section id="decisions" className="relative border-b border-border/60 py-24">
      <div
        className={`pointer-events-none absolute inset-0 ${LANDING_GRID_CLASS} opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]`}
      />
      <div className={`relative mx-auto max-w-7xl ${LANDING_SECTION_PAD}`}>
        <SectionHeader
          eyebrow="ENGINEERING / 03"
          title="Architecture tradeoffs, made explicit."
          desc="Why each AWS primitive was chosen, and the decisions behind the system."
        />
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {decisions.map((d, i) => (
            <div
              key={d.title}
              className="group rounded-xl border border-border bg-card/60 p-7 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  decision · 0{i + 1}
                </span>
                <Boxes className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="mt-3 text-lg font-semibold">{d.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{d.body}</p>
              <pre className="mt-5 overflow-x-auto rounded-md border border-border/70 bg-background/60 p-3 font-mono text-[11px] text-muted-foreground">
                <span className="text-primary">$</span> {d.code}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
