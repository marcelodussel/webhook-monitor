import type { EventStatus } from "@/types/webhook";
import { cn } from "@/lib/utils";

const styles: Record<EventStatus, string> = {
  received: "bg-muted text-muted-foreground border-border",
  processed: "bg-success/15 text-success border-success/30",
  failed: "bg-destructive/15 text-destructive border-destructive/40",
  replayed: "bg-info/15 text-info border-info/30",
};

export function StatusBadge({ status, className }: { status: EventStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
        styles[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
