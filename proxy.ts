import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getRoutePermission, hasPermission } from "@/lib/permissions"

function getAuthStorageKey() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl) {
    return null
  }

  try {
    const hostname = new URL(supabaseUrl).hostname
    return `sb-${hostname.split(".")[0]}-auth-token`
  } catch {
    return null
  }
}

function clearAuthCookies(request: NextRequest, response: NextResponse) {
  const storageKey = getAuthStorageKey()

  if (!storageKey) {
    return
  }

  request.cookies
    .getAll()
    .filter(({ name }) => name === storageKey || name.startsWith(`${storageKey}.`))
    .forEach(({ name }) => {
      response.cookies.delete(name)
    })
}

function isMissingRefreshTokenError(value: unknown) {
  if (!value || typeof value !== "object") {
    return false
  }

  const error = value as { code?: unknown; message?: unknown; name?: unknown }

  return (
    error.name === "AuthApiError" &&
    (error.code === "refresh_token_not_found" ||
      (typeof error.message === "string" &&
        error.message.includes("Invalid Refresh Token: Refresh Token Not Found")))
  )
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (
    !pathname.startsWith("/dashboard") ||
    pathname.startsWith("/dashboard/unauthorized")
  ) {
    return NextResponse.next()
  }

  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError && isMissingRefreshTokenError(authError)) {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url))
    clearAuthCookies(request, redirectResponse)
    return redirectResponse
  }

  if (!user) {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url))
    clearAuthCookies(request, redirectResponse)
    return redirectResponse
  }

  const requiredPermission = getRoutePermission(pathname)

  if (
    requiredPermission &&
    !hasPermission(
      {
        role: user.app_metadata?.role,
        super_user: user.app_metadata?.super_user,
        company_modules: Array.isArray(user.app_metadata?.company_modules)
          ? user.app_metadata.company_modules.map(String)
          : undefined,
        company_active: user.app_metadata?.company_active === false ? false : undefined,
        permissions: Array.isArray(user.app_metadata?.permissions)
          ? user.app_metadata.permissions.map(String)
          : [],
      },
      requiredPermission
    )
  ) {
    return NextResponse.redirect(new URL("/dashboard/unauthorized", request.url))
  }

  return response
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
}
