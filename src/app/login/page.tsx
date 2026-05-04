"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NoxoMark } from "@/components/noxo-mark";
import { localizeErrorMessage } from "@/lib/error-messages";
import { createClient } from "@/lib/supabase/client";

const LOGIN_BACKGROUND_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/public-assets/login/noxo-login-bg.jpg`;

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [isPending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  function resolveLoginEmail(value: string) {
    const normalized = value.trim().toLowerCase();
    if (normalized === "master") {
      return "master@noxo.local";
    }

    return normalized;
  }

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: resolveLoginEmail(email),
      password,
    });

    if (error) {
      setError(localizeErrorMessage(error.message, "Giriş yapılamadı."));
      setLoading(false);
      return;
    }

    startTransition(() => {
      router.replace("/dashboard");
    });
  }

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 bg-cover bg-center p-6"
      style={{ backgroundImage: `url(${LOGIN_BACKGROUND_URL})` }}
    >
      <div className="absolute inset-0 bg-slate-950/35" />
      <div className="relative w-full max-w-md rounded-[28px] border border-white/25 bg-white/90 p-8 shadow-2xl ring-1 ring-white/20 backdrop-blur-md">
        <div className="mb-8 flex items-center justify-center gap-5">
          <NoxoMark className="h-28 w-28 shrink-0 drop-shadow-xl sm:h-32 sm:w-32" />
          <h1 className="text-5xl font-black tracking-normal text-slate-950 sm:text-6xl">noxo</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              E-posta veya kullanıcı adı
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-posta veya master"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Şifre
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Şifre"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || isPending}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-white font-medium transition hover:bg-slate-800 disabled:opacity-60"
          >
            {loading || isPending ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
      </div>
    </main>
  );
}
