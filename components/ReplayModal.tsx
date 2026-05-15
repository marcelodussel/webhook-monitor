"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { replayEvent } from "@/lib/apiClient";

export function ReplayModal({
  eventId,
  defaultUrl,
  open,
  onOpenChange,
  onReplayed,
  previewDisabled = false,
}: {
  eventId: string;
  defaultUrl?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onReplayed?: () => void;
  previewDisabled?: boolean;
}) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

  // Reset the URL field whenever the dialog transitions from closed -> open.
  // Computing during render (instead of in useEffect) avoids a flash of stale state.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setUrl(defaultUrl ?? "");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (previewDisabled) return;
    const destinationUrl = url.trim();
    if (!destinationUrl || !eventId) return;
    setSubmitting(true);
    try {
      const result = await replayEvent({ eventId, destinationUrl });
      if (result.ok) {
        toast.success("Event replayed", {
          description: `POST ${destinationUrl} -> ${result.statusCode}`,
        });
      } else {
        toast.error("Destination rejected replay", {
          description: result.statusCode ? `HTTP ${result.statusCode}` : "Network error",
        });
      }
      onReplayed?.();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Replay request failed", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Replay event</DialogTitle>
            <DialogDescription>
              Re-send this event&apos;s payload to a destination URL. Sensitive and hop-by-hop
              headers will be stripped.
              {previewDisabled && (
                <span className="mt-2 block text-amber-900/90 dark:text-amber-100/90">
                  Replay is not available in preview mode. Configure your API key in Settings.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="dest">Destination URL</Label>
            <Input
              id="dest"
              type="url"
              required
              placeholder="https://app.example.com/webhooks/in"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !url.trim() || previewDisabled}>
              {submitting ? "Replaying…" : "Replay"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
