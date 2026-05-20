"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  parseImport,
  resolveColSep,
  resolveRowSep,
  type ColSepKind,
  type RowSepKind,
} from "@/lib/parse-import";
import { bulkCreateCards } from "@/lib/repo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const PLACEHOLDER = `ephemeral\tnhất thời, ngắn ngủi
serendipity\tsự may mắn tình cờ
ubiquitous\tphổ biến khắp nơi`;

export function ImportModal({ deckId }: { deckId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [colKind, setColKind] = useState<ColSepKind>("tab");
  const [colCustom, setColCustom] = useState(" - ");
  const [rowKind, setRowKind] = useState<RowSepKind>("newline");
  const [rowCustom, setRowCustom] = useState(";;");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const parsed = useMemo(() => {
    if (!raw.trim()) return { rows: [], validCount: 0, warningCount: 0 };
    return parseImport(
      raw,
      resolveColSep(colKind, colCustom),
      resolveRowSep(rowKind, rowCustom),
    );
  }, [raw, colKind, colCustom, rowKind, rowCustom]);

  function onImport() {
    setErr(null);
    const validRows = parsed.rows.filter((r) => !r.warning);
    if (validRows.length === 0) {
      setErr("Không có thẻ hợp lệ để nhập");
      return;
    }
    start(async () => {
      try {
        const sb = createSupabaseBrowserClient();
        const n = await bulkCreateCards(sb, deckId, validRows);
        setOpen(false);
        setRaw("");
        router.refresh();
        // tiny visual hint via alert; could be replaced by a toast later
        alert(`Đã nhập ${n} thẻ 🎉`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Lỗi khi nhập");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap rounded-full border border-dashed border-[var(--color-line)] px-4 text-sm font-medium text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        ⚡ Nhập nhanh
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg)]"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Nhập dữ liệu</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Chép và dán dữ liệu ở đây (từ Quizlet, Word, Excel, Google Docs...)
          </p>
        </div>
        <button
          type="button"
          aria-label="Đóng"
          onClick={() => setOpen(false)}
          className="tap flex items-center justify-center rounded-full border border-[var(--color-line)] text-lg text-[var(--color-ink-muted)]"
        >
          ✕
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <textarea
          autoFocus
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={PLACEHOLDER}
          className="min-h-44 w-full rounded-2xl border-2 border-[var(--color-accent)]/40 bg-[var(--color-bg-elev)] p-4 font-mono text-sm leading-relaxed outline-none focus:border-[var(--color-accent)]"
          spellCheck={false}
        />

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <SepGroup
            title="Giữa thuật ngữ và định nghĩa"
            options={[
              { value: "tab", label: "Tab" },
              { value: "comma", label: "Phẩy ( , )" },
            ]}
            value={colKind}
            onChange={(v) => setColKind(v as ColSepKind)}
            customValue={colCustom}
            onCustomChange={setColCustom}
          />
          <SepGroup
            title="Giữa các thẻ"
            options={[
              { value: "newline", label: "Dòng mới" },
              { value: "semicolon", label: "Chấm phẩy ( ; )" },
            ]}
            value={rowKind}
            onChange={(v) => setRowKind(v as RowSepKind)}
            customValue={rowCustom}
            onCustomChange={setRowCustom}
          />
        </div>

        {/* Preview */}
        <div className="mt-6">
          <h3 className="flex items-baseline gap-2 text-sm font-semibold">
            Xem trước
            <span className="text-xs font-normal text-[var(--color-ink-muted)]">
              {parsed.validCount} thẻ
              {parsed.warningCount > 0 && (
                <span className="ml-1 text-[var(--color-bad)]">
                  · {parsed.warningCount} lỗi
                </span>
              )}
            </span>
          </h3>

          {parsed.rows.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-ink-muted)]">
              Không có nội dung để xem trước
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--color-line)] overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)]">
              {parsed.rows.slice(0, 10).map((r, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[1fr_1fr] gap-3 px-4 py-2.5 text-sm"
                >
                  <span
                    className={
                      r.warning && !r.term
                        ? "text-[var(--color-bad)] italic"
                        : "font-medium"
                    }
                  >
                    {r.term || "(trống)"}
                  </span>
                  <span
                    className={
                      r.warning && !r.definition
                        ? "text-[var(--color-bad)] italic"
                        : "text-[var(--color-ink-muted)]"
                    }
                    title={r.warning}
                  >
                    {r.definition || "(trống)"}
                    {r.warning && (
                      <span className="ml-1 text-xs text-[var(--color-bad)]">
                        ⚠
                      </span>
                    )}
                  </span>
                </li>
              ))}
              {parsed.rows.length > 10 && (
                <li className="px-4 py-2 text-center text-xs text-[var(--color-ink-muted)]">
                  ... và {parsed.rows.length - 10} dòng nữa
                </li>
              )}
            </ul>
          )}
        </div>

        {err && (
          <p className="mt-4 text-sm text-[var(--color-bad)]">⚠ {err}</p>
        )}
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-end gap-2 border-t border-[var(--color-line)] bg-[var(--color-bg)] px-5 py-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="tap rounded-full border border-[var(--color-line)] px-5 text-sm font-medium"
        >
          Hủy nhập
        </button>
        <button
          type="button"
          onClick={onImport}
          disabled={pending || parsed.validCount === 0}
          className="tap rounded-full bg-[var(--color-accent)] px-6 text-sm font-semibold text-[var(--color-accent-ink)] disabled:opacity-50"
        >
          {pending ? "Đang nhập..." : `Nhập ${parsed.validCount} thẻ`}
        </button>
      </footer>
    </div>
  );
}

interface Option {
  value: string;
  label: string;
}

function SepGroup({
  title,
  options,
  value,
  onChange,
  customValue,
  onCustomChange,
}: {
  title: string;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  customValue: string;
  onCustomChange: (v: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">{title}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className="flex items-center gap-2 text-sm"
        >
          <input
            type="radio"
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          {o.label}
        </label>
      ))}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          checked={value === "custom"}
          onChange={() => onChange("custom")}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        <input
          value={customValue}
          onChange={(e) => {
            onCustomChange(e.target.value);
            onChange("custom");
          }}
          placeholder="Tùy chỉnh"
          className="min-w-0 flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-elev)] px-2 py-1 text-base sm:max-w-32"
        />
      </label>
    </fieldset>
  );
}
