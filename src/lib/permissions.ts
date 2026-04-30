export const PERMISSIONS = {
  dashboard: "Dashboard Görüntüleme",
  dashboardCalendarManage: "Takvime Etkinlik Ekleme ve Düzenleme",
  tickets: "Ticket Görüntüleme",
  ticketCreate: "Ticket Oluşturma",
  ticketEdit: "Ticket Düzenleme",
  ticketDelete: "Ticket Silme",
  ticketAssign: "Ticket Atama",
  serviceForms: "Form Görüntüleme",
  offers: "Teklif Görüntüleme",
  offerCreate: "Teklif Oluşturma",
  offerEdit: "Teklif Düzenleme",
  offerDelete: "Teklif Silme",
  offerPdf: "Teklif PDF Alma",
  customers: "Müşteri Görüntüleme",
  customerCreate: "Müşteri Oluşturma",
  customerEdit: "Müşteri Düzenleme",
  customerDelete: "Müşteri Silme",
  machines: "Makine Görüntüleme",
  machineCreate: "Makine Oluşturma",
  machineEdit: "Makine Düzenleme",
  machineDelete: "Makine Silme",
  inventory: "Depo Görüntüleme",
  stockCreate: "Stok Kartı Oluşturma",
  stockEdit: "Stok Kartı Düzenleme",
  stockDelete: "Stok Kartı Silme",
  stockIn: "Stok Giriş",
  stockOut: "Stok Çıkış",
  csvImport: "CSV Import",
  csvExport: "CSV Export",
  employees: "Çalışan Görüntüleme",
  employeeCreate: "Çalışan Oluşturma",
  employeeEdit: "Çalışan Bilgisi Düzenleme",
  employeeDelete: "Çalışan Silme",
  employeePermissions: "Çalışan Yetkisi Düzenleme",
  formTemplates: "Form Şablonu Görüntüleme",
  formTemplateCreate: "Form Şablonu Oluşturma",
  formTemplateEdit: "Form Şablonu Düzenleme",
  formTemplateDelete: "Form Şablonu Silme",
  serviceFormCreate: "Form Oluşturma",
  serviceFormEdit: "Form Düzenleme",
  serviceFormDelete: "Form Silme",
  serviceFormPdf: "Form PDF Alma",
  settings: "Sistem Ayarları",
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const APP_MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "tickets", label: "Ticketlar" },
  { key: "serviceForms", label: "Formlar" },
  { key: "offers", label: "Teklifler" },
  { key: "customers", label: "Musteriler" },
  { key: "machines", label: "Makineler" },
  { key: "inventory", label: "Depo" },
  { key: "employees", label: "Çalışanlar" },
  { key: "formTemplates", label: "Form Sablonlari" },
  { key: "settings", label: "Sistem Ayarlari" },
] as const

export type AppModuleKey = (typeof APP_MODULES)[number]["key"]

export const ALL_APP_MODULE_KEYS = APP_MODULES.map((module) => module.key)

const PERMISSION_MODULES: Record<string, AppModuleKey> = {
  [PERMISSIONS.dashboard]: "dashboard",
  [PERMISSIONS.dashboardCalendarManage]: "dashboard",
  [PERMISSIONS.tickets]: "tickets",
  [PERMISSIONS.ticketCreate]: "tickets",
  [PERMISSIONS.ticketEdit]: "tickets",
  [PERMISSIONS.ticketDelete]: "tickets",
  [PERMISSIONS.ticketAssign]: "tickets",
  [PERMISSIONS.serviceForms]: "serviceForms",
  [PERMISSIONS.serviceFormCreate]: "serviceForms",
  [PERMISSIONS.serviceFormEdit]: "serviceForms",
  [PERMISSIONS.serviceFormDelete]: "serviceForms",
  [PERMISSIONS.serviceFormPdf]: "serviceForms",
  [PERMISSIONS.offers]: "offers",
  [PERMISSIONS.offerCreate]: "offers",
  [PERMISSIONS.offerEdit]: "offers",
  [PERMISSIONS.offerDelete]: "offers",
  [PERMISSIONS.offerPdf]: "offers",
  [PERMISSIONS.customers]: "customers",
  [PERMISSIONS.customerCreate]: "customers",
  [PERMISSIONS.customerEdit]: "customers",
  [PERMISSIONS.customerDelete]: "customers",
  [PERMISSIONS.machines]: "machines",
  [PERMISSIONS.machineCreate]: "machines",
  [PERMISSIONS.machineEdit]: "machines",
  [PERMISSIONS.machineDelete]: "machines",
  [PERMISSIONS.inventory]: "inventory",
  [PERMISSIONS.stockCreate]: "inventory",
  [PERMISSIONS.stockEdit]: "inventory",
  [PERMISSIONS.stockDelete]: "inventory",
  [PERMISSIONS.stockIn]: "inventory",
  [PERMISSIONS.stockOut]: "inventory",
  [PERMISSIONS.csvImport]: "inventory",
  [PERMISSIONS.csvExport]: "inventory",
  [PERMISSIONS.employees]: "employees",
  [PERMISSIONS.employeeCreate]: "employees",
  [PERMISSIONS.employeeEdit]: "employees",
  [PERMISSIONS.employeeDelete]: "employees",
  [PERMISSIONS.employeePermissions]: "employees",
  [PERMISSIONS.formTemplates]: "formTemplates",
  [PERMISSIONS.formTemplateCreate]: "formTemplates",
  [PERMISSIONS.formTemplateEdit]: "formTemplates",
  [PERMISSIONS.formTemplateDelete]: "formTemplates",
  [PERMISSIONS.settings]: "settings",
}

export type PermissionIdentity = {
  permissions?: string[]
  company_modules?: string[]
  company_active?: boolean | null
  role?: string | null
  email?: string | null
  super_user?: boolean | null
}

export const ROUTE_PERMISSIONS: Array<{
  prefix: string
  permission: Permission
}> = [
  { prefix: "/dashboard/tickets", permission: PERMISSIONS.tickets },
  { prefix: "/dashboard/service-forms", permission: PERMISSIONS.serviceForms },
  { prefix: "/dashboard/offers", permission: PERMISSIONS.offers },
  { prefix: "/dashboard/customers", permission: PERMISSIONS.customers },
  { prefix: "/dashboard/machines", permission: PERMISSIONS.machines },
  { prefix: "/dashboard/inventory-movements", permission: PERMISSIONS.inventory },
  { prefix: "/dashboard/inventory", permission: PERMISSIONS.inventory },
  { prefix: "/dashboard/warehouses", permission: PERMISSIONS.inventory },
  { prefix: "/dashboard/employees", permission: PERMISSIONS.employees },
  { prefix: "/dashboard/form-templates", permission: PERMISSIONS.formTemplates },
  { prefix: "/dashboard/settings", permission: PERMISSIONS.settings },
  { prefix: "/dashboard/reports", permission: PERMISSIONS.dashboard },
  { prefix: "/dashboard/schedules", permission: PERMISSIONS.dashboard },
  { prefix: "/dashboard", permission: PERMISSIONS.dashboard },
]

export function isSuperUser(identity: PermissionIdentity) {
  return identity.super_user === true || identity.role === "super_user" || isMasterUser(identity)
}

export function isMasterUser(identity: PermissionIdentity) {
  return identity.role === "master" && String(identity.email ?? "").trim().toLowerCase() === "master@noxo.local"
}

export function normalizeAppModules(modules: unknown) {
  if (!Array.isArray(modules)) return null

  const allowed = new Set<string>(ALL_APP_MODULE_KEYS)
  return Array.from(new Set(modules.map(String).filter((module) => allowed.has(module)))) as AppModuleKey[]
}

export function getPermissionModule(permission: string) {
  return PERMISSION_MODULES[permission] ?? null
}

export function isPermissionEnabledForCompany(identity: PermissionIdentity, permission: string) {
  if (isMasterUser(identity)) return true
  if (identity.company_active === false) return false

  const moduleKey = getPermissionModule(permission)
  if (!moduleKey) return true

  const modules = normalizeAppModules(identity.company_modules)
  if (modules === null) return true

  return modules.includes(moduleKey)
}

export function hasPermission(
  identity: PermissionIdentity,
  permission: string
) {
  if (!isPermissionEnabledForCompany(identity, permission)) return false
  if (isSuperUser(identity)) return true
  return Array.isArray(identity.permissions) && identity.permissions.includes(permission)
}

export function getRoutePermission(pathname: string) {
  if (pathname === "/dashboard/customers/new") return PERMISSIONS.customerCreate
  if (/^\/dashboard\/customers\/[^/]+\/edit$/.test(pathname)) return PERMISSIONS.customerEdit
  if (pathname === "/dashboard/machines/new") return PERMISSIONS.machineCreate
  if (/^\/dashboard\/machines\/[^/]+\/edit$/.test(pathname)) return PERMISSIONS.machineEdit
  if (pathname === "/dashboard/tickets/new") return PERMISSIONS.ticketCreate
  if (pathname === "/dashboard/offers/new") return PERMISSIONS.offerCreate
  if (/^\/dashboard\/offers\/[^/]+\/edit$/.test(pathname)) return PERMISSIONS.offerEdit
  if (/^\/dashboard\/offers\/[^/]+\/pdf/.test(pathname)) return PERMISSIONS.offerPdf
  if (pathname === "/dashboard/service-forms/new") return PERMISSIONS.serviceFormCreate
  if (/^\/dashboard\/service-forms\/[^/]+$/.test(pathname)) return PERMISSIONS.serviceFormEdit
  if (pathname === "/dashboard/form-templates/new") return PERMISSIONS.formTemplateCreate
  if (/^\/dashboard\/form-templates\/[^/]+$/.test(pathname)) return PERMISSIONS.formTemplateEdit

  return ROUTE_PERMISSIONS.find((item) =>
    pathname === item.prefix || pathname.startsWith(`${item.prefix}/`)
  )?.permission
}
