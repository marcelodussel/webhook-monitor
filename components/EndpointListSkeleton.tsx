import { Skeleton } from "@/components/ui/skeleton";

function EndpointCardSkeleton() {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-5 w-40 max-w-[80%]" />
          <Skeleton className="h-3 w-48 max-w-[90%]" />
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <Skeleton className="h-9 w-full sm:w-[9.5rem]" />
          <Skeleton className="h-10 w-10 shrink-0 rounded-md sm:h-9 sm:w-9" />
        </div>
      </div>
      <div className="mt-4 flex min-w-0 flex-col gap-2 rounded-md border bg-background/50 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
        <Skeleton className="h-3 w-12 shrink-0 sm:w-14" />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Skeleton className="h-4 min-w-0 flex-1" />
          <Skeleton className="h-10 w-10 shrink-0 rounded-md sm:h-9 sm:w-9" />
        </div>
      </div>
      <Skeleton className="mt-3 h-3 w-3/4 max-w-md" />
    </div>
  );
}

export function EndpointListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading endpoints">
      {Array.from({ length: 3 }).map((_, i) => (
        <EndpointCardSkeleton key={i} />
      ))}
    </div>
  );
}
