export function SectionHeader({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
}) {
  return (
    <div className="max-w-3xl">
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">{eyebrow}</div>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {desc ? <p className="mt-4 text-base leading-relaxed text-muted-foreground">{desc}</p> : null}
    </div>
  );
}
