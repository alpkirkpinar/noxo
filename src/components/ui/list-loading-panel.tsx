type Props = {
  message?: string
}

export default function ListLoadingPanel({ message = "Yükleniyor..." }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="px-4 py-12 text-center text-sm text-slate-500">{message}</div>
    </div>
  )
}
