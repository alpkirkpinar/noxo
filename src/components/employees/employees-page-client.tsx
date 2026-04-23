"use client"

import { useEffect, useState } from "react"
import EmployeeCards, { type Employee } from "@/components/employees/employee-cards"
import ListLoadingPanel from "@/components/ui/list-loading-panel"

export default function EmployeesPageClient() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState("")

  useEffect(() => {
    let active = true

    async function loadEmployees() {
      try {
        setLoading(true)
        setErrorText("")

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
  }, [])

  if (errorText) {
    return <div className="text-sm text-red-600">{errorText}</div>
  }

  if (loading) {
    return <ListLoadingPanel message="Calisanlar yukleniyor..." />
  }

  return <EmployeeCards employees={employees} />
}
