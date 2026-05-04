export default function TicketsLoading() {
  return (
    <div className="space-y-6">
      <div className="relative z-10 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="h-11 min-w-0 flex-1 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-slate-200 sm:w-44" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-slate-200 sm:w-40" />

          <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:grid-flow-col sm:auto-cols-max sm:grid-cols-none">
            <div className="h-11 w-full animate-pulse rounded-xl bg-slate-100 sm:w-24" />
            <div className="h-11 w-full animate-pulse rounded-xl bg-slate-100 sm:w-24" />
            <div className="h-11 w-full animate-pulse rounded-xl bg-slate-900/20 sm:w-20" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                {Array.from({ length: 8 }, (_, index) => (
                  <th key={index} className="px-4 py-3 text-left">
                    <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {Array.from({ length: 8 }, (_, rowIndex) => (
                <tr key={rowIndex} className="border-b border-slate-200 last:border-b-0">
                  <td className="px-4 py-4">
                    <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
                    <div className="mt-2 h-3 w-64 animate-pulse rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-6 w-24 animate-pulse rounded-full bg-slate-200" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
