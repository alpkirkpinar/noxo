"use client"

import { useEffect, useState } from "react"
import EmployeeCards, { type Employee } from "@/components/employees/employee-cards"
import ListLoadingPanel from "@/components/ui/list-loading-panel"
import { createClient } from "@/lib/supabase/client"

export default function EmployeesPageClient() {
  const supabase = createClient()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState("")

  useEffect(() => {
    let active = true

    async function loadEmployees() {
      try {
        setLoading(true)
        setErrorText("")

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          throw new Error("Kullanici bulunamadi.")
        }

        const response = await fetch("/api/employees", { cache: "no-store" })
        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data?.error || "Calisanlar alinamadi.")
        }

        if (!active) return
        setEmployees(Array.isArray(data.employees) ? data.employees : [])
      } catch (error: unknown) {
        if (!active) return
        setErrorText(error instanceof Error ? error.message : "Calisanlar alinamadi.")
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadEmployees()

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (errorText) {
    return <div className="text-sm text-red-600">{errorText}</div>
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Calisanlar</h1>
          <p className="mt-1 text-sm text-slate-500">Calisan bilgileri, giris hesaplari ve yetkileri</p>
        </div>
        <ListLoadingPanel message="Calisanlar yukleniyor..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Calisanlar</h1>
        <p className="mt-1 text-sm text-slate-500">Calisan bilgileri, giris hesaplari ve yetkileri</p>
      </div>
      <EmployeeCards employees={employees} />
    </div>
  )
}
