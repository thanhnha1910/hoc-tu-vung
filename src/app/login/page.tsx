"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loginWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const sb = createSupabaseBrowserClient();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function loginWithGoogle() {
    setBusy(true);
    const sb = createSupabaseBrowserClient();
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-5 py-10">
      <header>
        <h1 className="text-3xl font-semibold">Đăng nhập</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Bộ thẻ của bạn sẽ đồng bộ giữa các thiết bị.
        </p>
      </header>

      <button
        type="button"
        onClick={loginWithGoogle}
        disabled={busy}
        className="tap flex items-center justify-center gap-3 rounded-full border border-[var(--color-line)] bg-[var(--color-bg-elev)] px-5 py-3 font-medium transition-colors hover:bg-[var(--color-bg-elev-2)] disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"
          />
        </svg>
        Tiếp tục với Google
      </button>

      <div className="flex items-center gap-3 text-xs text-[var(--color-ink-muted)]">
        <div className="h-px flex-1 bg-[var(--color-line)]" />
        hoặc
        <div className="h-px flex-1 bg-[var(--color-line)]" />
      </div>

      {sent ? (
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-4 text-sm">
          <p className="font-medium">Đã gửi link đăng nhập!</p>
          <p className="mt-1 text-[var(--color-ink-muted)]">
            Kiểm tra email <b>{email}</b> và bấm vào link để vào học.
          </p>
        </div>
      ) : (
        <form onSubmit={loginWithEmail} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-ink-muted)]">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@email.com"
              className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] px-4 py-3 text-base outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !email}
            className="rounded-full bg-[var(--color-accent)] px-5 py-3 font-medium text-[var(--color-accent-ink)] disabled:opacity-50"
          >
            Gửi link đăng nhập
          </button>
        </form>
      )}

      {error && (
        <p className="text-sm text-[var(--color-bad)]">⚠ {error}</p>
      )}
    </main>
  );
}
