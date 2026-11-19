import { Skeleton } from "@/components/ui/skeleton";

export function PageLoadingSkeleton() {
  return (
    <main className="min-h-svh p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </main>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="w-full space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-4 w-[28rem] max-w-full" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="ui-panel space-y-3 p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="ui-panel space-y-3 p-5">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="ui-panel space-y-4 p-5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TablePageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="w-full space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="ui-panel grid gap-3 p-5 sm:grid-cols-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="col-span-full h-10 w-full" />
        </div>
        <div className="ui-panel overflow-hidden">
          <div className="border-b border-border bg-surface-2 px-4 py-3">
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="grid grid-cols-3 gap-4 px-4 py-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InboxSkeleton() {
  return (
    <div className="h-full p-4">
      <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[340px_1fr]">
        <aside className="ui-panel flex min-h-0 flex-col overflow-hidden">
          <div className="space-y-3 border-b border-border px-4 pt-4 pb-3">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="space-y-0 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2 border-b border-border px-4 py-3.5">
                <div className="flex justify-between gap-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </aside>
        <section className="ui-panel flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
          <div className="flex-1 space-y-3 p-5">
            <Skeleton className="ml-auto h-16 w-[55%]" />
            <Skeleton className="h-16 w-[60%]" />
            <Skeleton className="ml-auto h-12 w-[40%]" />
            <Skeleton className="h-20 w-[65%]" />
          </div>
          <div className="flex gap-3 border-t border-border p-4">
            <Skeleton className="h-16 flex-1" />
            <Skeleton className="h-10 w-20 self-end" />
          </div>
        </section>
      </div>
    </div>
  );
}

export function ContactsSkeleton() {
  return (
    <div className="bg-surface flex h-full min-h-0 w-full overflow-hidden">
      <aside className="border-border flex w-full min-h-0 shrink-0 flex-col border-r md:w-[340px] 2xl:w-[412px]">
        <div className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="ml-auto h-5 w-8 rounded-full" />
          <Skeleton className="h-8 w-14 rounded-md" />
        </div>
        <div className="border-border border-b px-3 py-2">
          <Skeleton className="h-8 w-full rounded-md" />
        </div>
        <div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-2 border-b border-border px-3 py-3">
              <div className="flex justify-between gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </aside>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="border-border flex h-12 shrink-0 items-center border-b px-3">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex-1 space-y-3 bg-[var(--surface-2)] p-4">
          <div className="border-border space-y-3 rounded-lg border bg-surface p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
      </section>
    </div>
  );
}

export function InboxesSkeleton() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
        {[0, 1].map((i) => (
          <div key={i} className="ui-panel space-y-4 p-5">
            <div className="flex justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-9 w-28" />
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
