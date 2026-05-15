import Link from "next/link";
import { ArrowRight, Code2 } from "lucide-react";
import { GITHUB_REPO_URL } from "@/lib/config";
import { LANDING_GRID_CLASS, LANDING_SECTION_PAD } from "./constants";

export function LandingFinalCta() {
  return (
    <section className="relative overflow-hidden border-b border-border/60 py-28">
      <div
        className={`pointer-events-none absolute inset-0 ${LANDING_GRID_CLASS} opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]`}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(40% 60% at 50% 50%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 70%)",
        }}
      />
      <div className={`relative mx-auto max-w-3xl text-center ${LANDING_SECTION_PAD}`}>
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
          Cloud-native webhook infrastructure built for <span className="text-primary">observability</span>.
        </h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open Dashboard <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/endpoints"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card/50 px-5 py-2.5 text-sm font-medium hover:bg-accent"
          >
            Create endpoint
          </Link>
          {GITHUB_REPO_URL ? (
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card/50 px-5 py-2.5 text-sm font-medium hover:bg-accent"
            >
              <Code2 className="h-4 w-4" /> View Source
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
