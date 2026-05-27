import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toSessionCookieOptions } from "@/lib/supabase/session-cookies";

let browserClient: SupabaseClient | null = null;
let consolePatchInstalled = false;
const BROWSER_SESSION_MARKER = "noxo-browser-session-active";

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

export function clearBrowserAuthState() {
  const storageKey = getAuthStorageKey();

  if (!storageKey || typeof document === "undefined") {
    return;
  }

  window.localStorage.removeItem(storageKey);
  window.localStorage.removeItem(`${storageKey}-code-verifier`);
  window.localStorage.removeItem(`${storageKey}-user`);
  window.sessionStorage.removeItem(storageKey);
  window.sessionStorage.removeItem(`${storageKey}-code-verifier`);
  window.sessionStorage.removeItem(`${storageKey}-user`);
  window.sessionStorage.removeItem(BROWSER_SESSION_MARKER);

  document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter((name) => name === storageKey || name.startsWith(`${storageKey}.`))
    .forEach((name) => {
      document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
    });
}

export function markBrowserSessionActive() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(BROWSER_SESSION_MARKER, "1");
}

function hasAuthCookie() {
  const storageKey = getAuthStorageKey();

  if (!storageKey || typeof document === "undefined") {
    return false;
  }

  return document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .some((name) => name === storageKey || name.startsWith(`${storageKey}.`));
}

function enforceBrowserSessionMarker() {
  if (typeof window === "undefined") {
    return;
  }

  if (hasAuthCookie() && window.sessionStorage.getItem(BROWSER_SESSION_MARKER) !== "1") {
    clearBrowserAuthState();
  }
}

function isMissingRefreshTokenError(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const error = value as { code?: unknown; message?: unknown; name?: unknown };

  return (
    error.name === "AuthApiError" &&
    (error.code === "refresh_token_not_found" ||
      (typeof error.message === "string" &&
        error.message.includes("Invalid Refresh Token: Refresh Token Not Found")))
  );
}

function installMissingRefreshTokenCleanup() {
  if (consolePatchInstalled || typeof window === "undefined") {
    return;
  }

  consolePatchInstalled = true;
  const originalError = console.error;

  console.error = (...args: unknown[]) => {
    if (args.some(isMissingRefreshTokenError)) {
      clearBrowserAuthState();
      return;
    }

    originalError(...args);
  };
}

export function createClient() {
  installMissingRefreshTokenCleanup();
  enforceBrowserSessionMarker();

  if (browserClient) {
    return browserClient;
  }

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      isSingleton: true,
      cookies: {
        getAll() {
          if (typeof document === "undefined") {
            return [];
          }

          return document.cookie
            .split(";")
            .map((cookie) => cookie.trim())
            .filter(Boolean)
            .map((cookie) => {
              const separatorIndex = cookie.indexOf("=");
              const name = separatorIndex >= 0 ? cookie.slice(0, separatorIndex) : cookie;
              const value = separatorIndex >= 0 ? cookie.slice(separatorIndex + 1) : "";
              return { name, value };
            });
        },
        setAll(cookiesToSet) {
          if (typeof document === "undefined") {
            return;
          }

          cookiesToSet.forEach(({ name, value, options }) => {
            const cookieOptions = toSessionCookieOptions(value, options);
            document.cookie = [
              `${name}=${value}`,
              `path=${cookieOptions.path ?? "/"}`,
              cookieOptions.sameSite ? `samesite=${cookieOptions.sameSite}` : "samesite=lax",
              cookieOptions.maxAge != null ? `max-age=${cookieOptions.maxAge}` : "",
              cookieOptions.expires ? `expires=${cookieOptions.expires}` : "",
              cookieOptions.secure ? "secure" : "",
            ]
              .filter(Boolean)
              .join("; ");
          });
        },
      },
    }
  );

  return browserClient;
}
