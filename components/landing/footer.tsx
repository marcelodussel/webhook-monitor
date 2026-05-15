import { APP_NAME } from "@/lib/config";
import { LANDING_SECTION_PAD } from "./constants";

export function LandingFooter() {
  return (
    <footer className="py-10">
      <div
        className={`mx-auto flex max-w-7xl flex-col items-center justify-center gap-3 text-xs text-muted-foreground sm:flex-row ${LANDING_SECTION_PAD}`}
      >
        <div className="border-b border-border pb-3 font-mono sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
          {APP_NAME.toLowerCase()} · {new Date().getFullYear()}
        </div>
        <div className="font-mono">built with Next.js · TypeScript · AWS SAM</div>
      </div>
    </footer>
  );
}
