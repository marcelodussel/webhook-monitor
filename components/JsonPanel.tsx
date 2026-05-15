"use client";

import { useMemo } from "react";
import { CopyButton } from "./CopyButton";

function tryParse(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

function highlight(json: string) {
  // Lightweight JSON syntax highlight (no deps)
  const escaped = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "text-[oklch(0.78_0.16_75)]";
      if (/^"/.test(match)) {
        cls = /:$/.test(match)
          ? "text-[oklch(0.78_0.16_155)]"
          : "text-[oklch(0.8_0.13_45)]";
      } else if (/true|false/.test(match)) {
        cls = "text-[oklch(0.7_0.16_240)]";
      } else if (/null/.test(match)) {
        cls = "text-muted-foreground";
      }
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

export function JsonPanel({
  raw,
  title = "Body",
  subtitle,
}: {
  raw: string;
  title?: string;
  subtitle?: string;
}) {
  const parsed = useMemo(() => tryParse(raw), [raw]);
  const display = useMemo(
    () => (parsed.ok ? JSON.stringify(parsed.value, null, 2) : raw),
    [parsed, raw],
  );
  const html = useMemo(() => (parsed.ok ? highlight(display) : null), [parsed, display]);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-3 border-b px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{title}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {parsed.ok ? "application/json" : "text/plain"}
            </span>
          </div>
          {subtitle ? (
            <p className="mt-1 text-xs leading-snug text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <CopyButton value={display} className="shrink-0" />
      </div>
      <pre className="max-h-[480px] overflow-auto p-4 font-mono text-xs leading-relaxed">
        {html ? (
          <code dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <code>{display}</code>
        )}
      </pre>
    </div>
  );
}
