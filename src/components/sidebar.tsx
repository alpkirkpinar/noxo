"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { NoxoMark } from "@/components/noxo-mark"
import { hasPermission, PERMISSIONS, type PermissionIdentity } from "@/lib/permissions"

type IconName =
  | "dashboard"
  | "ticket"
  | "service"
  | "offer"
  | "customer"
  | "machine"
  | "inventory"
  | "employee"
  | "template"
  | "settings"

type MenuChild = {
  title: string
  href: string
  permission: string
  icon: IconName
}

type MenuItem = {
  title: string
  href?: string
  permission?: string
  icon?: IconName
  children?: MenuChild[]
}

const menuItems: MenuItem[] = [
  {
    title: "Master",
    href: "/dashboard/master",
    icon: "settings",
  },
  {
    title: "Dashboard",
    href: "/dashboard",
    permission: PERMISSIONS.dashboard,
    icon: "dashboard",
  },
  {
    title: "Operasyon",
    children: [
      { title: "Ticketlar", href: "/dashboard/tickets", permission: PERMISSIONS.tickets, icon: "ticket" },
      {
        title: "Formlar",
        href: "/dashboard/service-forms",
        permission: PERMISSIONS.serviceForms,
        icon: "service",
      },
      { title: "Teklifler", href: "/dashboard/offers", permission: PERMISSIONS.offers, icon: "offer" },
    ],
  },
  {
    title: "Müşteri Yönetimi",
    children: [
      { title: "Müşteriler", href: "/dashboard/customers", permission: PERMISSIONS.customers, icon: "customer" },
      { title: "Makineler", href: "/dashboard/machines", permission: PERMISSIONS.machines, icon: "machine" },
    ],
  },
  {
    title: "Depo",
    children: [{ title: "Depo", href: "/dashboard/inventory", permission: PERMISSIONS.inventory, icon: "inventory" }],
  },
  {
    title: "Yönetim",
    children: [
      { title: "Çalışanlar", href: "/dashboard/employees", permission: PERMISSIONS.employees, icon: "employee" },
      {
        title: "Form Şablonları",
        href: "/dashboard/form-templates",
        permission: PERMISSIONS.formTemplates,
        icon: "template",
      },
      { title: "Sistem Ayarları", href: "/dashboard/settings", permission: PERMISSIONS.settings, icon: "settings" },
    ],
  },
]

const iconPaths: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <path d="M4 13h6V4H4z" />
      <path d="M14 20h6v-9h-6z" />
      <path d="M14 7h6V4h-6z" />
      <path d="M4 20h6v-3H4z" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
      <path d="M9 9h6" />
      <path d="M9 15h6" />
    </>
  ),
  service: (
    <>
      <path d="M7 4h7l3 3v13H7z" />
      <path d="M14 4v4h4" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </>
  ),
  offer: (
    <>
      <path d="M7 4h10v16H7z" />
      <path d="M10 8h4" />
      <path d="M10 12h4" />
      <path d="M10 16h2" />
    </>
  ),
  customer: (
    <>
      <path d="M16 19v-1a4 4 0 0 0-8 0v1" />
      <path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M18 11a2 2 0 0 1 2 2" />
      <path d="M6 11a2 2 0 0 0-2 2" />
    </>
  ),
  machine: (
    <>
      <path d="M5 9h14v8H5z" />
      <path d="M8 9V6h8v3" />
      <path d="M8 17v2" />
      <path d="M16 17v2" />
      <path d="M9 13h1" />
      <path d="M14 13h1" />
    </>
  ),
  inventory: (
    <>
      <path d="M4 8l8-4 8 4-8 4z" />
      <path d="M4 8v8l8 4 8-4V8" />
      <path d="M12 12v8" />
    </>
  ),
  employee: (
    <>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      <path d="M5 20a7 7 0 0 1 14 0" />
      <path d="M15 5l1 1" />
    </>
  ),
  template: (
    <>
      <path d="M5 5h14v14H5z" />
      <path d="M9 5v14" />
      <path d="M5 10h14" />
      <path d="M12 14h4" />
    </>
  ),
  settings: (
    <>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7 7 0 0 0-2-1.1L14 3h-4l-.5 2.8a7 7 0 0 0-2 1.1l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.1L10 21h4l.5-2.8a7 7 0 0 0 2-1.1l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" />
    </>
  ),
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname.startsWith(href)
}

function MenuIcon({ icon, active }: { icon: IconName; active?: boolean }) {
  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
        active ? "bg-white/25 text-white" : "bg-white/15 text-white/90"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {iconPaths[icon]}
      </svg>
    </span>
  )
}

export default function Sidebar({
  permissions,
  companyModules,
  companyActive,
  role,
  superUser,
}: {
  permissions: string[]
  companyModules?: string[]
  companyActive?: boolean
  role?: string | null
  superUser?: boolean | null
}) {
  const pathname = usePathname()
  const mobileNavRef = useRef<HTMLDivElement | null>(null)
  const mobileItemRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const [showMobileScrollHint, setShowMobileScrollHint] = useState(false)
  const identity: PermissionIdentity = {
    permissions,
    company_modules: companyModules,
    company_active: companyActive,
    role,
    super_user: superUser,
  }

  const visibleMenuItems = menuItems
    .map((group) => {
      if (group.href === "/dashboard/master") {
        return role === "master" ? group : null
      }

      if (group.href) {
        return group.permission && hasPermission(identity, group.permission) ? group : null
      }

      const children = group.children?.filter((child) =>
        hasPermission(identity, child.permission)
      )

      return children && children.length > 0 ? { ...group, children } : null
    })
    .filter((group): group is MenuItem => group !== null)
  const mobileNavItems = visibleMenuItems.flatMap((group) =>
    group.href
      ? [group]
      : group.children?.map((child) => ({
          title: child.title,
          href: child.href,
          icon: child.icon,
        })) ?? []
  )

  useEffect(() => {
    const nav = mobileNavRef.current
    if (!nav) return

    const applyRollEffect = () => {
      const navRect = nav.getBoundingClientRect()
      const rollStart = navRect.right - 44
      const rollSpan = 44

      mobileNavItems.forEach((item) => {
        const element = mobileItemRefs.current[item.href ?? ""]
        if (!element) return

        const rect = element.getBoundingClientRect()
        const itemCenter = rect.left + rect.width / 2
        const progress = Math.max(0, Math.min(1, (itemCenter - rollStart) / rollSpan))

        element.style.transformOrigin = "right center"
        element.style.transform = `perspective(420px) translateX(${progress * 2.5}px) rotateY(${
          progress * -58
        }deg) skewY(${progress * -5}deg) scaleX(${1 - progress * 0.22}) scaleY(${1 - progress * 0.05})`
        element.style.opacity = String(1 - progress * 0.28)
        element.style.filter = progress > 0 ? `saturate(${1 - progress * 0.2})` : ""
      })
    }

    const updateScrollHint = () => {
      const maxScrollLeft = nav.scrollWidth - nav.clientWidth
      setShowMobileScrollHint(maxScrollLeft > 4 && nav.scrollLeft < maxScrollLeft - 4)
      applyRollEffect()
    }

    updateScrollHint()
    nav.addEventListener("scroll", updateScrollHint, { passive: true })
    window.addEventListener("resize", updateScrollHint)

    return () => {
      nav.removeEventListener("scroll", updateScrollHint)
      window.removeEventListener("resize", updateScrollHint)
    }
  }, [mobileNavItems])

  return (
    <>
      <aside className="hidden 2xl:block">
        <div className="fixed left-0 top-0 h-screen w-[304px] p-4">
          <div className="elevated-sidebar flex h-full w-full flex-col overflow-hidden rounded-3xl bg-[linear-gradient(180deg,#22345d_0%,#1e2c50_45%,#1b2746_100%)] text-white ring-1 ring-white/20">
            <div className="border-b border-white/10 px-5 py-4">
              <Link href="/dashboard" className="flex items-center gap-3">
                <NoxoMark className="h-14 w-14 drop-shadow-md" />
                <div className="text-[30px] font-black leading-none tracking-normal">noxo</div>
              </Link>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pr-2 [scrollbar-width:thin]">
              <nav className="space-y-3">
                {visibleMenuItems.map((group) => {
                  const groupActive = group.href
                    ? isActive(pathname, group.href)
                    : group.children?.some((child) => isActive(pathname, child.href))

                  return (
                    <div key={group.title} className="space-y-2">
                      <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
                        {group.title}
                      </div>

                      {group.href ? (
                        <Link
                          href={group.href}
                          className={`flex items-center gap-3 rounded-2xl px-3 py-3 transition ${
                            groupActive
                              ? "bg-white/16 text-white"
                              : "text-white/90 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <MenuIcon icon={group.icon ?? "dashboard"} active={groupActive} />
                          <span className="text-sm font-semibold">{group.title}</span>
                        </Link>
                      ) : (
                        <div className="space-y-1">
                          {group.children?.map((item) => {
                            const active = isActive(pathname, item.href)

                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 rounded-2xl px-3 py-3 transition ${
                                  active
                                    ? "bg-white/16 text-white"
                                    : "text-white/90 hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                <MenuIcon icon={item.icon} active={active} />
                                <span className="text-sm font-semibold">{item.title}</span>
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </nav>
            </div>
          </div>
        </div>
      </aside>

      <nav className="fixed inset-x-3 bottom-3 z-[30] rounded-3xl border border-white/20 bg-[linear-gradient(180deg,#22345d_0%,#1b2746_100%)] px-2 py-2 text-white shadow-2xl ring-1 ring-white/20 landscape:pr-14 sm:pr-16 2xl:hidden">
        <div
          ref={mobileNavRef}
          className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 pr-10 [-ms-overflow-style:none] [scrollbar-width:none] sm:justify-evenly sm:overflow-x-visible sm:pb-0 sm:pr-0 [&::-webkit-scrollbar]:hidden"
        >
          {mobileNavItems.map((item) => {
            if (!item.href || !item.icon) return null
            const href = item.href
            const active = isActive(pathname, href)

            return (
              <Link
                key={href}
                href={href}
                ref={(element) => {
                  mobileItemRefs.current[href] = element
                }}
                className={`flex min-h-[72px] min-w-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition sm:min-w-0 sm:flex-1 sm:shrink ${
                  active ? "bg-white/20 text-white" : "text-white/90 hover:bg-white/12 hover:text-white"
                }`}
                style={{ willChange: "transform, opacity, filter" }}
              >
                <MenuIcon icon={item.icon} active={active} />
                <span className="max-w-[86px] whitespace-normal text-center text-[10px] font-semibold leading-tight">
                  {item.title}
                </span>
              </Link>
            )
          })}
        </div>

        {showMobileScrollHint ? (
          <div
            className="pointer-events-none absolute inset-y-1 right-0 w-9 rounded-r-3xl bg-[linear-gradient(90deg,rgba(27,39,70,0)_0%,rgba(27,39,70,0.72)_45%,rgba(27,39,70,0.98)_100%)] shadow-[-10px_0_22px_rgba(15,23,42,0.22)] sm:hidden"
            aria-hidden="true"
          >
            <span className="absolute inset-y-0 right-1 flex items-center text-white/80">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </div>
        ) : null}
      </nav>
    </>
  )
}
