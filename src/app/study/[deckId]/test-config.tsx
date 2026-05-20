"use client";

import { useState } from "react";
import type { Card } from "@/lib/types";
import type { QuestionType } from "@/lib/quiz-gen";

export interface TestConfigValues {
  count: number;
  types: QuestionType[];
  timerSeconds: number | null;
}

interface Props {
  cards: Card[];
  deckId: string;
  onStart: (cfg: TestConfigValues) => void;
}

const COUNT_OPTIONS = [5, 10, 20, 30];

const TYPE_LABELS: Record<QuestionType, string> = {
  preview: "Xem trước (không tính)",
  "mcq-def-to-term": "Trắc nghiệm: chọn từ Anh",
  "mcq-term-to-def": "Trắc nghiệm: chọn nghĩa Việt",
  tf: "Đúng / Sai",
  write: "Viết (gõ từ)",
  cloze: "Điền vào chỗ trống",
};

const SELECTABLE_TYPES: QuestionType[] = [
  "mcq-def-to-term",
  "mcq-term-to-def",
  "tf",
  "write",
  "cloze",
];

export function TestConfig({ cards, onStart }: Props) {
  const hasExample = cards.some(
    (c) =>
      c.example &&
      c.example.toLowerCase().includes(c.term.toLowerCase()),
  );

  const [count, setCount] = useState<number>(
    Math.min(10, cards.length),
  );
  const [types, setTypes] = useState<Set<QuestionType>>(
    new Set<QuestionType>(["mcq-def-to-term", "tf", "write"]),
  );
  const [timerOn, setTimerOn] = useState(false);
  const [timerMin, setTimerMin] = useState(5);

  function toggleType(t: QuestionType) {
    setTypes((s) => {
      const next = new Set(s);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function start() {
    onStart({
      count,
      types: Array.from(types),
      timerSeconds: timerOn ? timerMin * 60 : null,
    });
  }

  const canStart = types.size > 0 && count > 0 && cards.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <header>
        <h2 className="text-xl font-semibold">Cấu hình bài kiểm tra</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          {cards.length} thẻ trong bộ — chọn số câu hỏi và dạng câu
        </p>
      </header>

      {/* Number of questions */}
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-4">
        <legend className="px-1 text-sm font-semibold">Số câu hỏi</legend>
        <div className="flex flex-wrap gap-2">
          {COUNT_OPTIONS.filter((n) => n <= cards.length).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={
                "tap rounded-full px-4 text-sm font-medium sm:px-5 " +
                (count === n
                  ? "bg-[var(--color-mode-test)] text-white"
                  : "border border-[var(--color-line)]")
              }
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCount(cards.length)}
            className={
              "tap rounded-full px-4 text-sm font-medium sm:px-5 " +
              (count === cards.length
                ? "bg-[var(--color-mode-test)] text-white"
                : "border border-[var(--color-line)]")
            }
          >
            Tất cả ({cards.length})
          </button>
        </div>
      </fieldset>

      {/* Question types */}
      <fieldset className="flex flex-col gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-4">
        <legend className="px-1 text-sm font-semibold">
          Dạng câu hỏi
        </legend>
        {SELECTABLE_TYPES.map((t) => {
          const disabled = t === "cloze" && !hasExample;
          return (
            <label
              key={t}
              className={
                "flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm transition-colors " +
                (disabled
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer hover:bg-[var(--color-bg-elev-2)]")
              }
            >
              <input
                type="checkbox"
                checked={types.has(t)}
                disabled={disabled}
                onChange={() => toggleType(t)}
                className="h-4 w-4 accent-[var(--color-mode-test)]"
              />
              <span>{TYPE_LABELS[t]}</span>
              {disabled && (
                <span className="ml-auto text-xs text-[var(--color-ink-muted)]">
                  (thẻ chưa có ví dụ)
                </span>
              )}
            </label>
          );
        })}
      </fieldset>

      {/* Timer */}
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-4">
        <legend className="px-1 text-sm font-semibold">
          Đếm ngược (tùy chọn)
        </legend>
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={timerOn}
            onChange={(e) => setTimerOn(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-mode-test)]"
          />
          Bật đếm ngược
        </label>
        {timerOn && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={60}
              value={timerMin}
              onChange={(e) => setTimerMin(Number(e.target.value))}
              className="w-24 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2 text-base"
              inputMode="numeric"
            />
            <span className="text-sm text-[var(--color-ink-muted)]">phút</span>
          </div>
        )}
      </fieldset>

      <button
        type="button"
        onClick={start}
        disabled={!canStart}
        className="tap mt-auto rounded-full bg-[var(--color-mode-test)] px-6 text-base font-semibold text-white disabled:opacity-50"
      >
        Bắt đầu kiểm tra
      </button>
    </div>
  );
}
