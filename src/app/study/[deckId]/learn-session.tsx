"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Card, Rating } from "@/lib/types";
import { RATING } from "@/lib/types";
import { gradeCard } from "@/lib/srs";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { insertReviewLog, updateCardSrs } from "@/lib/repo";
import { speak } from "@/lib/tts";
import { useStudySettings } from "@/lib/settings";
import {
  generateQuestion,
  pickQuestionType,
  type Question,
} from "@/lib/quiz-gen";
import { SettingsPanel } from "./settings-panel";
import { QuestionView, type Feedback } from "./qtype";

interface Props {
  initialCards: Card[];
}

const MASTERY_LEVEL = 4;

interface CardState {
  card: Card;
  fam: number;
  lapses: number;
  /** True once we've written an FSRS log for this card (avoid double-logging). */
  fsrsWritten: boolean;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Anki-style: map session performance → FSRS rating. */
function ratingFor(state: CardState, finishedMastery: boolean): Rating {
  if (finishedMastery) {
    if (state.lapses === 0) return RATING.GOOD;
    if (state.lapses <= 2) return RATING.HARD;
    return RATING.AGAIN;
  }
  if (state.fam >= 3) return RATING.HARD;
  return RATING.AGAIN;
}

export function LearnSession({ initialCards }: Props) {
  const router = useRouter();
  const [settings, updateSettings] = useStudySettings();

  const [states, setStates] = useState<CardState[]>(() => {
    const ordered = settings.shuffle
      ? shuffleArray(initialCards)
      : initialCards;
    return ordered.map((c) => ({
      card: c,
      fam: 0,
      lapses: 0,
      fsrsWritten: false,
    }));
  });
  const [cursor, setCursor] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // ─── Card rotation ───
  const unmasteredIdxs = useMemo(
    () =>
      states
        .map((s, i) => ({ i, fam: s.fam }))
        .filter((s) => s.fam < MASTERY_LEVEL)
        .sort((a, b) => a.fam - b.fam)
        .map((s) => s.i),
    [states],
  );

  const currentIdx =
    unmasteredIdxs[cursor % Math.max(unmasteredIdxs.length, 1)] ?? -1;
  const current = currentIdx >= 0 ? states[currentIdx] : null;

  // ─── Question generation — frozen during feedback to avoid mid-answer change ───
  // We cache the question keyed by (cardId, fam). useMemo only recomputes when the
  // CURRENT question's identity changes — and because we defer state mutation
  // until after feedback clears, fam doesn't tick mid-feedback.
  const question: Question | null = useMemo(() => {
    if (!current) return null;
    const type = pickQuestionType(current.fam, current.card);
    return generateQuestion(
      current.card,
      type,
      states.map((s) => s.card),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.card.id, current?.fam]);

  // NOTE: No auto-speak in Học mode — speaking the term BEFORE the user
  // picks an answer would leak the answer for "def→term" questions. We only
  // speak after the user answers (see onAnswer) or when they tap the speaker
  // icon explicitly.

  // ─── Persist FSRS for one card ───
  const persistFsrsForCard = useCallback(
    (state: CardState, mastered: boolean) => {
      if (state.fsrsWritten) return;
      const sb = createSupabaseBrowserClient();
      const rating = ratingFor(state, mastered);
      const { card: next, log } = gradeCard(state.card, rating, "learn");
      void updateCardSrs(sb, next).catch(console.error);
      void insertReviewLog(sb, log).catch(console.error);
    },
    [],
  );

  // ─── On answer: defer state mutation until feedback clears (BUG FIX) ───
  // Previously fam ticked immediately, so the question useMemo regenerated with
  // a different question type while feedback was still being shown.
  const advanceTimerRef = useRef<number | null>(null);

  function applyAnswer(correct: boolean) {
    const targetIdx = currentIdx;
    if (targetIdx < 0) return;
    setStates((arr) =>
      arr.map((s, i) => {
        if (i !== targetIdx) return s;
        const nextFam = correct
          ? Math.min(MASTERY_LEVEL, s.fam + 1)
          : Math.max(0, s.fam - 1);
        const nextLapses = s.lapses + (correct ? 0 : 1);
        const justMastered =
          nextFam >= MASTERY_LEVEL && !s.fsrsWritten;
        const newState: CardState = {
          ...s,
          fam: nextFam,
          lapses: nextLapses,
          fsrsWritten: justMastered ? true : s.fsrsWritten,
        };
        if (justMastered) persistFsrsForCard(newState, true);
        return newState;
      }),
    );
    setCursor((c) => c + 1);
  }

  function onAnswer(correct: boolean, given?: string) {
    if (!current || feedback) return;
    setFeedback(correct ? { kind: "correct", given } : { kind: "wrong", given });

    // Speak the correct English term AFTER the user answers (not before, to
    // avoid leaking). Always speak — both right and wrong answers — so user
    // hears correct pronunciation. Respect autoPlay setting.
    if (settings.autoPlay) {
      speak(current.card.term, settings.speechRate);
    }

    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
    }
    advanceTimerRef.current = window.setTimeout(
      () => {
        setFeedback(null);
        applyAnswer(correct);
      },
      correct ? 700 : 1500,
    );
  }

  // ─── Give-up: reveal answer + count as wrong ───
  function onGiveUp() {
    if (!current || feedback) return;
    const expected = question?.expectedAnswer ?? current.card.term;
    setFeedback({ kind: "wrong", given: expected });
    if (settings.autoPlay) {
      speak(current.card.term, settings.speechRate);
    }
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
    }
    advanceTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      applyAnswer(false);
    }, 1800);
  }

  // ─── Persist remaining unmastered cards when unmounting ───
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current);
      }
      for (const s of states) {
        if (!s.fsrsWritten) {
          persistFsrsForCard(s, false);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── End screen ───
  const allMastered = states.every((s) => s.fam >= MASTERY_LEVEL);
  const masteredCount = states.filter((s) => s.fam >= MASTERY_LEVEL).length;

  if (allMastered) {
    const totalLapses = states.reduce((a, b) => a + b.lapses, 0);
    const perfect = states.filter((s) => s.lapses === 0).length;
    return (
      <div className="my-auto flex flex-col items-center gap-5 py-10 text-center sm:py-16">
        <p className="text-5xl sm:text-6xl">🎓</p>
        <h2 className="text-2xl font-semibold sm:text-3xl">Đã thuộc hết!</h2>
        <p className="text-[var(--color-ink-muted)]">
          {states.length} thẻ ·{" "}
          <span className="text-[var(--color-good)]">{perfect} đúng ngay</span>{" "}
          · {totalLapses} lần sai
        </p>
        <Link
          href="/decks"
          onClick={() => router.refresh()}
          className="tap mt-3 rounded-full bg-[var(--color-mode-learn)] px-6 font-medium text-white"
        >
          Về bộ thẻ
        </Link>
      </div>
    );
  }

  if (!current || !question) return null;

  return (
    <div className="flex flex-1 flex-col gap-3 sm:gap-4">
      {/* Top bar: caption + settings */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium tracking-wide text-[var(--color-ink-muted)]">
          <span className="text-[var(--color-ink)]">{masteredCount}</span>
          {" / "}
          {states.length}{" "}đã thuộc
        </span>
        <span className="ml-auto" />
        <SettingsPanel settings={settings} onChange={updateSettings} />
      </div>

      {/* Quizlet-style progress: badge + segments + total */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-mode-learn)] text-[10px] font-semibold text-white sm:h-7 sm:w-7 sm:text-xs">
          {Math.max(1, currentIdx + 1)}
        </span>
        <SegmentedProgress
          states={states}
          currentIdx={currentIdx}
          max={MASTERY_LEVEL}
        />
        <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full border border-[var(--color-line)] px-1.5 text-[10px] font-medium text-[var(--color-ink-muted)] sm:h-7 sm:min-w-7 sm:px-2 sm:text-xs">
          {states.length}
        </span>
      </div>

      {/* Question canvas */}
      <div
        key={`${current.card.id}-${current.fam}`}
        className="flex flex-1 flex-col gap-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-3 sm:rounded-[var(--radius-card)] sm:p-6 md:p-8"
      >
        <QuestionView
          question={question}
          feedback={feedback}
          speechRate={settings.speechRate}
          onAnswer={onAnswer}
          onGiveUp={onGiveUp}
          numbered
        />
      </div>
    </div>
  );
}

// ─── Multi-segment progress bar ───
function SegmentedProgress({
  states,
  currentIdx,
  max,
}: {
  states: CardState[];
  currentIdx: number;
  max: number;
}) {
  return (
    <div
      className="flex min-w-0 flex-1 gap-0.5"
      role="progressbar"
      aria-label="Tiến độ học"
    >
      {states.map((s, i) => {
        const isCurrent = i === currentIdx;
        const isMastered = s.fam >= max;
        const ratio = Math.min(1, s.fam / max);
        return (
          <div
            key={i}
            className={
              "relative h-2 min-w-0 flex-1 overflow-hidden rounded-full " +
              (isMastered
                ? "bg-[var(--color-mode-learn)]"
                : "bg-[var(--color-line)]")
            }
          >
            {!isMastered && s.fam > 0 && (
              <div
                className="absolute inset-y-0 left-0 bg-[var(--color-mode-learn)] transition-[width] duration-300"
                style={{ width: `${ratio * 100}%` }}
              />
            )}
            {isCurrent && !isMastered && (
              <div className="absolute inset-0 rounded-full ring-2 ring-[var(--color-mode-learn)]/60 ring-offset-1 ring-offset-[var(--color-bg)]" />
            )}
          </div>
        );
      })}
    </div>
  );
}
