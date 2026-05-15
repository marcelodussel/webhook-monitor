import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function EventNotFound() {
  return (
    <AppShell>
      <div className="rounded-lg border border-dashed bg-card/50 px-6 py-16 text-center">
        <p className="text-sm font-medium">Event not found</p>
        <Link
          href="/dashboard"
          className="mt-3 inline-block text-sm text-primary hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    </AppShell>
  );
}
