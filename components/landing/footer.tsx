import { APP_NAME } from "@/lib/config";

export function LandingFooter() {
  return (
    <footer className="py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-3 px-6 text-xs text-muted-foreground sm:flex-row">
        <div className="font-mono border-r border-border pr-4">
          {APP_NAME.toLowerCase()} · {new Date().getFullYear()}
        </div>
        <div className="font-mono">built with Next.js · TypeScript · AWS SAM</div>
      </div>
    </footer>
  );
}
