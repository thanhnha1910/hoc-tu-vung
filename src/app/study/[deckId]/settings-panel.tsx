"use client";

import { useEffect, useState } from "react";
import type { StudySettings } from "@/lib/settings";
import { getEnglishVoices, speak, unlock } from "@/lib/tts";

interface Props {
  settings: StudySettings;
  onChange: (patch: Partial<StudySettings>) => void;
}

export function SettingsPanel({ settings, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open || !("speechSynthesis" in window)) return;
    const refresh = () => setVoices(getEnglishVoices());
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Cài đặt"
        className="tap flex items-center justify-center rounded-full border border-[var(--color-line)] text-base"
      >
        ⚙
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <aside
            className="flex h-full w-full max-w-sm flex-col gap-5 overflow-y-auto bg-[var(--color-bg)] p-5 shadow-2xl"
            style={{
              paddingTop: "max(env(safe-area-inset-top), 1.25rem)",
              paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Cài đặt học</h2>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setOpen(false)}
                className="tap flex items-center justify-center rounded-full border border-[var(--color-line)]"
              >
                ✕
              </button>
            </header>

            <Toggle
              label="Trộn thẻ ngẫu nhiên"
              hint="Mỗi phiên học sẽ xáo trộn thứ tự"
              checked={settings.shuffle}
              onChange={(v) => onChange({ shuffle: v })}
            />

            <Toggle
              label="Tự đọc tiếng Anh"
              hint="Tự động phát âm khi hiện thẻ mới"
              checked={settings.autoPlay}
              onChange={(v) => onChange({ autoPlay: v })}
            />

            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-4">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium">Giọng đọc tiếng Anh</span>
                <select
                  value={settings.voiceURI ?? ""}
                  onChange={(event) =>
                    onChange({ voiceURI: event.target.value || null })
                  }
                  className="min-h-11 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-3 outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="">Tự chọn giọng hay nhất</option>
                  {voices.map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} · {voice.lang}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  unlock();
                  speak(
                    "Lifestyle choices affect our health and well-being.",
                    settings.speechRate,
                    settings.voiceURI,
                  );
                }}
                className="tap rounded-xl border border-[var(--color-line)] px-4 text-sm font-semibold"
              >
                🔊 Nghe thử giọng này
              </button>
              {voices.length === 0 && (
                <p className="text-xs text-[var(--color-ink-muted)]">
                  Trình duyệt chưa tải danh sách giọng. Hãy bấm nghe thử hoặc mở
                  lại cài đặt sau vài giây.
                </p>
              )}
            </div>

            <fieldset className="flex flex-col gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-4">
              <legend className="px-1 text-sm font-medium">
                Mặt trước hiển thị
              </legend>
              <p className="-mt-1 text-xs text-[var(--color-ink-muted)]">
                Mặt nào hiện trước khi chưa lật
              </p>
              <label className="mt-1 flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={settings.frontSide === "term"}
                  onChange={() => onChange({ frontSide: "term" })}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
                <span>Tiếng Anh (English term)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={settings.frontSide === "definition"}
                  onChange={() => onChange({ frontSide: "definition" })}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
                <span>Tiếng Việt (nghĩa)</span>
              </label>
            </fieldset>

            <div className="flex flex-col gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">Tốc độ đọc</span>
                <span className="text-[var(--color-ink-muted)]">
                  {settings.speechRate.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                value={settings.speechRate}
                onChange={(e) =>
                  onChange({ speechRate: Number(e.target.value) })
                }
                className="w-full accent-[var(--color-accent)]"
              />
            </div>

            <p className="mt-auto text-xs text-[var(--color-ink-muted)]">
              Cài đặt được lưu trong trình duyệt — không cần đăng nhập lại.
            </p>
          </aside>
        </div>
      )}
    </>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-4">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {hint && (
          <span className="text-xs text-[var(--color-ink-muted)]">{hint}</span>
        )}
      </div>
      <span
        role="switch"
        aria-checked={checked}
        className={`relative inline-block h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? "bg-[var(--color-accent)]" : "bg-[var(--color-line)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
    </label>
  );
}
