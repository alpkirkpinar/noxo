"use client"

import {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { usePathname, useRouter } from "next/navigation"

type TopbarProps = {
  fullName?: string | null
  email?: string | null
  phone?: string | null
  title?: string | null
  avatarUrl?: string | null
  avatarScale?: number | null
  avatarOffsetX?: number | null
  avatarOffsetY?: number | null
  mustChangePassword?: boolean
}

type LiveRate = {
  code: string
  name: string
  value: number
}

type ProfileForm = {
  fullName: string
  email: string
  phone: string
  title: string
  avatarUrl: string
  avatarScale: number
  avatarOffsetX: number
  avatarOffsetY: number
}

type PasswordForm = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const PAGE_META: Record<string, { title: string }> = {
  "/dashboard": { title: "Dashboard" },
  "/dashboard/master": { title: "Master Panel" },
  "/dashboard/tickets": { title: "Ticketlar" },
  "/dashboard/service-forms": { title: "Servis Formları" },
  "/dashboard/service-forms/new": { title: "Yeni Servis Formu" },
  "/dashboard/customers": { title: "Müşteriler" },
  "/dashboard/offers": { title: "Teklifler" },
  "/dashboard/machines": { title: "Makineler" },
  "/dashboard/inventory": { title: "Depo" },
  "/dashboard/employees": { title: "Çalışanlar" },
  "/dashboard/form-templates": { title: "Form Şablonları" },
  "/dashboard/form-templates/new": { title: "Yeni Form Şablonu" },
  "/dashboard/roles": { title: "Roller & Yetkiler" },
  "/dashboard/settings": { title: "Sistem Ayarları" },
}

function getPageTitle(pathname: string) {
  if (PAGE_META[pathname]) return PAGE_META[pathname].title

  if (
    /^\/dashboard\/service-forms\/template\/[^/]+$/.test(pathname) ||
    /^\/dashboard\/service-forms\/[^/]+$/.test(pathname)
  ) {
    return "Servis Formu"
  }

  if (/^\/dashboard\/customers\/[^/]+(?:\/edit)?$/.test(pathname)) {
    return "Müşteriler"
  }

  if (/^\/dashboard\/offers\/[^/]+(?:\/edit|\/pdf)?$/.test(pathname)) {
    return "Teklifler"
  }

  if (/^\/dashboard\/machines\/[^/]+(?:\/edit)?$/.test(pathname)) {
    return "Makineler"
  }

  if (/^\/dashboard\/form-templates\/[^/]+$/.test(pathname)) {
    return "Form Şablonları"
  }

  const segments = pathname.split("/").filter(Boolean)
  const lastSegment = segments[segments.length - 1] ?? "dashboard"

  return lastSegment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function getPageTitleFromDom() {
  if (typeof document === "undefined") return null

  const customTitle = document.querySelector("[data-topbar-title]")
  const text = customTitle?.textContent?.trim()

  return text || null
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date)
}

function formatRate(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value)
}

function getInitials(fullName?: string | null, email?: string | null) {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/).slice(0, 2)
    return parts.map((part) => part.charAt(0).toUpperCase()).join("")
  }

  if (email && email.trim()) {
    return email.trim().charAt(0).toUpperCase()
  }

  return "NA"
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export default function Topbar({
  fullName,
  email,
  phone,
  title,
  avatarUrl,
  avatarScale,
  avatarOffsetX,
  avatarOffsetY,
  mustChangePassword = false,
}: TopbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const fallbackPageTitle = useMemo(() => getPageTitle(pathname), [pathname])
  const [pageTitle, setPageTitle] = useState(fallbackPageTitle)

  const [now, setNow] = useState<Date | null>(null)
  const [rates, setRates] = useState<LiveRate[]>([])
  const [activeRateIndex, setActiveRateIndex] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [forcePasswordChange, setForcePasswordChange] = useState(mustChangePassword)
  const [saving, setSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editingAvatar, setEditingAvatar] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState("")
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    fullName: fullName?.trim() || "",
    email: email?.trim() || "",
    phone: phone?.trim() || "",
    title: title?.trim() || "",
    avatarUrl: avatarUrl?.trim() || "",
    avatarScale: Number(avatarScale ?? 1),
    avatarOffsetX: Number(avatarOffsetX ?? 50),
    avatarOffsetY: Number(avatarOffsetY ?? 50),
  })
  const [savedProfileForm, setSavedProfileForm] = useState<ProfileForm>({
    fullName: fullName?.trim() || "",
    email: email?.trim() || "",
    phone: phone?.trim() || "",
    title: title?.trim() || "",
    avatarUrl: avatarUrl?.trim() || "",
    avatarScale: Number(avatarScale ?? 1),
    avatarOffsetX: Number(avatarOffsetX ?? 50),
    avatarOffsetY: Number(avatarOffsetY ?? 50),
  })
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const profileMenuRef = useRef<HTMLDivElement | null>(null)
  const profileButtonRef = useRef<HTMLButtonElement | null>(null)
  const profileMenuPanelRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const avatarEditorRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{
    pointerId: number | null
    startX: number
    startY: number
    startOffsetX: number
    startOffsetY: number
    width: number
    height: number
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    startOffsetX: 50,
    startOffsetY: 50,
    width: 1,
    height: 1,
  })
  const avatarPointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchStateRef = useRef<{
    startDistance: number
    startScale: number
  } | null>(null)

  const visibleAvatarUrl = previewAvatarUrl || profileForm.avatarUrl

  const updateProfileMenuPosition = () => {
    const button = profileButtonRef.current
    if (!button) return

    const rect = button.getBoundingClientRect()
    const menuWidth = 220
    const viewportPadding = 8
    const left = clamp(
      rect.right - menuWidth,
      viewportPadding,
      Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding)
    )

    setMenuPosition({
      top: rect.bottom + 8,
      left,
    })
  }

  const openProfileMenu = () => {
    updateProfileMenuPosition()
    setMenuOpen(true)
  }

  useEffect(() => {
    setPageTitle(getPageTitleFromDom() ?? fallbackPageTitle)

    const observer = new MutationObserver(() => {
      const nextTitle = getPageTitleFromDom()
      if (nextTitle) {
        setPageTitle(nextTitle)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    return () => observer.disconnect()
  }, [fallbackPageTitle, pathname])

  useEffect(() => {
    setNow(new Date())

    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 60 * 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadRates = async () => {
      try {
        const response = await fetch("/api/exchange-rates", { cache: "no-store" })

        if (!response.ok) {
          throw new Error("Kur verisi alınamadı.")
        }

        const data = await response.json()
        const rawRates: Partial<LiveRate>[] = Array.isArray(data?.rates) ? data.rates : []
        const nextRates: LiveRate[] = rawRates
          .map((item) => {
            const value = Number(item?.value)

            if (
              !item?.code ||
              !item?.name ||
              !Number.isFinite(value) ||
              value <= 0
            ) {
              return null
            }

            return {
              code: String(item.code),
              name: String(item.name),
              value,
            }
          })
          .filter((item): item is LiveRate => item !== null)

        if (!cancelled) {
          setRates(nextRates)
          setActiveRateIndex(0)
        }
      } catch {
        if (!cancelled) {
          setRates([])
          setActiveRateIndex(0)
        }
      }
    }

    loadRates()
    const refreshTimer = window.setInterval(loadRates, 10 * 60 * 1000)

    return () => {
      cancelled = true
      window.clearInterval(refreshTimer)
    }
  }, [])

  useEffect(() => {
    const nextProfileForm = {
      fullName: fullName?.trim() || "",
      email: email?.trim() || "",
      phone: phone?.trim() || "",
      title: title?.trim() || "",
      avatarUrl: avatarUrl?.trim() || "",
      avatarScale: Number(avatarScale ?? 1),
      avatarOffsetX: Number(avatarOffsetX ?? 50),
      avatarOffsetY: Number(avatarOffsetY ?? 50),
    }

    setProfileForm(nextProfileForm)
    setSavedProfileForm(nextProfileForm)
  }, [fullName, email, phone, title, avatarUrl, avatarScale, avatarOffsetX, avatarOffsetY])

  useEffect(() => {
    if (rates.length <= 1) return

    const timer = window.setInterval(() => {
      setActiveRateIndex((prev) => (prev + 1) % rates.length)
    }, 2800)

    return () => window.clearInterval(timer)
  }, [rates.length])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const clickedTrigger = profileMenuRef.current?.contains(target)
      const clickedMenu = profileMenuPanelRef.current?.contains(target)

      if (!clickedTrigger && !clickedMenu) {
        setMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (!menuOpen) return

    updateProfileMenuPosition()

    window.addEventListener("resize", updateProfileMenuPosition)
    window.addEventListener("scroll", updateProfileMenuPosition, true)

    return () => {
      window.removeEventListener("resize", updateProfileMenuPosition)
      window.removeEventListener("scroll", updateProfileMenuPosition, true)
    }
  }, [menuOpen])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false)
        setProfileOpen(false)
        setEditingAvatar(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [])

  useEffect(() => {
    return () => {
      if (previewAvatarUrl) {
        URL.revokeObjectURL(previewAvatarUrl)
      }
    }
  }, [previewAvatarUrl])

  useEffect(() => {
    if (!profileOpen && !forcePasswordChange) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [forcePasswordChange, profileOpen])

  const activeRate = rates[activeRateIndex] ?? null
  const initials = getInitials(profileForm.fullName, profileForm.email)

  const resetProfileEditor = () => {
    if (previewAvatarUrl) {
      URL.revokeObjectURL(previewAvatarUrl)
    }

    setProfileForm(savedProfileForm)
    setPendingAvatarFile(null)
    setPreviewAvatarUrl("")
    setEditingAvatar(false)
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    })
    setErrorMessage("")
    setSuccessMessage("")
  }

  const handleProfileChange = (field: keyof ProfileForm, value: string | number) => {
    setProfileForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handlePasswordChange = (field: keyof PasswordForm, value: string) => {
    setPasswordForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleLogout = async () => {
    try {
      await fetch("/auth/sign-out", { method: "POST" })
    } catch {}

    router.push("/login")
    router.refresh()
  }

  const handleProfileSave = async () => {
    setSaving(true)
    setUploading(false)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      let avatarUrl = profileForm.avatarUrl

      if (pendingAvatarFile) {
        setUploading(true)

        const formData = new FormData()
        formData.append("file", pendingAvatarFile)

        const uploadResponse = await fetch("/api/profile/avatar", {
          method: "POST",
          body: formData,
        })

        const uploadData = await uploadResponse.json()

        if (!uploadResponse.ok) {
          throw new Error(uploadData?.error || "Fotoğraf yüklenemedi.")
        }

        avatarUrl = String(uploadData.avatarUrl ?? "")
        setUploading(false)
      }

      const payload = {
        ...profileForm,
        avatarUrl,
      }

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Profil kaydedilemedi.")
      }

      if (previewAvatarUrl) {
        URL.revokeObjectURL(previewAvatarUrl)
      }

      const nextProfileForm = {
        ...profileForm,
        avatarUrl,
      }

      setProfileForm(nextProfileForm)
      setSavedProfileForm(nextProfileForm)
      setPendingAvatarFile(null)
      setPreviewAvatarUrl("")
      setSuccessMessage("Profil bilgileri kaydedildi.")
      setEditingAvatar(false)
      router.refresh()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Profil kaydedilemedi."
      setErrorMessage(message)
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  const handlePasswordSave = async () => {
    setPasswordSaving(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
        throw new Error("Eski şifre, yeni şifre ve şifre tekrarı zorunludur.")
      }

      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error("Yeni şifre ve şifre tekrarı eşleşmiyor.")
      }

      const response = await fetch("/api/profile/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(passwordForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Şifre güncellenemedi.")
      }

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
      setForcePasswordChange(false)
      setSuccessMessage("Şifre güncellendi.")
      router.refresh()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Şifre güncellenemedi."
      setErrorMessage(message)
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleAvatarSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setErrorMessage("Sadece JPG, PNG veya WEBP yükleyebilirsiniz.")
      setSuccessMessage("")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Dosya boyutu 5 MB'tan büyük olamaz.")
      setSuccessMessage("")
      return
    }

    if (previewAvatarUrl) {
      URL.revokeObjectURL(previewAvatarUrl)
    }

    const localPreview = URL.createObjectURL(file)

    setPendingAvatarFile(file)
    setPreviewAvatarUrl(localPreview)
    setProfileForm((prev) => ({
      ...prev,
      avatarScale: 1,
      avatarOffsetX: 50,
      avatarOffsetY: 50,
    }))
    setEditingAvatar(true)
    setErrorMessage("")
    setSuccessMessage("")

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleAvatarPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!editingAvatar || !visibleAvatarUrl) return
    if (!avatarEditorRef.current) return

    avatarPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })
    avatarEditorRef.current.setPointerCapture(event.pointerId)

    const activePointers = Array.from(avatarPointersRef.current.values())
    if (activePointers.length >= 2) {
      const [first, second] = activePointers
      pinchStateRef.current = {
        startDistance: Math.hypot(second.x - first.x, second.y - first.y) || 1,
        startScale: profileForm.avatarScale,
      }
      dragStateRef.current.pointerId = null
      return
    }

    const rect = avatarEditorRef.current.getBoundingClientRect()

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: profileForm.avatarOffsetX,
      startOffsetY: profileForm.avatarOffsetY,
      width: rect.width || 1,
      height: rect.height || 1,
    }
  }

  const handleAvatarPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!editingAvatar || !visibleAvatarUrl) return

    if (avatarPointersRef.current.has(event.pointerId)) {
      avatarPointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      })
    }

    const activePointers = Array.from(avatarPointersRef.current.values())
    if (activePointers.length >= 2 && pinchStateRef.current) {
      const [first, second] = activePointers
      const nextDistance = Math.hypot(second.x - first.x, second.y - first.y) || 1
      const nextScale = clamp(
        Number((pinchStateRef.current.startScale * (nextDistance / pinchStateRef.current.startDistance)).toFixed(2)),
        1,
        3
      )

      setProfileForm((prev) => ({
        ...prev,
        avatarScale: nextScale,
      }))
      return
    }

    if (dragStateRef.current.pointerId !== event.pointerId) return

    const deltaX = event.clientX - dragStateRef.current.startX
    const deltaY = event.clientY - dragStateRef.current.startY

    const deltaPercentX = (deltaX / dragStateRef.current.width) * 100
    const deltaPercentY = (deltaY / dragStateRef.current.height) * 100

    const nextOffsetX = clamp(dragStateRef.current.startOffsetX - deltaPercentX, 0, 100)
    const nextOffsetY = clamp(dragStateRef.current.startOffsetY - deltaPercentY, 0, 100)

    setProfileForm((prev) => ({
      ...prev,
      avatarOffsetX: nextOffsetX,
      avatarOffsetY: nextOffsetY,
    }))
  }

  const handleAvatarPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!avatarEditorRef.current) return
    avatarPointersRef.current.delete(event.pointerId)

    try {
      avatarEditorRef.current.releasePointerCapture(event.pointerId)
    } catch {}

    if (avatarPointersRef.current.size < 2) {
      pinchStateRef.current = null
    }

    if (dragStateRef.current.pointerId === event.pointerId) {
      dragStateRef.current.pointerId = null
    }
  }

  const handleAvatarWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!editingAvatar || !visibleAvatarUrl) return

    event.preventDefault()
    event.stopPropagation()

    const delta = event.deltaY < 0 ? 0.08 : -0.08
    const nextScale = clamp(Number((profileForm.avatarScale + delta).toFixed(2)), 1, 3)

    setProfileForm((prev) => ({
      ...prev,
      avatarScale: nextScale,
    }))
  }

  return (
    <>
      <div className="elevated-topbar mb-3 rounded-2xl border border-white/20 bg-[linear-gradient(180deg,#22345d_0%,#1b2746_100%)] px-3 py-3 text-white ring-1 ring-white/20 backdrop-blur sm:rounded-[28px] sm:px-5 2xl:mb-4">
        <div className="flex items-center justify-between gap-3 2xl:gap-4">
          <div className="min-w-0 flex-1 2xl:basis-auto">
            <h1 className="whitespace-normal break-words text-2xl font-semibold leading-tight tracking-tight text-white md:text-[26px] 2xl:text-4xl">
              {pageTitle}
            </h1>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 2xl:min-w-0 2xl:flex-1 2xl:flex-nowrap 2xl:overflow-visible 2xl:pb-0">
            <div className="hidden h-[68px] min-w-0 flex-col justify-center rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2 2xl:flex 2xl:w-[269px] 2xl:shrink-0 2xl:px-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 xl:text-[11px] xl:tracking-[0.18em]">
                Canlı kurlar
              </div>

              <div className="relative mt-1 h-7 overflow-hidden xl:h-8">
                {activeRate ? (
                  <div
                    key={`${activeRate.code}-${activeRateIndex}`}
                    className="absolute inset-0 grid animate-[topbarRateCylinder_550ms_ease] grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] items-center gap-2 xl:flex xl:justify-between xl:gap-4"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 xl:text-[10px] xl:tracking-[0.16em]">
                        {activeRate.name}
                      </div>
                      <div className="truncate text-xs font-semibold text-slate-900 xl:text-sm">
                        1 {activeRate.code}
                      </div>
                    </div>

                    <div className="min-w-0 text-right">
                      <div className="truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 xl:text-[10px] xl:tracking-[0.16em]">
                        <span className="xl:hidden">TL</span>
                        <span className="hidden xl:inline">TÜRK LİRASI</span>
                      </div>
                      <div className="truncate text-xs font-semibold text-slate-900 xl:text-sm">
                        {formatRate(activeRate.value)} TL
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center px-4 text-sm text-slate-500">
                    Kur verisi alınamadı
                  </div>
                )}
              </div>
            </div>

            <div className="hidden h-[68px] min-w-0 flex-col justify-center rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2 2xl:flex 2xl:w-[209px] 2xl:shrink-0 2xl:px-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 xl:text-[11px] xl:tracking-[0.18em]">
                Tarih
              </div>
              <div className="mt-1 truncate text-xs font-semibold capitalize text-slate-800 xl:text-sm">
                {now ? formatDate(now) : "-"}
              </div>
            </div>

            <div className="hidden h-[68px] min-w-0 flex-col justify-center rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2 2xl:flex 2xl:w-[81px] 2xl:shrink-0 2xl:px-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 xl:text-[11px] xl:tracking-[0.18em]">
                Saat
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-800 xl:text-base">
                {now ? formatClock(now) : "--:--"}
              </div>
            </div>

            <div className="relative shrink-0 2xl:w-auto" ref={profileMenuRef}>
              <button
                ref={profileButtonRef}
                type="button"
                onClick={() => {
                  if (menuOpen) {
                    setMenuOpen(false)
                    return
                  }

                  openProfileMenu()
                }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  openProfileMenu()
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/15 p-1 transition-colors duration-150 hover:bg-white/20 2xl:h-[68px] 2xl:w-[190px] 2xl:justify-start 2xl:gap-3 2xl:rounded-2xl 2xl:border-slate-200 2xl:bg-slate-50 2xl:px-4 2xl:py-2 2xl:hover:bg-slate-100"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-xs font-semibold text-white 2xl:h-11 2xl:w-11 2xl:text-sm">
                  {visibleAvatarUrl ? (
                    <img
                      src={visibleAvatarUrl}
                      alt="Profil"
                      className="h-full w-full object-cover"
                      style={{
                        transform: `scale(${profileForm.avatarScale})`,
                        transformOrigin: `${profileForm.avatarOffsetX}% ${profileForm.avatarOffsetY}%`,
                      }}
                    />
                  ) : (
                    initials
                  )}
                </div>

                <div className="hidden min-w-0 text-left 2xl:block">
                  <div className="truncate text-xs font-semibold text-slate-800 xl:text-sm">
                    {profileForm.fullName?.trim() || "Kullanıcı"}
                  </div>
                  <div className="truncate text-[11px] text-slate-500 xl:text-xs">
                    {profileForm.email?.trim() || "-"}
                  </div>
                </div>
              </button>

            </div>
          </div>
        </div>
      </div>

      {menuOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={profileMenuPanelRef}
              className="context-menu-layer fixed min-w-[220px] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl"
              style={{ top: menuPosition.top, left: menuPosition.left }}
            >
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(true)
                  setMenuOpen(false)
                }}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                <span>Düzenle</span>
                <span className="text-slate-400">{">"}</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-between border-t border-slate-200 px-4 py-3 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <span>Çıkış yap</span>
                <span className="text-red-300">{">"}</span>
              </button>
            </div>,
            document.body
          )
        : null}

      {profileOpen ? (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/35 p-2 sm:p-4">
          <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Profil Ayarları</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Profil bilgilerinizi düzenleyin
                </p>
              </div>

              <button
                    type="button"
                    onClick={() => {
                      resetProfileEditor()
                      setProfileOpen(false)
                    }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              >
                ×
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[240px_minmax(0,1fr)]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div
                  ref={avatarEditorRef}
                  onPointerDown={handleAvatarPointerDown}
                  onPointerMove={handleAvatarPointerMove}
                  onPointerUp={handleAvatarPointerUp}
                  onPointerCancel={handleAvatarPointerUp}
                  onWheel={handleAvatarWheel}
                  className={`mx-auto flex h-36 w-36 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-3xl font-semibold text-white ${
                    editingAvatar && visibleAvatarUrl ? "cursor-grab active:cursor-grabbing" : ""
                  }`}
                  style={{ touchAction: "none" }}
                >
                  {visibleAvatarUrl ? (
                    <img
                      src={visibleAvatarUrl}
                      alt="Profil"
                      draggable={false}
                      className="h-full w-full select-none object-cover"
                      style={{
                        transform: `scale(${profileForm.avatarScale})`,
                        transformOrigin: `${profileForm.avatarOffsetX}% ${profileForm.avatarOffsetY}%`,
                      }}
                    />
                  ) : (
                    initials
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleAvatarSelect}
                />

                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving || uploading}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Fotoğraf Seç
                  </button>

                  {visibleAvatarUrl ? (
                    <button
                      type="button"
                      onClick={() => setEditingAvatar((prev) => !prev)}
                      className={`w-full rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        editingAvatar
                          ? "border border-slate-900 bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {editingAvatar ? "Düzenleme Açık" : "Fotoğrafı Düzenle"}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Ad Soyad
                  </label>
                  <input
                    value={profileForm.fullName}
                    onChange={(event) => handleProfileChange("fullName", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    E-posta
                  </label>
                  <input
                    value={profileForm.email}
                    onChange={(event) => handleProfileChange("email", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Telefon
                  </label>
                  <input
                    value={profileForm.phone}
                    onChange={(event) => handleProfileChange("phone", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Ünvan
                  </label>
                  <input
                    value={profileForm.title}
                    onChange={(event) => handleProfileChange("title", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                  />
                </div>

                <div className="md:col-span-2 mt-2 border-t border-slate-200 pt-5">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-slate-900">Şifre Güncelle</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Önce mevcut şifrenizi girin, ardından yeni şifrenizi onaylayın.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Eski Şifre
                      </label>
                      <input
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(event) => handlePasswordChange("currentPassword", event.target.value)}
                        autoComplete="current-password"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Yeni Şifre
                      </label>
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(event) => handlePasswordChange("newPassword", event.target.value)}
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Yeni Şifre Tekrarı
                      </label>
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(event) => handlePasswordChange("confirmPassword", event.target.value)}
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={handlePasswordSave}
                        disabled={saving || uploading || passwordSaving}
                        className="rounded-xl border border-slate-900 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {passwordSaving ? "Şifre Güncelleniyor..." : "Şifreyi Güncelle"}
                      </button>
                    </div>
                  </div>
                </div>

                {(errorMessage || successMessage) ? (
                  <div className="md:col-span-2">
                    {errorMessage ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {errorMessage}
                      </div>
                    ) : null}

                    {successMessage ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        {successMessage}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
              <button
                type="button"
                onClick={() => {
                  resetProfileEditor()
                  setProfileOpen(false)
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                Kapat
              </button>

              <button
                type="button"
                onClick={handleProfileSave}
                disabled={saving || uploading}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Kaydediliyor..." : uploading ? "Fotoğraf Yükleniyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {forcePasswordChange ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-2xl font-semibold text-slate-900">Şifrenizi Güncelleyin</h2>
              <p className="mt-1 text-sm text-slate-500">
                İlk girişte başlangıç şifrenizi değiştirmeniz gerekiyor.
              </p>
            </div>

            <div className="space-y-4 px-6 py-6">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Başlangıç Şifresi
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => handlePasswordChange("currentPassword", event.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Yeni Şifre
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) => handlePasswordChange("newPassword", event.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Yeni Şifre Tekrarı
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => handlePasswordChange("confirmPassword", event.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                />
              </div>

              {errorMessage ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end border-t border-slate-200 px-6 py-5">
              <button
                type="button"
                onClick={handlePasswordSave}
                disabled={passwordSaving}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {passwordSaving ? "Güncelleniyor..." : "Şifreyi Güncelle"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        @keyframes topbarRateCylinder {
          0% {
            opacity: 0;
            transform: translateY(22px) scale(0.96) rotateX(-35deg);
            filter: blur(2px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1) rotateX(0deg);
            filter: blur(0);
          }
        }
      `}</style>
    </>
  )
}
