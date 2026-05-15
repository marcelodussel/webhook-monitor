import type { ReactNode } from "react";

export function prettyJson(o: unknown): ReactNode {
  const text = JSON.stringify(o, null, 2);
  const parts = text.split(/("(?:\\.|[^"\\])*"(?:\s*:)?|\b\d+\b|\btrue\b|\bfalse\b|\bnull\b)/g);
  return parts.map((p, i) => {
    if (/^"/.test(p)) {
      const isKey = /:\s*$/.test(p);
      return (
        <span key={i} className={isKey ? "text-info" : "text-primary"}>
          {p}
        </span>
      );
    }
    if (/^\d+$/.test(p))
      return (
        <span key={i} className="text-warning">
          {p}
        </span>
      );
    if (/^(true|false|null)$/.test(p))
      return (
        <span key={i} className="text-warning">
          {p}
        </span>
      );
    return (
      <span key={i} className="text-muted-foreground">
        {p}
      </span>
    );
  });
}
