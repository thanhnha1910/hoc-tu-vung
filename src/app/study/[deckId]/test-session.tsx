"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Card } from "@/lib/types";
import { useStudySettings } from "@/lib/settings";
import { buildQuiz, type Question } from "@/lib/quiz-gen";
import { QuestionView, type Feedback } from "./qtype";
import { SettingsPanel } from "./settings-panel";
import type { TestConfigValues } from "./test-config";

interface Props {
  cards: Card[];
  config: TestConfigValues;
  deckId: string;
  onRestart: () => void;
}

interface AnsweredQ {
  question: Question;
  givenAnswer?: string;
  correct: boolean;
}

export function TestSession({ cards, config, deckId, onRestart }: Props) {
  const router = useRouter();
  const [settings, updateSettings] = useStudySettings();

  // Build quiz once — frozen for entire session
  const quiz = useMemo(
    () =>
      buildQuiz(cards, {
        count: config.count,
        questionTypes: config.types,
      }),
    [cards, config.count, config.types],
  );

  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState<AnsweredQ[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(
    config.timerSeconds,
  );
  const [submitted, setSubmitted] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft === null || submitted) return;
    if (secondsLeft <= 0) {
      setSubmitted(true);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, submitted]);

  const current = quiz[idx];

  function onAnswer(correct: boolean, given?: string) {
    if (feedback || !current) return;
    setFeedback(correct ? { kind: "correct", given } : { kind: "wrong", given });
    setAnswered((a) => [...a, { question: current, givenAnswer: given, correct }]);

    setTimeout(
      () => {
        setFeedback(null);
        if (idx + 1 >= quiz.length) {
          setSubmitted(true);
        } else {
          setIdx((i) => i + 1);
        }
      },
      correct ? 600 : 1300,
    );
  }

  if (quiz.length === 0) {
    return (
      <div className="my-auto flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-5xl">⚠️</p>
        <h2 className="text-xl font-semibold">Không tạo được câu hỏi</h2>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Kiểm tra lại lựa chọn dạng câu hoặc thêm thẻ vào bộ.
        </p>
        <button
          type="button"
          onClick={onRestart}
          className="mt-3 rounded-full bg-[var(--color-mode-test)] px-5 py-2 text-sm text-white"
        >
          Quay lại cấu hình
        </button>
      </div>
    );
  }

  // ─── Results screen ───
  if (submitted) {
    const correct = answered.filter((a) => a.correct).length;
    const total = quiz.length;
    const score = Math.round((correct / total) * 100);
    return (
      <div className="flex flex-1 flex-col gap-5">
        <header className="flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-5xl">
            {score >= 90 ? "🏆" : score >= 70 ? "🎉" : score >= 50 ? "👍" : "💪"}
          </p>
          <h2 className="text-2xl font-semibold">
            {correct} / {total} đúng
          </h2>
          <p
            className="text-3xl font-bold"
            style={{
              color:
                score >= 70
                  ? "var(--color-good)"
                  : score >= 50
                  ? "var(--color-warn)"
                  : "var(--color-bad)",
            }}
          >
            {score}%
          </p>
        </header>

        {/* Per-question review */}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-ink-muted)]">
            Xem lại đáp án ({answered.length})
          </h3>
          <ol className="flex flex-col gap-2">
            {answered.map((a, i) => (
              <li
                key={i}
                className={
                  "min-w-0 rounded-2xl border-l-4 bg-[var(--color-bg-elev)] p-3 text-sm " +
                  (a.correct
                    ? "border-l-[var(--color-good)]"
                    : "border-l-[var(--color-bad)]")
                }
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">
                    {i + 1}. {a.question.card.term}
                  </span>
                  <span
                    className={
                      "shrink-0 text-xs " +
                      (a.correct
                        ? "text-[var(--color-good)]"
                        : "text-[var(--color-bad)]")
                    }
                  >
                    {a.correct ? "✓ đúng" : "✕ sai"}
                  </span>
                </div>
                <div className="mt-1 break-words text-xs text-[var(--color-ink-muted)]">
                  Nghĩa: {a.question.card.definition}
                </div>
                {!a.correct && a.givenAnswer && (
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                    <span className="text-[var(--color-bad)]">
                      Bạn chọn: <b>{a.givenAnswer}</b>
                    </span>
                    <span className="text-[var(--color-good)]">
                      Đúng: <b>{a.question.expectedAnswer}</b>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onRestart}
            className="tap rounded-full border border-[var(--color-line)] px-5 text-sm font-medium"
          >
            Làm lại
          </button>
          <Link
            href={`/decks/${deckId}`}
            onClick={() => router.refresh()}
            className="tap rounded-full bg-[var(--color-mode-test)] px-5 text-center text-sm font-semibold text-white"
          >
            Về bộ thẻ
          </Link>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-[var(--color-ink-muted)] sm:gap-3">
          <span className="shrink-0 font-mono font-medium">
            <span className="text-[var(--color-ink)]">{idx + 1}</span>/{quiz.length}
          </span>
          <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-line)]">
            <div
              className="h-full bg-[var(--color-mode-test)] transition-[width]"
              style={{ width: `${((idx + 1) / quiz.length) * 100}%` }}
            />
          </div>
          {secondsLeft !== null && (
            <span
              className={
                "shrink-0 font-mono " +
                (secondsLeft < 30 ? "text-[var(--color-bad)]" : "")
              }
            >
              {Math.floor(secondsLeft / 60)}:
              {String(secondsLeft % 60).padStart(2, "0")}
            </span>
          )}
        </div>
        <SettingsPanel settings={settings} onChange={updateSettings} />
      </div>

      {/* Question canvas */}
      <div
        key={idx}
        className="flex flex-1 flex-col gap-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-3 sm:rounded-[var(--radius-card)] sm:p-6 md:p-8"
      >
        <QuestionView
          question={current}
          feedback={feedback}
          speechRate={settings.speechRate}
          voiceURI={settings.voiceURI}
          onAnswer={onAnswer}
        />
      </div>

      <button
        type="button"
        onClick={() => setSubmitted(true)}
        className="text-center text-xs text-[var(--color-ink-muted)] underline-offset-2 hover:underline"
      >
        Nộp bài sớm
      </button>
    </div>
  );
}
