export default function UnauthorizedPage() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
      <h1 className="text-xl font-semibold">Yetkiniz yok</h1>
      <p className="mt-2 text-sm">
        Bu sayfayı görüntülemek için gerekli yetki hesabınıza tanımlı değil.
      </p>
    </div>
  )
}
