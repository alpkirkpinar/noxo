import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getRoutePermission, hasPermission } from "@/lib/permissions"

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
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url))
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
