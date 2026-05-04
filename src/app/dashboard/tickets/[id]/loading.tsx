export default function TicketDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-200" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-200" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex gap-3">
              <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
            </div>
            <div className="mt-5 h-6 w-36 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index}>
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                  <div className="mt-2 h-4 w-40 animate-pulse rounded bg-slate-200" />
                </div>
              ))}
            </div>
            <div className="mt-5 h-28 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        </div>

        <div className="space-y-6">
          {Array.from({ length: 2 }, (_, panelIndex) => (
            <div key={panelIndex} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }, (_, itemIndex) => (
                  <div key={itemIndex} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
