import Link from "next/link";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function PreviewBanner({ className }: { className?: string }) {
  return (
    <Alert className={cn("mb-6 border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-100", className)}>
      <AlertTitle>Preview mode</AlertTitle>
      <AlertDescription className="text-sm">
        Sample data only. Add your API key in{" "}
        <Link href="/settings" className="font-medium underline underline-offset-2">
          Settings
        </Link>{" "}
        to use your real endpoints and events.
      </AlertDescription>
    </Alert>
  );
}
