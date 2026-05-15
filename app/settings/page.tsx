"use client";

import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LS_KEY = "hookline.apiKey";

// Subscribe to cross-tab `storage` events so the value stays in sync if changed
// from another window.
function subscribeToStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function readApiKey() {
  return window.localStorage.getItem(LS_KEY) ?? "";
}

export default function SettingsPage() {
  // Bridge localStorage into React state without a setState-in-effect dance.
  // `getServerSnapshot` returns "" so SSR and the first client render agree.
  const storedApiKey = useSyncExternalStore(subscribeToStorage, readApiKey, () => "");
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const apiKey = draftKey ?? storedApiKey;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    window.localStorage.setItem(LS_KEY, apiKey);
    setDraftKey(null);
    toast.success("API key saved locally");
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Setting up the API key here allows the dashboard to call the API directly from the browser. <br />
        No proxy routes to deploy or keep in sync.
      </p>

      <form onSubmit={save} className="mt-8 max-w-xl rounded-xl border bg-card p-6">
        <Label htmlFor="apiKey">API key</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Use this key to authenticate against the Hookline API.
        </p>
        <Input
          id="apiKey"
          type="password"
          autoComplete="off"
          className="mt-3 font-mono"
          placeholder="hk_live_••••••••••••••••"
          value={apiKey}
          onChange={(e) => setDraftKey(e.target.value)}
        />
        <div className="mt-4 flex justify-end">
          <Button type="submit">Save</Button>
        </div>
      </form>
    </AppShell>
  );
}
