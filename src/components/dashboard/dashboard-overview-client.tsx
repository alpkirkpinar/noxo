"use client"

import DashboardCalendar from "@/components/dashboard/dashboard-calendar"
import Link from "next/link"
import type { ReactNode } from "react"

type TicketRow = {
  id: string
  ticket_no: string | null
  title: string | null
  status: string | null
  created_at: string | null
  customers?: {
    company_name: string | null
  } | { company_name: string | null }[] | null
}

type ServiceFormRow = {
  id: string
  service_date: string | null
  created_at: string | null
  customers?: {
    company_name: string | null
  } | { company_name: string | null }[] | null
}

type Props = {
  totalTickets: number
  activeTickets: number
  totalCustomers: number
  totalMachines: number
  totalServiceForms: number
  latestTickets: TicketRow[]
  latestServiceForms: ServiceFormRow[]
  canViewTickets: boolean
  canViewServiceForms: boolean
  canManageCalendar: boolean
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("tr-TR").format(date)
}

function getCustomerName(customer: TicketRow["customers"] | ServiceFormRow["customers"]) {
  if (!customer) return "-"
  if (Array.isArray(customer)) return customer[0]?.company_name || "-"
  return customer.company_name || "-"
}

function statusLabel(status: string | null | undefined) {
  switch (status) {
    case "new":
      return "Yeni"
    case "assigned":
      return "Atandı"
    case "investigating":
      return "İnceleniyor"
    case "waiting_offer":
      return "Teklif Bekleniyor"
    case "waiting_parts":
      return "Parça Bekleniyor"
    case "in_progress":
      return "İşlemde"
    case "completed":
      return "Tamamlandı"
    case "cancelled":
      return "İptal Edildi"
    default:
      return status || "-"
  }
}

function statusBadgeClass(status: string | null | undefined) {
  switch (status) {
    case "new":
      return "bg-blue-50 text-blue-700 ring-blue-200"
    case "assigned":
      return "bg-indigo-50 text-indigo-700 ring-indigo-200"
    case "investigating":
      return "bg-amber-50 text-amber-700 ring-amber-200"
    case "waiting_offer":
      return "bg-orange-50 text-orange-700 ring-orange-200"
    case "waiting_parts":
      return "bg-yellow-50 text-yellow-700 ring-yellow-200"
    case "in_progress":
      return "bg-sky-50 text-sky-700 ring-sky-200"
    case "completed":
      return "bg-green-50 text-green-700 ring-green-200"
    case "cancelled":
      return "bg-red-50 text-red-700 ring-red-200"
    default:
      return "bg-gray-50 text-gray-700 ring-gray-200"
  }
}

function MaybeLink({
  href,
  enabled,
  children,
}: {
  href: string
  enabled: boolean
  children: ReactNode
}) {
  if (!enabled) {
    return (
      <div className="border-b border-slate-200 px-4 py-3 last:border-b-0">
        {children}
      </div>
    )
  }

  return (
    <Link
      href={href}
      className="block cursor-pointer border-b border-slate-200 px-4 py-3 last:border-b-0 transition-all duration-150 hover:bg-slate-200/80 hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]"
    >
      {children}
    </Link>
  )
}

const dashboardAccentClass = "bg-slate-900 text-white"

export default function DashboardOverviewClient({
  totalTickets,
  activeTickets,
  totalCustomers,
  totalMachines,
  totalServiceForms,
  latestTickets,
  latestServiceForms,
  canViewTickets,
  canViewServiceForms,
  canManageCalendar,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-1 xl:gap-4">
        <div className={`flex flex-col items-center text-center min-w-0 rounded-xl border border-slate-800 px-1 py-1.5 shadow-sm xl:rounded-2xl xl:p-4 ${dashboardAccentClass}`}>
          <div className="text-[clamp(6px,2vw,8px)] font-medium leading-tight text-slate-300 min-[390px]:text-[9px] xl:text-sm">
            <span className="xl:hidden">Ticket</span>
            <span className="hidden xl:inline">Toplam Ticket</span>
          </div>
          <div className="mt-0.5 text-lg font-semibold leading-none tracking-tight text-white min-[390px]:text-xl xl:mt-2 xl:text-4xl">
            {totalTickets}
          </div>
          <div className="mt-0.5 text-[clamp(6px,2vw,8px)] leading-tight text-slate-300 min-[390px]:text-[9px] xl:mt-2 xl:text-sm">
            <span className="xl:hidden">Aktif ticket</span>
            <span className="hidden xl:inline">{activeTickets} aktif ticket</span>
          </div>
        </div>

        <div className={`flex flex-col items-center text-center min-w-0 rounded-xl border border-slate-800 px-1 py-1.5 shadow-sm xl:rounded-2xl xl:p-4 ${dashboardAccentClass}`}>
          <div className="text-[clamp(6px,2vw,8px)] font-medium leading-tight text-slate-300 min-[390px]:text-[9px] xl:text-sm">
            <span className="xl:hidden">Makine</span>
            <span className="hidden xl:inline">Toplam Makine</span>
          </div>
          <div className="mt-0.5 text-lg font-semibold leading-none tracking-tight text-white min-[390px]:text-xl xl:mt-2 xl:text-4xl">
            {totalMachines}
          </div>
          <div className="mt-0.5 text-[clamp(6px,2vw,8px)] leading-tight text-slate-300 min-[390px]:text-[9px] xl:mt-2 xl:text-sm">
            <span className="xl:hidden">Kayıtlı makine</span>
            <span className="hidden xl:inline">Şirkete bağlı kayıtlı makine</span>
          </div>
        </div>

        <div className={`flex flex-col items-center text-center min-w-0 rounded-xl border border-slate-800 px-1 py-1.5 shadow-sm xl:rounded-2xl xl:p-4 ${dashboardAccentClass}`}>
          <div className="text-[clamp(6px,2vw,8px)] font-medium leading-tight text-slate-300 min-[390px]:text-[9px] xl:text-sm">
            <span className="xl:hidden">Müşteri</span>
            <span className="hidden xl:inline">Toplam Müşteri</span>
          </div>
          <div className="mt-0.5 text-lg font-semibold leading-none tracking-tight text-white min-[390px]:text-xl xl:mt-2 xl:text-4xl">
            {totalCustomers}
          </div>
          <div className="mt-0.5 text-[clamp(6px,2vw,8px)] leading-tight text-slate-300 min-[390px]:text-[9px] xl:mt-2 xl:text-sm">
            <span className="xl:hidden">Kayıtlı müşteri</span>
            <span className="hidden xl:inline">Şirkete bağlı kayıtlı müşteri</span>
          </div>
        </div>

        <div className={`flex flex-col items-center text-center min-w-0 rounded-xl border border-slate-800 px-1 py-1.5 shadow-sm xl:rounded-2xl xl:p-4 ${dashboardAccentClass}`}>
          <div className="text-[clamp(6px,2vw,8px)] font-medium leading-tight text-slate-300 min-[390px]:text-[9px] xl:text-sm">
            <span className="xl:hidden">Form</span>
            <span className="hidden xl:inline">Formlar</span>
          </div>
          <div className="mt-0.5 text-lg font-semibold leading-none tracking-tight text-white min-[390px]:text-xl xl:mt-2 xl:text-4xl">
            {totalServiceForms}
          </div>
          <div className="mt-0.5 text-[clamp(6px,2vw,8px)] leading-tight text-slate-300 min-[390px]:text-[9px] xl:mt-2 xl:text-sm">
            <span className="xl:hidden">Form kaydı</span>
            <span className="hidden xl:inline">Toplam form kaydı</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
          <div className={`flex items-center justify-between border-b border-slate-800 px-4 py-3 ${dashboardAccentClass}`}>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white">
                Son Ticketlar
              </h2>
              <p className="mt-1 text-sm text-slate-300">Güncel operasyon akışı</p>
            </div>

            {canViewTickets ? (
              <Link
                href="/dashboard/tickets"
                className="rounded-xl border border-white/25 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                Tümünü Gör
              </Link>
            ) : null}
          </div>

          {latestTickets.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">Henüz kayıt yok.</div>
          ) : (
            <div>
              {latestTickets.map((ticket) => (
                <MaybeLink
                  key={ticket.id}
                  href={`/dashboard/tickets/${ticket.id}`}
                  enabled={canViewTickets}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-slate-900">
                        {ticket.ticket_no || "Ticket"}
                      </div>
                      <div className="mt-1 line-clamp-1 text-sm text-slate-800">
                        {ticket.title || "-"}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {getCustomerName(ticket.customers)}
                      </div>
                    </div>

                    <span
                      className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusBadgeClass(ticket.status)}`}
                    >
                      {statusLabel(ticket.status)}
                    </span>
                  </div>
                </MaybeLink>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
          <div className={`flex items-center justify-between border-b border-slate-800 px-4 py-3 ${dashboardAccentClass}`}>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white">
                Son Formlar
              </h2>
              <p className="mt-1 text-sm text-slate-300">Güncel form kayıtları</p>
            </div>

            {canViewServiceForms ? (
              <Link
                href="/dashboard/service-forms"
                className="rounded-xl border border-white/25 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                Tümünü Gör
              </Link>
            ) : null}
          </div>

          {latestServiceForms.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">Henüz kayıt yok.</div>
          ) : (
            <div>
              {latestServiceForms.map((form) => (
                <MaybeLink
                  key={form.id}
                  href={`/dashboard/service-forms/${form.id}`}
                  enabled={canViewServiceForms}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-slate-900">
                        Form
                      </div>
                      <div className="mt-1 line-clamp-1 text-sm text-slate-800">
                        {getCustomerName(form.customers)}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {formatDate(form.service_date ?? form.created_at)}
                      </div>
                    </div>
                  </div>
                </MaybeLink>
              ))}
            </div>
          )}
        </div>
      </div>

      <DashboardCalendar canManageEvents={canManageCalendar} />
    </div>
  )
}
