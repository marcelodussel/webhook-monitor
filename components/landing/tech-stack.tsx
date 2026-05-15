import { Cloud } from "lucide-react";
import { stackGroups } from "./content";
import { LANDING_SECTION_PAD } from "./constants";
import { SectionHeader } from "./section-header";

export function LandingTechStack() {
  return (
    <section id="stack" className="border-b border-border/60 py-24">
      <div className={`mx-auto max-w-7xl ${LANDING_SECTION_PAD}`}>
        <SectionHeader eyebrow="STACK / 07" title="Built on AWS primitives and modern technologies." />
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          {stackGroups.map((g) => (
            <div
              key={g.group}
              className={`rounded-xl border p-6 ${
                g.emphasis
                  ? "border-primary/30 bg-card/80 shadow-[inset_0_1px_0_color-mix(in_oklab,var(--primary)_15%,transparent)]"
                  : "border-border bg-card/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {g.group}
                </span>
                {g.emphasis ? <Cloud className="h-4 w-4 text-primary" /> : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {g.items.map((item) => (
                  <span
                    key={item}
                    className={`rounded-md border px-3 py-1.5 font-mono text-xs ${
                      g.emphasis
                        ? "border-primary/30 bg-primary/10 text-foreground"
                        : "border-border bg-background/60 text-muted-foreground"
                    }`}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
