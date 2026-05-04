type LoadingVariant = "table" | "cards" | "form" | "detail";

type Props = {
  variant?: LoadingVariant;
  rows?: number;
  columns?: number;
  showHeader?: boolean;
};

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

function FilterSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SkeletonBlock className="h-10 flex-1 sm:h-11" />
        <div className="grid grid-cols-3 gap-2 sm:w-auto sm:grid-flow-col sm:auto-cols-max sm:grid-cols-none">
          <SkeletonBlock className="h-10 w-full sm:h-11 sm:w-24" />
          <SkeletonBlock className="h-10 w-full sm:h-11 sm:w-24" />
          <SkeletonBlock className="h-10 w-full sm:h-11 sm:w-20" />
        </div>
      </div>
    </div>
  );
}

function TableSkeleton({ rows, columns }: { rows: number; columns: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="border-b bg-slate-50">
            <tr>
              {Array.from({ length: columns }).map((_, index) => (
                <th key={index} className="px-4 py-3">
                  <SkeletonBlock className="h-4 w-24" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-slate-100 last:border-b-0">
                {Array.from({ length: columns }).map((__, columnIndex) => (
                  <td key={columnIndex} className="px-4 py-4">
                    <SkeletonBlock className={columnIndex === 0 ? "h-4 w-32" : "h-4 w-24"} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <SkeletonBlock className="h-5 w-3/4" />
              <SkeletonBlock className="h-4 w-1/2" />
            </div>
            <SkeletonBlock className="h-7 w-16 rounded-full" />
          </div>
          <SkeletonBlock className="mt-6 h-16 w-full" />
          <div className="mt-5 flex items-center justify-between">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-4 w-6" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-11 w-full rounded-xl" />
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <SkeletonBlock className="h-10 w-24 rounded-xl" />
        <SkeletonBlock className="h-10 w-28 rounded-xl" />
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <SkeletonBlock className="h-6 w-48" />
        <SkeletonBlock className="h-4 w-3/4" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <SkeletonBlock className="h-6 w-36" />
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function PageLoadingSkeleton({
  variant = "table",
  rows = 8,
  columns = 7,
  showHeader = false,
}: Props) {
  return (
    <div className="space-y-6">
      {showHeader ? (
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-44" />
          <SkeletonBlock className="h-4 w-72 max-w-full" />
        </div>
      ) : null}

      {variant === "table" ? (
        <>
          <FilterSkeleton />
          <TableSkeleton rows={rows} columns={columns} />
        </>
      ) : null}
      {variant === "cards" ? <CardSkeleton rows={rows} /> : null}
      {variant === "form" ? <FormSkeleton /> : null}
      {variant === "detail" ? <DetailSkeleton /> : null}
    </div>
  );
}
