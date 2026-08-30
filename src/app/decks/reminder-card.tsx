"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function toApplicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = window.atob(
    (value + padding).replace(/-/g, "+").replace(/_/g, "/"),
  );
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function isIosDevice() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function ReminderCard() {
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(20);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    const canPush =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(canPush);
    setInstalled(isStandalone());
    setIos(isIosDevice());

    function captureInstall(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }
    function markInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", captureInstall);
    window.addEventListener("appinstalled", markInstalled);

    if (canPush) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(async (registration) => {
          const subscription =
            await registration.pushManager.getSubscription();
          if (!subscription) return;
          const sb = createSupabaseBrowserClient();
          const { data } = await sb
            .from("push_subscriptions")
            .select("preferred_hour")
            .eq("endpoint", subscription.endpoint)
            .maybeSingle();
          if (data?.preferred_hour !== undefined) {
            setEnabled(true);
            setHour(data.preferred_hour);
          }
        })
        .catch(() => setSupported(false));
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstall);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  }

  async function enableNotifications() {
    setBusy(true);
    setMessage(null);
    try {
      if (!publicKey) {
        throw new Error("Máy chủ chưa cấu hình khóa thông báo");
      }
      if (ios && !isStandalone()) {
        throw new Error(
          "Trên iPhone/iPad, hãy thêm app vào Màn hình chính trước",
        );
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Bạn chưa cho phép ứng dụng gửi thông báo");
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toApplicationServerKey(publicKey),
        }));
      const json = subscription.toJSON();
      if (!json.keys?.p256dh || !json.keys.auth) {
        throw new Error("Thiết bị không trả về khóa thông báo");
      }

      const sb = createSupabaseBrowserClient();
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) throw new Error("Phiên đăng nhập đã hết hạn");
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        "Asia/Ho_Chi_Minh";
      const { error } = await sb.from("push_subscriptions").upsert(
        {
          owner_id: auth.user.id,
          endpoint: subscription.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          timezone,
          preferred_hour: hour,
          enabled: true,
          last_notified_on: null,
        },
        { onConflict: "endpoint" },
      );
      if (error) throw error;
      setEnabled(true);
      setMessage("Đã bật nhắc học trên thiết bị này");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không bật được thông báo",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const sb = createSupabaseBrowserClient();
        const { error } = await sb
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", subscription.endpoint);
        if (error) throw error;
        await subscription.unsubscribe();
      }
      setEnabled(false);
      setMessage("Đã tắt nhắc học trên thiết bị này");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không tắt được thông báo",
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeHour(nextHour: number) {
    setHour(nextHour);
    setMessage(null);
    if (!enabled) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const sb = createSupabaseBrowserClient();
    const { error } = await sb
      .from("push_subscriptions")
      .update({ preferred_hour: nextHour })
      .eq("endpoint", subscription.endpoint);
    setMessage(
      error
        ? error.message
        : `Đã đổi giờ nhắc sang ${String(nextHour).padStart(2, "0")}:00`,
    );
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/push/test", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Không gửi được thông báo thử");
      }
      setMessage("Đã gửi thông báo thử—hãy kiểm tra thiết bị");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không gửi được thông báo thử",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Nhắc học trên điện thoại</h2>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
              {enabled
                ? `Đang bật · ${String(hour).padStart(2, "0")}:00 mỗi ngày`
                : "Cài app và nhận lời nhắc đúng giờ"}
            </p>
          </div>
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent-soft)]"
            aria-hidden
          >
            {enabled ? "🔔" : "🔕"}
          </span>
        </div>
      </summary>

      <div className="mt-4 flex flex-col gap-3 border-t border-[var(--color-line)] pt-4">
        {!installed && installPrompt && (
          <button
            type="button"
            onClick={installApp}
            className="tap rounded-2xl border border-[var(--color-accent)] px-4 font-semibold text-[var(--color-accent)]"
          >
            Cài ứng dụng lên máy
          </button>
        )}
        {!installed && ios && (
          <p className="rounded-2xl bg-[var(--color-bg)] px-4 py-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
            Trên iPhone/iPad: bấm Chia sẻ <b>□↑</b> →{" "}
            <b>Thêm vào Màn hình chính</b>, sau đó mở app từ biểu tượng mới.
          </p>
        )}

        <label className="flex items-center justify-between gap-4 rounded-2xl bg-[var(--color-bg)] px-4 py-3 text-sm">
          <span>Giờ nhắc mỗi ngày</span>
          <select
            value={hour}
            onChange={(event) => void changeHour(Number(event.target.value))}
            className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] px-3 py-2 font-semibold"
          >
            {[7, 8, 9, 12, 18, 19, 20, 21, 22].map((value) => (
              <option key={value} value={value}>
                {String(value).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>

        {!supported ? (
          <p className="text-sm text-[var(--color-bad)]">
            Trình duyệt này chưa hỗ trợ thông báo Web Push.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={enabled ? disableNotifications : enableNotifications}
              className="tap rounded-2xl bg-[var(--color-accent)] px-4 font-semibold text-[var(--color-accent-ink)] disabled:opacity-50"
            >
              {busy
                ? "Đang xử lý…"
                : enabled
                  ? "Tắt thông báo"
                  : "Bật thông báo"}
            </button>
            {enabled && (
              <button
                type="button"
                disabled={busy}
                onClick={sendTest}
                className="tap rounded-2xl border border-[var(--color-line)] px-4 font-semibold disabled:opacity-50"
              >
                Gửi thử ngay
              </button>
            )}
          </div>
        )}
        {message && (
          <p
            className="text-sm text-[var(--color-ink-muted)]"
            aria-live="polite"
          >
            {message}
          </p>
        )}
      </div>
    </details>
  );
}
