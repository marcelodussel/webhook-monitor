import Link from "next/link";
import { ArrowRight, Code2, Webhook } from "lucide-react";
import { APP_NAME, GITHUB_REPO_URL } from "@/lib/config";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 ring-1 ring-primary/40">
            <Webhook className="h-4 w-4 text-primary" />
          </span>
          <span className="font-mono text-sm font-semibold tracking-tight">
            {APP_NAME.toLowerCase()}
            <span className="text-primary">/</span>
            <span className="text-muted-foreground">infra</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#architecture" className="hover:text-foreground">
            Architecture
          </a>
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#decisions" className="hover:text-foreground">
            Engineering
          </a>
          <a href="#stack" className="hover:text-foreground">
            Stack
          </a>
        </nav>
        <div className="flex items-center gap-2">
          {GITHUB_REPO_URL ? (
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              <Code2 className="h-3.5 w-3.5" /> Source
            </a>
          ) : null}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open dashboard <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </header>
  );
}
