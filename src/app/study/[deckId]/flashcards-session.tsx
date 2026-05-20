"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Card, LearningMode, Rating } from "@/lib/types";
import { RATING, RATING_LABEL } from "@/lib/types";
import { gradeCard, previewIntervals } from "@/lib/srs";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { insertReviewLog, updateCardSrs } from "@/lib/repo";
import { speak, unlock } from "@/lib/tts";
import { useStudySettings } from "@/lib/settings";
import { SettingsPanel } from "./settings-panel";

interface Props {
  initialCards: Card[];
  mode: LearningMode;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function FlashcardsSession({ initialCards, mode }: Props) {
  const router = useRouter();
  const [settings, updateSettings] = useStudySettings();
  const [queue, setQueue] = useState<Card[]>(initialCards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);
  const [stats, setStats] = useState({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });

  const card = queue[index];

  // Apply shuffle when setting toggles
  const shuffleRef = useRef(settings.shuffle);
  useEffect(() => {
    if (settings.shuffle && !shuffleRef.current) {
      // Shuffle remaining cards only (don't disrupt already-seen ordering)
      setQueue((q) => {
        const seen = q.slice(0, index);
        const rest = shuffle(q.slice(index));
        return [...seen, ...rest];
      });
    }
    shuffleRef.current = settings.shuffle;
  }, [settings.shuffle, index]);

  // Initial shuffle on mount if setting is on
  useEffect(() => {
    if (settings.shuffle) {
      setQueue((q) => shuffle(q));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset flip state when card changes
  useEffect(() => {
    setFlipped(false);
  }, [index]);

  // Auto-speak English term when a new card appears.
  // Note: on first card, browser may block (no user gesture yet) — that's fine,
  // user's first tap to flip will speak (see speakTerm() in onCardTap).
  useEffect(() => {
    if (card && settings.autoPlay) speak(card.term, settings.speechRate);
  }, [card, settings.autoPlay, settings.speechRate]);

  const intervals = useMemo(
    () => (card ? previewIntervals(card) : null),
    [card],
  );

  const speakTerm = useCallback(() => {
    if (card) speak(card.term, settings.speechRate);
  }, [card, settings.speechRate]);

  const grade = useCallback(
    async (rating: Rating) => {
      if (!card) return;
      const sb = createSupabaseBrowserClient();
      const { card: next, log } = gradeCard(card, rating, mode);

      void updateCardSrs(sb, next).catch(console.error);
      void insertReviewLog(sb, log).catch(console.error);

      setStats((s) => ({
        again: s.again + (rating === 1 ? 1 : 0),
        hard: s.hard + (rating === 2 ? 1 : 0),
        good: s.good + (rating === 3 ? 1 : 0),
        easy: s.easy + (rating === 4 ? 1 : 0),
      }));

      if (rating === RATING.AGAIN) {
        setQueue((q) => [
          ...q.slice(0, index),
          ...q.slice(index + 1),
          { ...next },
        ]);
      } else if (index + 1 >= queue.length) {
        setFinished(true);
      } else {
        setIndex((i) => i + 1);
      }
    },
    [card, mode, index, queue.length],
  );

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        unlock();
        setFlipped((f) => {
          // When unflipping back? we only speak on first flip. Speak always to be safe.
          if (!f) speakTerm();
          return !f;
        });
      } else if (e.key === "s" || e.key === "S") {
        speakTerm();
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        grade(Number(e.key) as Rating);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, grade, speakTerm]);

  // Swipe gestures
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
    unlock();
    if (!flipped) {
      setFlipped(true);
      speakTerm();
    } else {
      grade(dx > 0 ? RATING.GOOD : RATING.AGAIN);
    }
  }

  function onCardTap() {
    unlock();
    setFlipped((f) => {
      if (!f) speakTerm(); // user tapped to flip → guaranteed-working audio context
      return !f;
    });
  }

  if (finished) {
    const total = stats.again + stats.hard + stats.good + stats.easy;
    return (
      <div className="my-auto flex flex-col items-center gap-5 py-12 text-center">
        <p className="text-5xl">✨</p>
        <h2 className="text-2xl font-semibold">Xong phiên học!</h2>
        <p className="text-[var(--color-ink-muted)]">{total} thẻ đã ôn</p>
        <div className="grid grid-cols-4 gap-3 text-center text-sm">
          <Stat color="bad" n={stats.again} label="Quên" />
          <Stat color="warn" n={stats.hard} label="Khó" />
          <Stat color="good" n={stats.good} label="Được" />
          <Stat color="easy" n={stats.easy} label="Dễ" />
        </div>
        <Link
          href="/decks"
          onClick={() => router.refresh()}
          className="mt-3 rounded-full bg-[var(--color-accent)] px-6 py-3 font-medium text-[var(--color-accent-ink)]"
        >
          Về bộ thẻ
        </Link>
      </div>
    );
  }

  if (!card) return null;

  // Determine which side is front based on settings
  const frontIsEnglish = settings.frontSide === "term";
  const frontText = frontIsEnglish ? card.term : card.definition;
  const backText = frontIsEnglish ? card.definition : card.term;
  const frontIsAudible = frontIsEnglish; // always English side gets speaker icon
  const backIsAudible = !frontIsEnglish;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Top bar: progress + settings gear */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-[var(--color-ink-muted)] sm:gap-3">
          <span className="shrink-0 font-mono">
            {index + 1}/{queue.length}
          </span>
          <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-line)]">
            <div
              className="h-full bg-[var(--color-accent)] transition-[width]"
              style={{
                width: `${((index + 1) / queue.length) * 100}%`,
              }}
            />
          </div>
          <span className="hidden shrink-0 sm:inline">
            {queue.length - index - 1} còn
          </span>
        </div>
        <SettingsPanel settings={settings} onChange={updateSettings} />
      </div>

      {/* Card */}
      <button
        type="button"
        onClick={onCardTap}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative w-full flex-1 select-none sm:flex-none sm:aspect-[5/3]"
        style={{ perspective: "1200px", minHeight: "200px" }}
        aria-label={flipped ? "Lật về mặt trước" : "Lật xem nghĩa"}
      >
        <div
          className={`flip-3d relative h-full w-full ${flipped ? "flipped" : ""}`}
        >
          <CardFace>
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
              {frontIsEnglish ? "English" : "Tiếng Việt"}
            </span>
            <p className="mt-3 break-words px-2 text-center text-2xl font-semibold leading-tight sm:text-4xl md:text-5xl">
              {frontText}
            </p>
            {frontIsEnglish && card.pronunciation && (
              <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                /{card.pronunciation}/
              </p>
            )}
            {frontIsAudible && (
              <SpeakerButton
                onClick={(e) => {
                  e.stopPropagation();
                  unlock();
                  speakTerm();
                }}
              />
            )}
            <p className="absolute bottom-3 px-4 text-center text-[10px] leading-tight text-[var(--color-ink-muted)] sm:bottom-4 sm:text-xs">
              Bấm hoặc nhấn Space để lật
            </p>
          </CardFace>

          <CardFace back>
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
              {frontIsEnglish ? "Tiếng Việt" : "English"}
            </span>
            <p className="mt-3 break-words px-2 text-center text-xl font-semibold leading-tight sm:text-2xl md:text-3xl">
              {backText}
            </p>
            {!frontIsEnglish && card.pronunciation && (
              <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                /{card.pronunciation}/
              </p>
            )}
            {card.example && (
              <p className="mt-3 max-w-md px-2 text-center text-xs italic text-[var(--color-ink-muted)] sm:text-sm">
                &ldquo;{card.example}&rdquo;
              </p>
            )}
            {backIsAudible && (
              <SpeakerButton
                onClick={(e) => {
                  e.stopPropagation();
                  unlock();
                  speakTerm();
                }}
              />
            )}
          </CardFace>
        </div>
      </button>

      {/* Rating buttons */}
      <div
        className={`sticky bottom-0 -mx-4 grid grid-cols-4 gap-2 bg-[var(--color-bg)]/80 px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-md transition-opacity sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none ${
          flipped ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <RatingBtn
          rating={RATING.AGAIN}
          color="bad"
          interval={intervals?.[1].dueIn}
          onClick={() => grade(RATING.AGAIN)}
        />
        <RatingBtn
          rating={RATING.HARD}
          color="warn"
          interval={intervals?.[2].dueIn}
          onClick={() => grade(RATING.HARD)}
        />
        <RatingBtn
          rating={RATING.GOOD}
          color="good"
          interval={intervals?.[3].dueIn}
          onClick={() => grade(RATING.GOOD)}
        />
        <RatingBtn
          rating={RATING.EASY}
          color="easy"
          interval={intervals?.[4].dueIn}
          onClick={() => grade(RATING.EASY)}
        />
      </div>

      <p className="hidden text-center text-xs text-[var(--color-ink-muted)] sm:block">
        Phím tắt: Space lật · 1/2/3/4 chấm · S phát âm
      </p>
    </div>
  );
}

function SpeakerButton({
  onClick,
}: {
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <span
      role="button"
      aria-label="Phát âm"
      onClick={onClick}
      className="tap absolute right-3 top-3 flex items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-bg)] text-xl"
    >
      🔊
    </span>
  );
}

function CardFace({
  children,
  back,
}: {
  children: React.ReactNode;
  back?: boolean;
}) {
  return (
    <div
      className={`flip-face absolute inset-0 flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-4 shadow-sm sm:p-6 ${
        back ? "flip-back" : ""
      }`}
    >
      {children}
    </div>
  );
}

function RatingBtn({
  rating,
  color,
  interval,
  onClick,
}: {
  rating: Rating;
  color: "bad" | "warn" | "good" | "easy";
  interval: string | undefined;
  onClick: () => void;
}) {
  const colorVar = {
    bad: "var(--color-bad)",
    warn: "var(--color-warn)",
    good: "var(--color-good)",
    easy: "var(--color-easy)",
  }[color];

  return (
    <button
      type="button"
      onClick={onClick}
      className="tap flex flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 py-2 font-medium text-[color:var(--btn-color)] transition-transform active:scale-95 sm:px-2 sm:py-3"
      style={
        {
          borderColor: `color-mix(in oklch, ${colorVar} 40%, transparent)`,
          background: `color-mix(in oklch, ${colorVar} 8%, transparent)`,
          "--btn-color": colorVar,
        } as React.CSSProperties
      }
    >
      <span className="text-xs leading-tight sm:text-base">
        {RATING_LABEL[rating]}
      </span>
      {interval && (
        <span className="text-[9px] font-normal opacity-70 sm:text-xs">
          {interval}
        </span>
      )}
    </button>
  );
}

function Stat({
  color,
  n,
  label,
}: {
  color: "bad" | "warn" | "good" | "easy";
  n: number;
  label: string;
}) {
  const colorVar = {
    bad: "var(--color-bad)",
    warn: "var(--color-warn)",
    good: "var(--color-good)",
    easy: "var(--color-easy)",
  }[color];
  return (
    <div
      className="flex flex-col gap-1 rounded-2xl px-3 py-3"
      style={{
        background: `color-mix(in oklch, ${colorVar} 10%, transparent)`,
        color: colorVar,
      }}
    >
      <span className="text-2xl font-semibold">{n}</span>
      <span className="text-xs opacity-80">{label}</span>
    </div>
  );
}
