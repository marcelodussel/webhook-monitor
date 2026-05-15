import { getRequestFlowLines } from "./content";
import { SectionHeader } from "./section-header";

export function LandingRequestFlow() {
  const flow = getRequestFlowLines();
  return (
    <section className="border-b border-border/60 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader eyebrow="LIFECYCLE / 04" title="A request, end to end." />
        <ol className="relative mt-12">
          <span className="absolute bottom-2 left-[15px] top-2 w-px bg-gradient-to-b from-primary/60 via-border to-transparent" />
          {flow.map((s, i) => (
            <li key={s.t} className="relative grid grid-cols-[32px_auto_1fr] items-start gap-4 py-4">
              <span className="relative z-10 grid h-8 w-8 place-items-center rounded-full border border-primary/40 bg-background font-mono text-[12px] text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="text-md font-semibold">{s.t}</div>
                <div className="font-mono text-[12px] text-muted-foreground">{s.d}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
