"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Zap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CopyButton } from "@/components/CopyButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createEndpoint, deleteEndpoint, sendTestWebhook } from "@/lib/apiClient";
import { fetchEndpointsOrPreview } from "@/lib/readWithPreview";
import { PreviewBanner } from "@/components/PreviewBanner";
import { EndpointListSkeleton } from "@/components/EndpointListSkeleton";
import { INGEST_BASE_URL } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { WebhookEndpoint } from "@/types/webhook";

const createDialogContentClassName = cn(
  "max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:max-h-[85dvh] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:overflow-y-auto max-sm:rounded-b-none max-sm:rounded-t-xl max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[max(env(safe-area-inset-bottom),1rem)]",
);

export default function EndpointsPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [destUrl, setDestUrl] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Avoid synchronous setState directly in effect body (repo eslint rule).
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);
      setIsPreview(false);
      try {
        const { endpoints: eps, isPreview: preview } = await fetchEndpointsOrPreview();
        if (cancelled) return;
        setEndpoints(eps);
        setIsPreview(preview);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    (async () => {
      try {
        const { endpoint } = await createEndpoint({
          name,
          defaultDestinationUrl: destUrl || undefined,
        });
        setEndpoints((prev) => [endpoint, ...prev]);
        toast.success("Endpoint created", { description: endpoint.name });
        setName("");
        setDestUrl("");
        setCreateOpen(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error("Failed to create endpoint", { description: msg });
      }
    })();
  };

  return (
    <AppShell>
      {isPreview && <PreviewBanner />}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Endpoints</h1>
            <p className="mt-1 text-sm text-muted-foreground">
            Each endpoint exposes a stable ingest URL. Point your webhook source at it so deliveries are captured.
            </p>
          </div>
          <DialogTrigger asChild>
            <Button
              className="w-full shrink-0 gap-1.5 sm:w-auto"
              disabled={isPreview}
              title={isPreview ? "Add an API key in Settings to create real endpoints" : undefined}
            >
              <Plus className="h-4 w-4" /> Create endpoint
            </Button>
          </DialogTrigger>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <EndpointListSkeleton />
        ) : endpoints.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
            <p className="text-sm font-medium">No endpoints yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first endpoint to get an ingest URL.
            </p>
            <Button type="button" className="mt-6 gap-1.5" onClick={() => setCreateOpen(true)} disabled={isPreview}>
              <Plus className="h-4 w-4" /> Create endpoint
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {endpoints.map((ep) => {
              const ingest = ep.ingestToken
                ? `${INGEST_BASE_URL}/${ep.id}?token=${encodeURIComponent(ep.ingestToken)}`
                : `${INGEST_BASE_URL}/${ep.id}`;
              return (
                <div key={ep.id} className="min-w-0 rounded-xl border bg-card p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{ep.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Created {new Date(ep.createdAt).toLocaleDateString()} · ID{" "}
                        <span className="font-mono">{ep.id.slice(0, 8)}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 sm:w-auto"
                        disabled={isPreview}
                        title={
                          isPreview
                            ? "Add an API key in Settings to send real test webhooks"
                            : undefined
                        }
                        onClick={async () => {
                          try {
                            const { eventId } = await sendTestWebhook({
                              endpointId: ep.id,
                              ingestToken: ep.ingestToken,
                            });
                            toast.success("Webhook ingested", {
                              description: `Event ${eventId.slice(0, 8)} created. Open the dashboard to view it.`,
                            });
                          } catch (err) {
                            const msg = err instanceof Error ? err.message : String(err);
                            toast.error("Failed to ingest webhook", { description: msg });
                          }
                        }}
                      >
                        <Zap className="h-3.5 w-3.5" /> Simulate incoming
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 min-h-10 min-w-10 self-end text-muted-foreground hover:text-destructive sm:h-9 sm:w-9 sm:min-h-0 sm:min-w-0 sm:self-auto"
                        aria-label="Delete endpoint"
                        disabled={isPreview}
                        title={isPreview ? "Add an API key in Settings to delete endpoints" : undefined}
                        onClick={() => setConfirmDelete(ep.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 flex min-w-0 flex-col gap-2 rounded-md border bg-background/50 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                    <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Ingest
                    </span>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                        <code className="block whitespace-nowrap font-mono text-xs">{ingest}</code>
                      </div>
                      <span className="hidden shrink-0 sm:inline-flex">
                        <CopyButton value={ingest} />
                      </span>
                      <span className="shrink-0 sm:hidden">
                        <CopyButton
                          value={ingest}
                          iconOnly
                          aria-label="Copy ingest URL"
                          className="h-10 w-10"
                        />
                      </span>
                    </div>
                  </div>
                  {ep.defaultDestinationUrl && (
                    <p className="mt-2 break-words text-xs text-muted-foreground">
                      Default replay:{" "}
                      <span className="break-all font-mono">{ep.defaultDestinationUrl}</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogContent className={createDialogContentClassName}>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>New endpoint</DialogTitle>
              <DialogDescription>
                Give the endpoint a name. You can optionally set a default replay URL.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Stripe — production"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dest">Default replay URL (optional)</Label>
                <Input
                  id="dest"
                  type="url"
                  placeholder="https://app.example.com/webhooks/in"
                  value={destUrl}
                  onChange={(e) => setDestUrl(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this endpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the endpoint and permanently deletes all captured events and stored
              webhook payloads for it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                const id = confirmDelete;
                if (!id) return;
                void (async () => {
                  try {
                    await deleteEndpoint({ endpointId: id });
                    setEndpoints((prev) => prev.filter((ep) => ep.id !== id));
                    toast.success("Endpoint deleted");
                    setConfirmDelete(null);
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    toast.error("Failed to delete endpoint", { description: msg });
                  }
                })();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
