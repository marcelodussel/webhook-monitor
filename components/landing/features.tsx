import { landingFeatures } from "./content";
import { SectionHeader } from "./section-header";

export function LandingFeatures() {
  return (
    <section id="features" className="border-b border-border/60 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="CAPABILITIES / 02"
          title="Designed as a self-hosted platform you can deploy and manage."
        />
        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {landingFeatures.map((f) => (
            <div key={f.title} className="group relative bg-card/60 p-6 transition-colors hover:bg-card">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/30">
                <f.icon className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              <div className="absolute inset-x-6 bottom-4 h-px bg-gradient-to-r from-primary/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
