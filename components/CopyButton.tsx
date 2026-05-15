"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label = "Copy",
  variant = "outline",
  size = "sm",
  className,
  iconOnly = false,
  "aria-label": ariaLabel,
}: {
  value: string;
  label?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  iconOnly?: boolean;
  "aria-label"?: string;
}) {
  const [copied, setCopied] = useState(false);
  const resolvedVariant = iconOnly ? "ghost" : variant;
  const resolvedSize = iconOnly ? "icon" : size;
  const iconLabel = copied ? "Copied" : (ariaLabel ?? label);

  if (iconOnly) {
    return (
      <span className="inline-flex shrink-0 items-center">
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {copied ? "Copied to clipboard" : ""}
        </span>
        <Button
          type="button"
          variant={resolvedVariant}
          size={resolvedSize}
          title={iconLabel}
          aria-label={iconLabel}
          className={cn("h-7 w-7 shrink-0", className)}
          onClick={async (e) => {
            e.stopPropagation();
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {}
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant={resolvedVariant}
      size={resolvedSize}
      className={cn("gap-1.5", className)}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      <span className="text-xs">{copied ? "Copied" : label}</span>
    </Button>
  );
}
