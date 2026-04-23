"use client"

import { FormEvent, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { APP_MODULES, ALL_APP_MODULE_KEYS, type AppModuleKey } from "@/lib/permissions"
import type { ManagedCompany } from "@/lib/master-companies"

type CreatedCompany = {
  companyId: string
  companyName: string
  adminFullName: string
  adminEmail: string
  username: string
  initialPassword: string
}

type ApiResponse = {
  companies?: ManagedCompany[]
  company?: CreatedCompany
  error?: string
}

export default function MasterCompaniesClient({
  initialCompanies,
}: {
  initialCompanies: ManagedCompany[]
}) {
  const [companies, setCompanies] = useState(initialCompanies)
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanies[0]?.companyId ?? "")
  const [companyName, setCompanyName] = useState("")
  const [adminFullName, setAdminFullName] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPhone, setAdminPhone] = useState("")
  const [createdCompany, setCreatedCompany] = useState<CreatedCompany | null>(null)
  const [errorText, setErrorText] = useState("")
  const [successText, setSuccessText] = useState("")
  const [saving, setSaving] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)

  const selectedCompany = useMemo(
    () => companies.find((company) => company.companyId === selectedCompanyId) ?? companies[0] ?? null,
    [companies, selectedCompanyId]
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorText("")
    setSuccessText("")
    setCreatedCompany(null)
    setSaving(true)

    try {
      const response = await fetch("/api/master/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          adminFullName,
          adminEmail,
          adminPhone,
        }),
      })

      const data = (await response.json()) as ApiResponse

      if (!response.ok) throw new Error(data.error || "Firma olusturulamadi.")

      if (data.companies) {
        setCompanies(data.companies)
      }

      if (data.company) {
        setCreatedCompany(data.company)
        setSelectedCompanyId(data.company.companyId)
      }

      setCompanyName("")
      setAdminFullName("")
      setAdminEmail("")
      setAdminPhone("")
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Firma olusturulamadi.")
    } finally {
      setSaving(false)
    }
  }

  async function saveCompanySettings(nextCompany: ManagedCompany) {
    setErrorText("")
    setSuccessText("")
    setSettingsSaving(true)

    try {
      const response = await fetch("/api/master/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: nextCompany.companyId,
          companyName: nextCompany.companyName,
          isActive: nextCompany.isActive,
          enabledModules: nextCompany.enabledModules,
        }),
      })

      const data = (await response.json()) as ApiResponse
      if (!response.ok) throw new Error(data.error || "Firma ayarlari kaydedilemedi.")

      if (data.companies) {
        setCompanies(data.companies)
      }

      setSuccessText("Firma ayarlari kaydedildi.")
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Firma ayarlari kaydedilemedi.")
    } finally {
      setSettingsSaving(false)
    }
  }

  function updateSelectedCompany(updater: (company: ManagedCompany) => ManagedCompany) {
    setCompanies((current) =>
      current.map((company) => (company.companyId === selectedCompany?.companyId ? updater(company) : company))
    )
  }

  function toggleModule(moduleKey: AppModuleKey) {
    updateSelectedCompany((company) => {
      const current = new Set(company.enabledModules)
      if (current.has(moduleKey)) {
        current.delete(moduleKey)
      } else {
        current.add(moduleKey)
      }

      return { ...company, enabledModules: Array.from(current) as AppModuleKey[] }
    })
  }

  function setAllModules(enabled: boolean) {
    updateSelectedCompany((company) => ({
      ...company,
      enabledModules: enabled ? [...ALL_APP_MODULE_KEYS] : [],
    }))
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <form onSubmit={handleSubmit} className="elevated-surface rounded-2xl bg-white p-5">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-950">Yeni Firma Olustur</h2>
              <p className="mt-1 text-sm text-slate-500">
                Firma icin ayri company id ve ilk yonetici hesabi acilir.
              </p>
            </div>

            <div className="space-y-4">
              <Field label="Firma adi">
                <input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  required
                />
              </Field>

              <Field label="Yonetici adi soyadi">
                <input
                  value={adminFullName}
                  onChange={(event) => setAdminFullName(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  required
                />
              </Field>

              <Field label="Yonetici e-posta">
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  required
                />
              </Field>

              <Field label="Telefon">
                <input
                  value={adminPhone}
                  onChange={(event) => setAdminPhone(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                />
              </Field>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Olusturuluyor..." : "Firmayi Olustur"}
            </button>
          </form>

          <div className="elevated-surface overflow-hidden rounded-2xl bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-950">Firmalar</h2>
              <p className="mt-1 text-sm text-slate-500">{companies.length} firma listeleniyor.</p>
            </div>
            <div className="max-h-[520px] divide-y divide-slate-200 overflow-y-auto">
              {companies.length > 0 ? (
                companies.map((company) => {
                  const active = company.companyId === selectedCompany?.companyId

                  return (
                    <button
                      key={company.companyId}
                      type="button"
                      onClick={() => setSelectedCompanyId(company.companyId)}
                      className={`block w-full px-5 py-4 text-left transition ${
                        active ? "bg-slate-100" : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-950">{company.companyName}</div>
                          <div className="mt-1 break-all font-mono text-[11px] text-slate-500">
                            {company.companyId}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            company.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {company.isActive ? "Aktif" : "Pasif"}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                        <span>{company.userCount} kullanici</span>
                        <span>{company.enabledModules.length} modul acik</span>
                        <span>{company.logs.length} log</span>
                      </div>
                    </button>
                  )
                })
              ) : (
                <div className="px-5 py-8 text-sm text-slate-500">Kayitli firma bulunamadi.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5">
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

          {createdCompany ? (
            <div className="elevated-surface rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <h2 className="text-lg font-semibold text-emerald-950">Firma Olusturuldu</h2>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <Credential label="Firma" value={createdCompany.companyName} />
                <Credential label="Company ID" value={createdCompany.companyId} mono />
                <Credential label="Yonetici" value={createdCompany.adminFullName} />
                <Credential label="E-posta" value={createdCompany.adminEmail} />
                <Credential label="Kullanici adi" value={createdCompany.username} mono />
                <Credential label="Gecici sifre" value={createdCompany.initialPassword} mono />
              </div>
            </div>
          ) : null}

          {selectedCompany ? (
            <CompanyDetail
              company={selectedCompany}
              settingsSaving={settingsSaving}
              onNameChange={(value) =>
                updateSelectedCompany((company) => ({ ...company, companyName: value }))
              }
              onActiveChange={(value) =>
                updateSelectedCompany((company) => ({ ...company, isActive: value }))
              }
              onToggleModule={toggleModule}
              onSetAllModules={setAllModules}
              onSave={() => void saveCompanySettings(selectedCompany)}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CompanyDetail({
  company,
  settingsSaving,
  onNameChange,
  onActiveChange,
  onToggleModule,
  onSetAllModules,
  onSave,
}: {
  company: ManagedCompany
  settingsSaving: boolean
  onNameChange: (value: string) => void
  onActiveChange: (value: boolean) => void
  onToggleModule: (module: AppModuleKey) => void
  onSetAllModules: (enabled: boolean) => void
  onSave: () => void
}) {
  const enabled = new Set(company.enabledModules)

  return (
    <div className="space-y-5">
      <section className="elevated-surface rounded-2xl bg-white p-5">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Firma Detayi</h2>
            <div className="mt-1 break-all font-mono text-xs text-slate-500">{company.companyId}</div>
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={settingsSaving}
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {settingsSaving ? "Kaydediliyor..." : "Ayarlari Kaydet"}
          </button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_220px]">
          <Field label="Firma adi">
            <input
              value={company.companyName}
              onChange={(event) => onNameChange(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
            />
          </Field>

          <label className="flex h-full min-h-[72px] items-center justify-between rounded-xl border border-slate-200 px-4">
            <span>
              <span className="block text-sm font-semibold text-slate-900">Firma Durumu</span>
              <span className="mt-1 block text-xs text-slate-500">{company.isActive ? "Aktif" : "Pasif"}</span>
            </span>
            <input
              type="checkbox"
              checked={company.isActive}
              onChange={(event) => onActiveChange(event.target.checked)}
              className="h-5 w-5 rounded border-slate-300"
            />
          </label>
        </div>

        <div className="mt-6">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Kullanilabilir Moduller</h3>
              <p className="mt-1 text-xs text-slate-500">
                Kapali moduller menu ve route yetkilerinde devre disi kalir.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onSetAllModules(true)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Tumunu Ac
              </button>
              <button
                type="button"
                onClick={() => onSetAllModules(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Tumunu Kapat
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {APP_MODULES.map((module) => (
              <label
                key={module.key}
                className={`flex min-h-[72px] items-center justify-between rounded-xl border px-4 py-3 transition ${
                  enabled.has(module.key)
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <span className="text-sm font-semibold text-slate-900">{module.label}</span>
                <input
                  type="checkbox"
                  checked={enabled.has(module.key)}
                  onChange={() => onToggleModule(module.key)}
                  className="h-5 w-5 rounded border-slate-300"
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="elevated-surface rounded-2xl bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Kullanicilar</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {company.users.map((user) => (
            <div key={user.id} className="rounded-xl border border-slate-200 px-3 py-3">
              <div className="text-sm font-semibold text-slate-900">
                {user.fullName || "Isimsiz Kullanici"}
              </div>
              <div className="mt-1 text-xs text-slate-500">{user.email || "-"}</div>
              {user.title ? <div className="mt-1 text-xs text-slate-400">{user.title}</div> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="elevated-surface rounded-2xl bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Firma Loglari</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          {company.logs.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {company.logs.map((log) => (
                <div key={log.id} className="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[180px_1fr_220px]">
                  <div>
                    <div className="font-medium text-slate-900">{formatDate(log.createdAt)}</div>
                    <div className="mt-1 text-xs text-slate-500">{log.userName || "Sistem"}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{log.actionName || "-"}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {[log.moduleName, log.recordType, log.recordId].filter(Boolean).join(" / ") || "-"}
                    </div>
                  </div>
                  <div className="break-words text-xs text-slate-500">{log.detail || "-"}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-sm text-slate-500">Bu firma icin log bulunamadi.</div>
          )}
        </div>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}

function Credential({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-white/80 px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">{label}</div>
      <div className={`mt-1 break-all text-sm text-slate-950 ${mono ? "font-mono" : "font-medium"}`}>
        {value}
      </div>
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) return "-"

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}
