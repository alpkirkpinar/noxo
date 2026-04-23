"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useDismissFloatingLayer } from "@/hooks/use-dismiss-floating-layer"
import { useTouchContextMenu } from "@/hooks/use-touch-context-menu"

export type Employee = {
  id: string
  auth_user_id?: string | null
  full_name: string
  email?: string | null
  phone?: string | null
  title?: string | null
  permissions?: string[]
  is_super_user?: boolean
}

type Props = {
  employees: Employee[]
}

type EmployeeForm = {
  fullName: string
  email: string
  phone: string
  title: string
}

type ContextMenuState = {
  employeeId: string
  x: number
  y: number
} | null

const EMPTY_FORM: EmployeeForm = {
  fullName: "",
  email: "",
  phone: "",
  title: "",
}

const PERMISSION_GROUPS = [
  {
    title: "Dashboard",
    description: "Genel panel, özetler ve canlı operasyon görünümü",
    permissions: [
      "Dashboard Görüntüleme",
      "Takvime Etkinlik Ekleme ve Düzenleme",
    ],
  },
  {
    title: "Ticketlar",
    description: "Servis talepleri, atama ve durum takibi",
    permissions: [
      "Ticket Görüntüleme",
      "Ticket Oluşturma",
      "Ticket Düzenleme",
      "Ticket Silme",
      "Ticket Atama",
    ],
  },
  {
    title: "Servis Formları",
    description: "Saha formları, imza, PDF ve şablondan form üretimi",
    permissions: [
      "Servis Formu Görüntüleme",
      "Servis Formu Oluşturma",
      "Servis Formu Düzenleme",
      "Servis Formu Silme",
      "Servis Formu PDF Alma",
    ],
  },
  {
    title: "Teklifler",
    description: "Teklif hazırlama, müşteri kalemleri ve PDF çıktıları",
    permissions: [
      "Teklif Görüntüleme",
      "Teklif Oluşturma",
      "Teklif Düzenleme",
      "Teklif Silme",
      "Teklif PDF Alma",
    ],
  },
  {
    title: "Müşteriler",
    description: "Müşteri kartları, kontaklar ve müşteri makineleri",
    permissions: [
      "Müşteri Görüntüleme",
      "Müşteri Oluşturma",
      "Müşteri Düzenleme",
      "Müşteri Silme",
    ],
  },
  {
    title: "Makineler",
    description: "Makine envanteri, seri numarası ve müşteri eşleşmeleri",
    permissions: [
      "Makine Görüntüleme",
      "Makine Oluşturma",
      "Makine Düzenleme",
      "Makine Silme",
    ],
  },
  {
    title: "Depo",
    description: "Stok kartları, hareketler, giriş/çıkış ve raporlar",
    permissions: [
      "Depo Görüntüleme",
      "Stok Kartı Oluşturma",
      "Stok Kartı Düzenleme",
      "Stok Kartı Silme",
      "Stok Giriş",
      "Stok Çıkış",
      "Stok Hareketleri Görüntüleme",
      "CSV Import",
      "CSV Export",
    ],
  },
  {
    title: "Form Şablonları",
    description: "PDF şablonları ve servis formu alan tasarımları",
    permissions: [
      "Form Şablonu Görüntüleme",
      "Form Şablonu Oluşturma",
      "Form Şablonu Düzenleme",
      "Form Şablonu Silme",
    ],
  },
  {
    title: "Yönetim",
    description: "Kullanıcılar, yetkiler ve sistem ayarları",
    permissions: [
      "Çalışan Görüntüleme",
      "Çalışan Oluşturma",
      "Çalışan Bilgisi Düzenleme",
      "Çalışan Silme",
      "Çalışan Yetkisi Düzenleme",
      "Sistem Ayarları",
    ],
  },
]

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((group) => group.permissions)

function normalizePermissions(permissions: string[]) {
  return permissions.filter((permission) => ALL_PERMISSIONS.includes(permission))
}

export default function EmployeeCards({ employees }: Props) {
  const contextMenuRef = useRef<HTMLDivElement | null>(null)
  const [search, setSearch] = useState("")
  const [rowsState, setRowsState] = useState<Employee[]>(employees)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const { activeId, bindRow } = useTouchContextMenu((employeeId, x, y) => {
    setContextMenu({ employeeId, x, y })
  })
  useDismissFloatingLayer([contextMenuRef], () => setContextMenu(null))
  const [newEmployeeOpen, setNewEmployeeOpen] = useState(false)
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null)
  const [permissionsEmployeeId, setPermissionsEmployeeId] = useState<string | null>(null)
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loadingPermissions, setLoadingPermissions] = useState(false)
  const [errorText, setErrorText] = useState("")
  const [successText, setSuccessText] = useState("")
  const [initialPassword, setInitialPassword] = useState("")
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM)
  const [draftPermissions, setDraftPermissions] = useState<string[]>([])

  useEffect(() => {
    setRowsState(employees)
  }, [employees])

  useEffect(() => {
    if (!contextMenu) return

    const close = () => setContextMenu(null)
    window.addEventListener("click", close)
    window.addEventListener("scroll", close, true)

    return () => {
      window.removeEventListener("click", close)
      window.removeEventListener("scroll", close, true)
    }
  }, [contextMenu])

  const rows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR")
    if (!q) return rowsState

    return rowsState.filter((item) =>
      [
        item.full_name,
        item.email ?? "",
        item.phone ?? "",
        item.title ?? "",
        ...(item.permissions ?? []),
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(q)
    )
  }, [rowsState, search])

  const editEmployee = rowsState.find((item) => item.id === editEmployeeId) ?? null
  const permissionsEmployee =
    rowsState.find((item) => item.id === permissionsEmployeeId) ?? null
  const deleteEmployee = rowsState.find((item) => item.id === deleteEmployeeId) ?? null
  const menuEmployee = contextMenu
    ? rowsState.find((item) => item.id === contextMenu.employeeId) ?? null
    : null

  function openCreateModal() {
    setForm(EMPTY_FORM)
    setInitialPassword("")
    resetMessages()
    setNewEmployeeOpen(true)
  }

  function openEditModal(employee: Employee) {
    setForm(toForm(employee))
    resetMessages()
    setContextMenu(null)
    setEditEmployeeId(employee.id)
  }

  async function openPermissionsModal(employee: Employee) {
    setDraftPermissions(normalizePermissions(employee.permissions ?? []))
    resetMessages()
    setContextMenu(null)
    setPermissionsEmployeeId(employee.id)
    setLoadingPermissions(true)

    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "GET",
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Yetkiler alınamadı.")
      }

      const permissions = normalizePermissions(
        Array.isArray(data.permissions) ? data.permissions.map(String) : []
      )
      const isSuperUser = data.isSuperUser === true

      setDraftPermissions(isSuperUser ? ALL_PERMISSIONS : permissions)
      setRowsState((prev) =>
        prev.map((item) =>
          item.id === employee.id
            ? {
                ...item,
                permissions: isSuperUser ? ALL_PERMISSIONS : permissions,
                is_super_user: isSuperUser,
              }
            : item
        )
      )
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Yetkiler alınamadı.")
    } finally {
      setLoadingPermissions(false)
    }
  }

  function openDeleteModal(employee: Employee) {
    resetMessages()
    setContextMenu(null)
    setDeleteEmployeeId(employee.id)
  }

  function resetMessages() {
    setErrorText("")
    setSuccessText("")
  }

  async function handleCreateEmployee() {
    setCreating(true)
    resetMessages()
    setInitialPassword("")

    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Çalışan oluşturulamadı.")
      }

      setRowsState((prev) => [{ ...(data.employee as Employee), permissions: [] }, ...prev])
      setNewEmployeeOpen(false)
      setForm(EMPTY_FORM)
      setInitialPassword(String(data.initialPassword ?? ""))
      setSuccessText("Çalışan oluşturuldu. Başlangıç şifresini kullanıcıya manuel olarak iletin.")
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Çalışan oluşturulamadı.")
    } finally {
      setCreating(false)
    }
  }

  async function handleUpdateEmployee() {
    if (!editEmployee) return

    setSaving(true)
    resetMessages()

    try {
      const response = await fetch(`/api/employees/${editEmployee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Çalışan güncellenemedi.")
      }

      setRowsState((prev) =>
        prev.map((item) => (item.id === editEmployee.id ? (data.employee as Employee) : item))
      )
      setEditEmployeeId(null)
      setSuccessText("Çalışan bilgileri güncellendi.")
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Çalışan güncellenemedi.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePermissions() {
    if (!permissionsEmployee) return

    setSaving(true)
    resetMessages()

    try {
      if (permissionsEmployee.is_super_user) {
        throw new Error("Super user yetkileri değiştirilemez.")
      }

      const response = await fetch(`/api/employees/${permissionsEmployee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: normalizePermissions(draftPermissions) }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Yetkiler kaydedilemedi.")
      }

      setRowsState((prev) =>
        prev.map((item) =>
          item.id === permissionsEmployee.id ? (data.employee as Employee) : item
        )
      )
      setPermissionsEmployeeId(null)
      setSuccessText("Çalışan yetkileri güncellendi.")
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Yetkiler kaydedilemedi.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteEmployee() {
    if (!deleteEmployee) return

    setDeleting(true)
    resetMessages()

    try {
      const response = await fetch(`/api/employees/${deleteEmployee.id}`, {
        method: "DELETE",
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Çalışan silinemedi.")
      }

      setRowsState((prev) => prev.filter((item) => item.id !== deleteEmployee.id))
      setDeleteEmployeeId(null)
      setSuccessText("Çalışan silindi.")
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Çalışan silinemedi.")
    } finally {
      setDeleting(false)
    }
  }

  function togglePermission(permission: string) {
    setDraftPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((item) => item !== permission)
        : [...prev, permission]
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full max-w-md">
              <label className="mb-2 block text-sm font-medium text-slate-700">Ara</label>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ad, e-posta, telefon, ünvan, yetki..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500"
              />
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Yeni Çalışan
            </button>
          </div>

          {errorText || successText || initialPassword ? (
            <div className="mt-4 space-y-3">
              {errorText ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorText}
                </div>
              ) : null}

              {successText ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {successText}
                </div>
              ) : null}

              {initialPassword ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <div className="font-semibold">Başlangıç şifresi</div>
                  <div className="mt-1 font-mono text-base">{initialPassword}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            Kayıt bulunamadı.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((employee) => {
              const permissions = employee.permissions ?? []

              return (
                <div
                  key={employee.id}
                  {...bindRow(employee.id)}
                  className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
                    activeId === employee.id ? "bg-slate-100 ring-1 ring-slate-300" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {employee.full_name}
                        </h3>
                        {employee.is_super_user ? (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                            Super User
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {employee.title || "Görev tanımı yok"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect()
                        setContextMenu({
                          employeeId: employee.id,
                          x: rect.left,
                          y: rect.bottom + 6,
                        })
                      }}
                      className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Çalışan işlemleri"
                    >
                      ⋯
                    </button>
                  </div>

                  <div className="mt-5 space-y-2 text-sm text-slate-700">
                    <div>
                      <span className="font-medium text-slate-900">E-posta:</span>{" "}
                      {employee.email || "-"}
                    </div>
                    <div>
                      <span className="font-medium text-slate-900">Telefon:</span>{" "}
                      {employee.phone || "-"}
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 text-sm font-medium text-slate-900">Yetkiler</div>
                    {permissions.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {permissions.slice(0, 4).map((permission) => (
                          <span
                            key={permission}
                            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                          >
                            {permission}
                          </span>
                        ))}
                        {permissions.length > 4 ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            +{permissions.length - 4}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">Yetki tanımlı değil.</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {contextMenu && menuEmployee ? (
        <div
          ref={contextMenuRef}
          className="context-menu-layer fixed w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => openEditModal(menuEmployee)}
            className="block w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Bilgileri Düzenle
          </button>
          <button
            type="button"
            onClick={() => openPermissionsModal(menuEmployee)}
            className="block w-full border-t border-slate-100 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Yetkileri Düzenle
          </button>
          <button
            type="button"
            onClick={() => openDeleteModal(menuEmployee)}
            disabled={menuEmployee.is_super_user}
            className="block w-full border-t border-slate-100 px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          >
            {menuEmployee.is_super_user ? "Super User Silinemez" : "Çalışanı Sil"}
          </button>
        </div>
      ) : null}

      {newEmployeeOpen ? (
        <EmployeeFormModal
          title="Yeni Çalışan"
          description="Kayıt sonrası başlangıç şifresi ekranda gösterilir."
          form={form}
          saving={creating}
          saveText="Çalışanı Oluştur"
          savingText="Oluşturuluyor..."
          onChange={setForm}
          onCancel={() => setNewEmployeeOpen(false)}
          onSave={handleCreateEmployee}
        />
      ) : null}

      {editEmployee ? (
        <EmployeeFormModal
          title="Bilgileri Düzenle"
          description={editEmployee.full_name}
          form={form}
          saving={saving}
          saveText="Kaydet"
          savingText="Kaydediliyor..."
          onChange={setForm}
          onCancel={() => setEditEmployeeId(null)}
          onSave={handleUpdateEmployee}
        />
      ) : null}

      {permissionsEmployee ? (
        <PermissionsModal
          employee={permissionsEmployee}
          draftPermissions={draftPermissions}
          saving={saving}
          loading={loadingPermissions}
          onToggle={togglePermission}
          onSelectAll={() => setDraftPermissions(ALL_PERMISSIONS)}
          onClear={() => setDraftPermissions([])}
          onCancel={() => setPermissionsEmployeeId(null)}
          onSave={handleSavePermissions}
          isSuperUser={permissionsEmployee.is_super_user === true}
        />
      ) : null}

      {deleteEmployee ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-900">Çalışanı Sil</h2>
            <p className="mt-2 text-sm text-slate-600">
              {deleteEmployee.full_name} silinecek. Bu işlem giriş hesabını da kaldırır.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteEmployeeId(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleDeleteEmployee}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Siliniyor..." : "Sil"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function EmployeeFormModal({
  title,
  description,
  form,
  saving,
  saveText,
  savingText,
  onChange,
  onCancel,
  onSave,
}: {
  title: string
  description: string
  form: EmployeeForm
  saving: boolean
  saveText: string
  savingText: string
  onChange: (form: EmployeeForm) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <InputField
            label="Ad Soyad"
            value={form.fullName}
            onChange={(value) => onChange({ ...form, fullName: value })}
          />
          <InputField
            label="E-posta"
            type="email"
            value={form.email}
            onChange={(value) => onChange({ ...form, email: value })}
          />
          <InputField
            label="Telefon"
            value={form.phone}
            onChange={(value) => onChange({ ...form, phone: value })}
          />
          <InputField
            label="Ünvan"
            value={form.title}
            onChange={(value) => onChange({ ...form, title: value })}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? savingText : saveText}
          </button>
        </div>
      </div>
    </div>
  )
}

function PermissionsModal({
  employee,
  draftPermissions,
  saving,
  loading,
  onToggle,
  onSelectAll,
  onClear,
  onCancel,
  onSave,
  isSuperUser,
}: {
  employee: Employee
  draftPermissions: string[]
  saving: boolean
  loading: boolean
  onToggle: (permission: string) => void
  onSelectAll: () => void
  onClear: () => void
  onCancel: () => void
  onSave: () => void
  isSuperUser: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Yetkileri Düzenle</h2>
            <p className="mt-1 text-sm text-slate-500">{employee.full_name}</p>
            {isSuperUser ? (
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Super user tüm yetkilere sahiptir; yetkileri değiştirilemez.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSelectAll}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Tümünü Seç
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={isSuperUser}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Temizle
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Yetkiler yükleniyor...
          </div>
        ) : (
        <div className="space-y-5">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.title} className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-4">
                <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {group.title}
                </div>
                <div className="mt-1 text-sm text-slate-500">{group.description}</div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.permissions.map((permission) => {
                  const checked = isSuperUser || draftPermissions.includes(permission)

                  return (
                    <label
                      key={permission}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(permission)}
                        disabled={isSuperUser}
                        className="mt-0.5 h-4 w-4"
                      />
                      <span className="text-sm text-slate-700">{permission}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || isSuperUser}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  )
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500"
      />
    </div>
  )
}

function toForm(employee: Employee): EmployeeForm {
  return {
    fullName: employee.full_name,
    email: employee.email ?? "",
    phone: employee.phone ?? "",
    title: employee.title ?? "",
  }
}
