"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function normalizeRedirect(value: string | null) {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }

  return value;
}

function MobileAuthContent() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const accessToken = searchParams.get("access_token")?.trim() ?? "";
      const refreshToken = searchParams.get("refresh_token")?.trim() ?? "";
      const redirectTo = normalizeRedirect(searchParams.get("redirect"));

      if (!accessToken || !refreshToken) {
        if (active) {
          setErrorText("Mobil oturum bilgisi eksik.");
        }
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        if (active) {
          setErrorText(error.message || "Mobil oturumu acilamadi.");
        }
        return;
      }

      if (typeof window !== "undefined") {
        window.location.replace(redirectTo);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [searchParams, supabase]);

  return <MobileAuthShell errorText={errorText} />;
}

function MobileAuthShell({ errorText = "" }: { errorText?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md rounded-[28px] border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
        <div className="text-lg font-semibold text-white">Mobil oturum aciliyor...</div>
        <p className="mt-3 text-sm text-slate-300">
          {errorText || "Orijinal ekran yuklenirken bu sayfa otomatik kapanmayacak, yonlendirme tamamlanacak."}
        </p>
      </div>
    </main>
  );
}

export default function MobileAuthPage() {
  return (
    <Suspense fallback={<MobileAuthShell />}>
      <MobileAuthContent />
    </Suspense>
  );
}
