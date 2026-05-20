"use client";

/**
 * Reusable question-type renderers — used by both Học and Kiểm tra.
 * Quizlet-inspired UI: numbered options, "Bạn không biết?", clear labels.
 *
 * Common contract:
 *   - Show prompt + answer UI
 *   - When user picks/submits, call onAnswer(correct, givenText?)
 *   - When `feedback` !== null, freeze UI and highlight correct/wrong
 *   - Optional onGiveUp: user surrenders, treated as a wrong answer
 */
import { useEffect, useState } from "react";
import type { Question } from "@/lib/quiz-gen";
import { isCorrect } from "@/lib/quiz-gen";
import { speak, unlock } from "@/lib/tts";

export type Feedback =
  | { kind: "correct"; given?: string }
  | { kind: "wrong"; given?: string }
  | null;

interface BaseProps {
  question: Question;
  feedback: Feedback;
  speechRate: number;
  onAnswer: (correct: boolean, given?: string) => void;
  /** Optional surrender — treated as wrong, reveals answer. */
  onGiveUp?: () => void;
  /** Show "1/2/3/4" number hints on MCQ (and listen to those keys). */
  numbered?: boolean;
}

// ─── Public dispatch ───
export function QuestionView(props: BaseProps) {
  switch (props.question.type) {
    case "preview":
      return <PreviewQ {...props} />;
    case "mcq-def-to-term":
    case "mcq-term-to-def":
      return <McqQ {...props} />;
    case "tf":
      return <TfQ {...props} />;
    case "write":
      return <WriteQ {...props} />;
    case "cloze":
      return <ClozeQ {...props} />;
  }
}

// ─── Shared prompt header ───
function PromptHeader({
  label,
  prompt,
  speakable,
  rate,
}: {
  label: string;
  prompt: string;
  speakable?: boolean;
  rate: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
        {label}
      </span>
      <div className="flex items-start gap-2 sm:gap-3">
        <p className="min-w-0 flex-1 break-words text-xl font-semibold leading-snug sm:text-3xl md:text-4xl">
          {prompt}
        </p>
        {speakable && (
          <button
            type="button"
            aria-label="Phát âm"
            onClick={(e) => {
              e.stopPropagation();
              unlock();
              speak(prompt, rate);
            }}
            className="tap shrink-0 rounded-full border border-[var(--color-line)] text-lg"
          >
            🔊
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Bottom action row: "Bạn không biết?" + extras ───
function ActionRow({
  onGiveUp,
  disabled,
  extra,
}: {
  onGiveUp?: () => void;
  disabled?: boolean;
  extra?: React.ReactNode;
}) {
  if (!onGiveUp && !extra) return null;
  return (
    <div className="mt-2 flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-[var(--color-ink-muted)]">
        {extra}
      </span>
      {onGiveUp && (
        <button
          type="button"
          onClick={onGiveUp}
          disabled={disabled}
          className="text-sm font-semibold text-[var(--color-accent)] underline-offset-2 hover:underline disabled:opacity-40"
        >
          Bạn không biết?
        </button>
      )}
    </div>
  );
}

// ─── 1. Preview ───
function PreviewQ({ question, onAnswer, speechRate }: BaseProps) {
  return (
    <div className="flex flex-1 flex-col gap-5">
      <PromptHeader
        label="Từ mới — hãy nhớ kỹ"
        prompt={question.card.term}
        speakable
        rate={speechRate}
      />
      <p className="text-lg text-[var(--color-ink-muted)] sm:text-xl">
        {question.card.definition}
      </p>
      {question.card.example && (
        <p className="text-sm italic text-[var(--color-ink-muted)] sm:text-base">
          &ldquo;{question.card.example}&rdquo;
        </p>
      )}
      <div className="mt-auto">
        <button
          type="button"
          onClick={() => {
            unlock();
            onAnswer(true);
          }}
          className="tap w-full rounded-full bg-[var(--color-mode-learn)] px-6 text-base font-semibold text-white"
        >
          Đã thấy — học tiếp
        </button>
      </div>
    </div>
  );
}

// ─── 2. MCQ ───
function McqQ({ question, feedback, onAnswer, onGiveUp, speechRate, numbered = true }: BaseProps) {
  const isDefToTerm = question.type === "mcq-def-to-term";
  const promptLabel = isDefToTerm ? "Định nghĩa" : "Thuật ngữ";

  // Keyboard 1-4 to pick option
  useEffect(() => {
    if (feedback || !numbered) return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = Number(e.key);
      if (!Number.isFinite(n) || n < 1 || n > 4) return;
      const opt = question.options?.[n - 1];
      if (!opt) return;
      e.preventDefault();
      unlock();
      onAnswer(isCorrect(opt, question.expectedAnswer), opt);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [feedback, numbered, question, onAnswer]);

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PromptHeader
        label={promptLabel}
        prompt={question.prompt}
        speakable={!isDefToTerm}
        rate={speechRate}
      />

      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
          Chọn đáp án đúng
        </span>
        <div className="grid gap-3 sm:grid-cols-2">
          {question.options?.map((opt, i) => {
            const isExpected = isCorrect(opt, question.expectedAnswer);
            const isPickedWrong =
              feedback?.kind === "wrong" && feedback.given === opt;
            const isPickedRight =
              feedback?.kind === "correct" && feedback.given === opt;
            const stateClass = feedback
              ? isExpected
                ? "border-[var(--color-good)] bg-[color-mix(in_oklch,var(--color-good)_12%,transparent)] text-[var(--color-good)]"
                : isPickedWrong
                ? "border-[var(--color-bad)] bg-[color-mix(in_oklch,var(--color-bad)_12%,transparent)] text-[var(--color-bad)]"
                : "border-[var(--color-line)] opacity-50"
              : "border-[var(--color-line)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-elev-2)]";

            return (
              <button
                key={opt + i}
                type="button"
                disabled={!!feedback}
                onClick={() => {
                  unlock();
                  onAnswer(isCorrect(opt, question.expectedAnswer), opt);
                }}
                className={`tap group relative flex min-h-14 items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left text-sm font-medium transition-all sm:min-h-16 sm:gap-5 sm:px-5 sm:py-4 sm:text-lg ${stateClass}`}
              >
                {numbered && (
                  <span
                    className={
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-mono font-normal sm:h-7 sm:w-7 sm:text-sm " +
                      (feedback && (isExpected || isPickedWrong || isPickedRight)
                        ? "border-current"
                        : "border-[var(--color-line)] text-[var(--color-ink-muted)]")
                    }
                  >
                    {i + 1}
                  </span>
                )}
                <span className="min-w-0 flex-1 break-words leading-snug">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ActionRow onGiveUp={onGiveUp} disabled={!!feedback} />
    </div>
  );
}

// ─── 3. True / False ───
function TfQ({ question, feedback, onAnswer, onGiveUp, speechRate }: BaseProps) {
  // Keyboard: 1=True, 2=False
  useEffect(() => {
    if (feedback) return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "1" || e.key.toLowerCase() === "t") {
        e.preventDefault();
        unlock();
        onAnswer(question.shownIsCorrect === true, "true");
      } else if (e.key === "2" || e.key.toLowerCase() === "f") {
        e.preventDefault();
        unlock();
        onAnswer(question.shownIsCorrect === false, "false");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [feedback, question, onAnswer]);

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PromptHeader
        label="Thuật ngữ"
        prompt={question.card.term}
        speakable
        rate={speechRate}
      />
      <div>
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
          Nghĩa này đúng hay sai?
        </span>
        <div className="mt-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)] p-4 text-lg sm:p-5 sm:text-xl">
          {question.shownDefinition}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <TfBtn
          label="Đúng"
          symbol="✓"
          state={tfState(feedback, true, question.shownIsCorrect === true)}
          onClick={() => {
            unlock();
            onAnswer(question.shownIsCorrect === true, "true");
          }}
        />
        <TfBtn
          label="Sai"
          symbol="✕"
          state={tfState(feedback, false, question.shownIsCorrect === false)}
          onClick={() => {
            unlock();
            onAnswer(question.shownIsCorrect === false, "false");
          }}
        />
      </div>
      <ActionRow onGiveUp={onGiveUp} disabled={!!feedback} />
    </div>
  );
}

type TfBtnState = "neutral" | "correct" | "wrong" | "dimmed";

/**
 * Determine button visual state.
 * Rule: the CORRECT answer button always lights GREEN; the user's WRONG pick
 * lights RED; everything else is dimmed/neutral. Button identity (Đúng vs Sai)
 * does NOT determine the color — only correctness does.
 */
function tfState(
  feedback: Feedback,
  thisButtonValue: boolean,
  isCorrectAnswer: boolean,
): TfBtnState {
  if (!feedback) return "neutral";
  if (isCorrectAnswer) return "correct";
  const userPickedValue =
    feedback.given === "true" ? true : feedback.given === "false" ? false : null;
  if (userPickedValue === thisButtonValue) return "wrong";
  return "dimmed";
}

function TfBtn({
  label,
  symbol,
  state,
  onClick,
}: {
  label: string;
  symbol: string;
  state: TfBtnState;
  onClick: () => void;
}) {
  const disabled = state !== "neutral";
  const colorVar =
    state === "correct"
      ? "var(--color-good)"
      : state === "wrong"
      ? "var(--color-bad)"
      : null;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="tap flex flex-col items-center gap-1 rounded-2xl border-2 px-4 py-4 text-base font-semibold transition-colors sm:text-lg"
      style={{
        borderColor: colorVar ?? "var(--color-line)",
        background: colorVar
          ? `color-mix(in oklch, ${colorVar} 18%, transparent)`
          : "transparent",
        color: colorVar ?? undefined,
        opacity: state === "dimmed" ? 0.45 : 1,
      }}
    >
      <span className="text-xl">{symbol}</span>
      {label}
    </button>
  );
}

// ─── 4. Write ───
function WriteQ({ question, feedback, onAnswer, onGiveUp }: BaseProps) {
  const [val, setVal] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback || !val.trim()) return;
    unlock();
    onAnswer(isCorrect(val, question.expectedAnswer), val);
  };

  const isOk = feedback?.kind === "correct";
  const isWrong = feedback?.kind === "wrong";

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-5">
      <PromptHeader
        label="Định nghĩa"
        prompt={question.prompt}
        rate={0}
      />
      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
          Gõ từ tiếng Anh tương ứng
        </span>
        <input
          autoFocus
          value={feedback ? feedback.given ?? val : val}
          onChange={(e) => setVal(e.target.value)}
          disabled={!!feedback}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Type the English word..."
          className={
            "rounded-2xl border-2 bg-[var(--color-bg)] px-4 py-3 text-lg outline-none transition-colors sm:text-xl " +
            (isOk
              ? "border-[var(--color-good)] text-[var(--color-good)]"
              : isWrong
              ? "border-[var(--color-bad)] text-[var(--color-bad)]"
              : "border-[var(--color-mode-learn)]/40 focus:border-[var(--color-mode-learn)]")
          }
        />
        {isWrong && (
          <p className="text-sm">
            Đáp án đúng:{" "}
            <b className="text-[var(--color-good)]">{question.expectedAnswer}</b>
          </p>
        )}
        <button
          type="submit"
          disabled={!val.trim() || !!feedback}
          className="tap rounded-full bg-[var(--color-mode-learn)] px-6 text-base font-semibold text-white disabled:opacity-50"
        >
          Kiểm tra
        </button>
      </div>
      <ActionRow onGiveUp={onGiveUp} disabled={!!feedback} />
    </form>
  );
}

// ─── 5. Cloze ───
function ClozeQ({ question, feedback, onAnswer, onGiveUp }: BaseProps) {
  const [val, setVal] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback || !val.trim()) return;
    unlock();
    onAnswer(isCorrect(val, question.expectedAnswer), val);
  };
  const isOk = feedback?.kind === "correct";
  const isWrong = feedback?.kind === "wrong";

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-5">
      <PromptHeader
        label="Điền vào chỗ trống"
        prompt={question.clozeSentence ?? question.prompt}
        rate={0}
      />
      <p className="text-sm text-[var(--color-ink-muted)]">
        Nghĩa:{" "}
        <span className="text-[var(--color-ink)]">
          {question.card.definition}
        </span>
      </p>
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          value={feedback ? feedback.given ?? val : val}
          onChange={(e) => setVal(e.target.value)}
          disabled={!!feedback}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Từ điền vào chỗ ____"
          className={
            "rounded-2xl border-2 bg-[var(--color-bg)] px-4 py-3 text-lg outline-none transition-colors sm:text-xl " +
            (isOk
              ? "border-[var(--color-good)] text-[var(--color-good)]"
              : isWrong
              ? "border-[var(--color-bad)] text-[var(--color-bad)]"
              : "border-[var(--color-mode-learn)]/40 focus:border-[var(--color-mode-learn)]")
          }
        />
        {isWrong && (
          <p className="text-sm">
            Đáp án đúng:{" "}
            <b className="text-[var(--color-good)]">{question.expectedAnswer}</b>
          </p>
        )}
        <button
          type="submit"
          disabled={!val.trim() || !!feedback}
          className="tap rounded-full bg-[var(--color-mode-learn)] px-6 text-base font-semibold text-white disabled:opacity-50"
        >
          Kiểm tra
        </button>
      </div>
      <ActionRow onGiveUp={onGiveUp} disabled={!!feedback} />
    </form>
  );
}
