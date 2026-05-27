import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { toSessionCookieOptions } from "@/lib/supabase/session-cookies";

function getAuthStorageKey() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  try {
    const hostname = new URL(supabaseUrl).hostname;
    return `sb-${hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

function clearAuthCookies(request: NextRequest, response: NextResponse) {
  const storageKey = getAuthStorageKey();

  if (!storageKey) {
    return;
  }

  request.cookies
    .getAll()
    .filter(({ name }) => name === storageKey || name.startsWith(`${storageKey}.`))
    .forEach(({ name }) => {
      response.cookies.delete(name);
    });
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, toSessionCookieOptions(value, options));
          }
        },
      },
    }
  );

  await supabase.auth.signOut();
  clearAuthCookies(request, response);

  return response;
}
