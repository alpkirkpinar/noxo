"use client"

import { useEffect, useMemo, useState } from "react"

type CalendarEvent = {
  id: string
  title: string
  note: string | null
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  created_at: string
  updated_at: string
}

type EventFormState = {
  id: string | null
  title: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  note: string
}

type Props = {
  canManageEvents?: boolean
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function getIsoWeek(date: Date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  return Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(date)
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date)
}

function formatShortDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date)
}

function formatTimeRange(startTime: string | null, endTime: string | null) {
  if (startTime && endTime) return `${startTime} - ${endTime}`
  if (startTime) return startTime
  if (endTime) return endTime
  return ""
}

function getCalendarStart(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const day = firstDay.getDay()
  const diff = day === 0 ? -6 : 1 - day
  firstDay.setDate(firstDay.getDate() + diff)
  return firstDay
}

function getCalendarCells(date: Date) {
  const start = getCalendarStart(date)
  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(start)
    cellDate.setDate(start.getDate() + index)
    return cellDate
  })
}

function getMonthRange(date: Date) {
  const cells = getCalendarCells(date)
  return {
    start: toIsoDate(cells[0]),
    end: toIsoDate(cells[cells.length - 1]),
  }
}

function isWithinRange(target: string, start: string, end: string) {
  return target >= start && target <= end
}

function createEmptyForm(date: string): EventFormState {
  return {
    id: null,
    title: "",
    startDate: date,
    endDate: date,
    startTime: "",
    endTime: "",
    note: "",
  }
}

export default function DashboardCalendar({ canManageEvents = false }: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [selectedDate, setSelectedDate] = useState(toIsoDate(new Date()))
  const [eventFormOpen, setEventFormOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [form, setForm] = useState<EventFormState>(createEmptyForm(toIsoDate(new Date())))

  const cells = useMemo(() => getCalendarCells(currentMonth), [currentMonth])
  const range = useMemo(() => getMonthRange(currentMonth), [currentMonth])
  const todayIso = toIsoDate(new Date())

  const selectedDateEvents = useMemo(() => {
    return events.filter((event) =>
      isWithinRange(selectedDate, event.start_date, event.end_date)
    )
  }, [events, selectedDate])

  useEffect(() => {
    let active = true

    const loadEvents = async () => {
      setLoading(true)
      setErrorMessage("")

      try {
        const response = await fetch(
          `/api/dashboard-calendar?start=${range.start}&end=${range.end}`,
          {
            method: "GET",
            cache: "no-store",
          }
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.error || "Takvim verisi alÄ±namadÄ±.")
        }

        if (!active) return
        setEvents(data?.events ?? [])
      } catch (error: unknown) {
        if (!active) return
        setErrorMessage(error instanceof Error ? error.message : "Takvim verisi alÄ±namadÄ±.")
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadEvents()

    return () => {
      active = false
    }
  }, [range.start, range.end])

  const openCreateForm = (date: string) => {
    if (!canManageEvents) return

    setSelectedDate(date)
    setEventFormOpen(true)
    setIsEditMode(false)
    setForm(createEmptyForm(date))
    setErrorMessage("")
  }

  const openEditForm = (event: CalendarEvent) => {
    if (!canManageEvents) return

    setSelectedDate(event.start_date)
    setEventFormOpen(true)
    setIsEditMode(true)
    setForm({
      id: event.id,
      title: event.title ?? "",
      startDate: event.start_date,
      endDate: event.end_date,
      startTime: event.start_time ?? "",
      endTime: event.end_time ?? "",
      note: event.note ?? "",
    })
    setErrorMessage("")
  }

  const closeForm = () => {
    setEventFormOpen(false)
    setIsEditMode(false)
    setForm(createEmptyForm(selectedDate))
    setErrorMessage("")
  }

  const handleCreate = async () => {
    setSaving(true)
    setErrorMessage("")

    try {
      const payload = {
        title: form.title.trim() || "Etkinlik",
        startDate: form.startDate,
        endDate: form.endDate || form.startDate,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        note: form.note.trim() || null,
      }

      const response = await fetch("/api/dashboard-calendar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Etkinlik kaydedilemedi.")
      }

      const created = data?.event as CalendarEvent
      const overlapsCurrentMonth =
        created.start_date <= range.end && created.end_date >= range.start

      if (overlapsCurrentMonth) {
        setEvents((prev) => {
          const next = [...prev, created]
          next.sort((a, b) => {
            if (a.start_date === b.start_date) {
              const aTime = a.start_time || "99:99"
              const bTime = b.start_time || "99:99"
              if (aTime === bTime) {
                return a.created_at.localeCompare(b.created_at)
              }
              return aTime.localeCompare(bTime)
            }
            return a.start_date.localeCompare(b.start_date)
          })
          return next
        })
      }

      setSelectedDate(payload.startDate)
      closeForm()
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Etkinlik kaydedilemedi.")
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!form.id) return

    setSaving(true)
    setErrorMessage("")

    try {
      const payload = {
        id: form.id,
        title: form.title.trim() || "Etkinlik",
        startDate: form.startDate,
        endDate: form.endDate || form.startDate,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        note: form.note.trim() || null,
      }

      const response = await fetch("/api/dashboard-calendar", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Etkinlik gÃ¼ncellenemedi.")
      }

      const updated = data?.event as CalendarEvent

      setEvents((prev) => {
        const next = prev.map((item) => (item.id === updated.id ? updated : item))
        next.sort((a, b) => {
          if (a.start_date === b.start_date) {
            const aTime = a.start_time || "99:99"
            const bTime = b.start_time || "99:99"
            if (aTime === bTime) {
              return a.created_at.localeCompare(b.created_at)
            }
            return aTime.localeCompare(bTime)
          }
          return a.start_date.localeCompare(b.start_date)
        })
        return next
      })

      setSelectedDate(updated.start_date)
      closeForm()
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Etkinlik gÃ¼ncellenemedi.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!form.id) return

    const confirmed = window.confirm("Bu etkinlik silinsin mi?")
    if (!confirmed) return

    setSaving(true)
    setErrorMessage("")

    try {
      const response = await fetch(`/api/dashboard-calendar?id=${form.id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Etkinlik silinemedi.")
      }

      setEvents((prev) => prev.filter((item) => item.id !== form.id))
      closeForm()
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Etkinlik silinemedi.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Takvim
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Ortak ÅŸirket planÄ± ve geÃ§miÅŸ etkinlikler
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setCurrentMonth(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
              )
            }
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            â†
          </button>

          <div className="min-w-[180px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-center text-sm font-semibold capitalize text-slate-800">
            {formatMonthTitle(currentMonth)}
          </div>

          <button
            type="button"
            onClick={() =>
              setCurrentMonth(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
              )
            }
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            â†’
          </button>
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.55fr)_340px]">
        <div>
          <div className="mb-2 grid grid-cols-[32px_repeat(7,minmax(0,1fr))] gap-1 sm:grid-cols-[42px_repeat(7,minmax(0,1fr))] sm:gap-2 2xl:grid-cols-[52px_repeat(7,minmax(0,1fr))]">
            <div className="rounded-lg bg-slate-100 px-1 py-2 text-center text-[9px] font-semibold uppercase text-slate-600 sm:rounded-xl sm:px-2 sm:text-[11px] sm:tracking-[0.16em]">
              CW
            </div>

            {["Pzt", "Sal", "Ã‡ar", "Per", "Cum", "Cmt", "Paz"].map((day) => (
              <div
                key={day}
                className="rounded-lg bg-slate-50 px-1 py-2 text-center text-[9px] font-semibold uppercase text-slate-500 sm:rounded-xl sm:px-2 sm:text-[11px] sm:tracking-[0.16em]"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[32px_repeat(7,minmax(0,1fr))] gap-1 sm:grid-cols-[42px_repeat(7,minmax(0,1fr))] sm:gap-2 2xl:grid-cols-[52px_repeat(7,minmax(0,1fr))]">
            {Array.from({ length: 6 }, (_, week) => {
              const weekCells = cells.slice(week * 7, week * 7 + 7)

              return (
                <div key={`weekrow-${week}`} className="contents">
                  <div className="flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-[10px] font-semibold text-slate-700 sm:rounded-2xl sm:border-2 sm:text-sm">
                    {getIsoWeek(weekCells[0])}
                  </div>

                  {weekCells.map((date) => {
                    const iso = toIsoDate(date)
                    const isToday = iso === todayIso
                    const isSelected = iso === selectedDate
                    const inCurrentMonth = date.getMonth() === currentMonth.getMonth()

                    const dayEvents = events.filter((event) =>
                      isWithinRange(iso, event.start_date, event.end_date)
                    )

                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => {
                          setSelectedDate(iso)
                          setEventFormOpen(false)
                          setIsEditMode(false)
                          setForm(createEmptyForm(iso))
                        }}
                        className={[
                          "relative min-h-[58px] overflow-hidden rounded-lg border p-1 text-left transition-all duration-150 hover:border-slate-600 hover:ring-2 hover:ring-slate-500/30 sm:min-h-[84px] sm:rounded-2xl sm:border-2 sm:p-2 2xl:min-h-[102px] 2xl:p-2.5",
                          inCurrentMonth
                            ? "border-slate-300 bg-white hover:bg-slate-50"
                            : "border-slate-200 bg-slate-50/70 text-slate-500 hover:bg-slate-100/70",
                          isSelected ? "ring-2 ring-slate-400" : "",
                          isToday
                            ? "border-blue-500 bg-blue-50 shadow-[0_0_0_2px_rgba(59,130,246,0.16),0_12px_24px_rgba(59,130,246,0.16)]"
                            : "",
                        ].join(" ")}
                      >
                        <div className="absolute left-1 top-1 flex max-w-[calc(100%-0.5rem)] items-start justify-between sm:left-2 sm:top-2 sm:max-w-[calc(100%-1rem)]">
                          <span
                            className={[
                              "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold sm:h-8 sm:w-8 sm:text-sm 2xl:h-10 2xl:w-10 2xl:text-base",
                              isToday
                                ? "bg-blue-600 text-white shadow-sm"
                                : "bg-slate-100 text-slate-700",
                            ].join(" ")}
                          >
                            {date.getDate()}
                          </span>

                        </div>

                        <div className="mt-8 space-y-1 sm:mt-10 2xl:mt-12">
                          {dayEvents.slice(0, 2).map((event) => (
                            <div
                              key={`${iso}-${event.id}`}
                              role="button"
                              tabIndex={0}
                              onClick={(clickEvent) => {
                                clickEvent.stopPropagation()
                                openEditForm(event)
                              }}
                              onKeyDown={(keyEvent) => {
                                if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                                  keyEvent.preventDefault()
                                  keyEvent.stopPropagation()
                                  openEditForm(event)
                                }
                              }}
                              className="block w-full cursor-pointer truncate rounded-md border border-violet-200 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-1 py-0.5 text-left text-[9px] font-medium text-white shadow-sm transition-opacity hover:opacity-90 sm:rounded-xl sm:px-2 sm:py-1 sm:text-[10px]"
                            >
                              {event.start_time ? `${event.start_time} ` : ""}
                              {event.title}
                            </div>
                          ))}

                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">GÃ¼n DetayÄ±</h3>
            <p className="mt-1 text-sm text-slate-500">
              {formatDateLabel(selectedDate)}
            </p>
          </div>

          {!eventFormOpen ? (
            <>
              {canManageEvents ? (
                <button
                  type="button"
                  onClick={() => openCreateForm(selectedDate)}
                  className="mb-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  Etkinlik Ekle
                </button>
              ) : null}

              {errorMessage ? (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}

              <div>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  SeÃ§ilen GÃ¼n Etkinlikleri
                </h4>

                {loading ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                    Takvim yÃ¼kleniyor...
                  </div>
                ) : selectedDateEvents.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                    Bu gÃ¼n iÃ§in etkinlik yok.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDateEvents.map((event) => (
                      <div
                        key={event.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openEditForm(event)}
                        onKeyDown={(keyEvent) => {
                          if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                            keyEvent.preventDefault()
                            openEditForm(event)
                          }
                        }}
                        className="block w-full cursor-pointer rounded-xl border border-violet-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 px-4 py-3 text-left transition-all duration-150 hover:shadow-sm"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          {event.title}
                        </div>

                        <div className="mt-1 text-xs font-medium text-slate-500">
                          {formatShortDateLabel(event.start_date)} - {formatShortDateLabel(event.end_date)}
                        </div>

                        {formatTimeRange(event.start_time, event.end_time) ? (
                          <div className="mt-1 text-xs font-medium text-slate-500">
                            {formatTimeRange(event.start_time, event.end_time)}
                          </div>
                        ) : null}

                        {event.note ? (
                          <div className="mt-2 text-sm leading-6 text-slate-600">
                            {event.note}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">
                {isEditMode ? "EtkinliÄŸi DÃ¼zenle" : "Etkinlik OluÅŸtur"}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">
                  Başlık
                </label>
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Örn: Demo firmasında çalışma"
                  className="block min-w-0 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <label className="mb-2 block text-sm font-medium text-slate-600">
                    Başlangıç Tarihi
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        startDate: event.target.value,
                      }))
                    }
                    className="block min-w-0 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                  />
                </div>

                <div className="min-w-0">
                  <label className="mb-2 block text-sm font-medium text-slate-600">
                    Bitiş Tarihi
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        endDate: event.target.value,
                      }))
                    }
                    className="block min-w-0 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                  />
                </div>

                <div className="min-w-0">
                  <label className="mb-2 block text-sm font-medium text-slate-600">
                    Başlangıç Saati
                  </label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        startTime: event.target.value,
                      }))
                    }
                    className="block min-w-0 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                  />
                </div>

                <div className="min-w-0">
                  <label className="mb-2 block text-sm font-medium text-slate-600">
                    Bitiş Saati
                  </label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        endTime: event.target.value,
                      }))
                    }
                    className="block min-w-0 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">
                  Açıklama
                </label>
                <textarea
                  rows={4}
                  value={form.note}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      note: event.target.value,
                    }))
                  }
                  placeholder="Etkinlik ile ilgili not veya detay"
                  className="block min-w-0 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                />
              </div>
              {errorMessage ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={isEditMode ? handleUpdate : handleCreate}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Kaydediliyor..." : isEditMode ? "GÃ¼ncelle" : "Kaydet"}
                </button>

                {isEditMode ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    EtkinliÄŸi Sil
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                >
                  Ä°ptal
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

