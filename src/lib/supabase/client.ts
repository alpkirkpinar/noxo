import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let consolePatchInstalled = false;

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

function clearAuthCookies() {
  const storageKey = getAuthStorageKey();

  if (!storageKey || typeof document === "undefined") {
    return;
  }

  window.localStorage.removeItem(storageKey);
  window.localStorage.removeItem(`${storageKey}-code-verifier`);
  window.localStorage.removeItem(`${storageKey}-user`);

  document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter((name) => name === storageKey || name.startsWith(`${storageKey}.`))
    .forEach((name) => {
      document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
    });
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
      clearAuthCookies();
      return;
    }

    originalError(...args);
  };
}

export function createClient() {
  installMissingRefreshTokenCleanup();

  if (browserClient) {
    return browserClient;
  }

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      isSingleton: true,
    }
  );

  return browserClient;
}
