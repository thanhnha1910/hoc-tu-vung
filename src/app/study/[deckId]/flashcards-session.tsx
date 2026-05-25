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

  // Which side is currently the English (audible) side.
  // Audio is ALWAYS the English vocab term — we just decide WHEN to play it.
  const frontIsEnglish = settings.frontSide === "term";
  const englishVisible = frontIsEnglish ? !flipped : flipped;

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

  // Auto-speak the English term ONLY when the English side is visible.
  // When front=Vietnamese, the card appears silently — user flips to reveal
  // (and hear) the English vocab. Avoids the "shows VN but reads EN" bug.
  useEffect(() => {
    if (!card || !settings.autoPlay) return;
    if (!englishVisible) return;
    speak(card.term, settings.speechRate);
  }, [card, englishVisible, settings.autoPlay, settings.speechRate]);

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
        // Speak only when the English side is about to become visible
        // (flipping toggles englishVisible).
        if (!englishVisible) speakTerm();
        setFlipped((f) => !f);
      } else if (e.key === "s" || e.key === "S") {
        speakTerm();
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        grade(Number(e.key) as Rating);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, englishVisible, grade, speakTerm]);

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
      // Swipe flips the card. Speak only if the English side will appear.
      if (!englishVisible) speakTerm();
      setFlipped(true);
    } else {
      grade(dx > 0 ? RATING.GOOD : RATING.AGAIN);
    }
  }

  function onCardTap() {
    unlock();
    // Flipping toggles englishVisible. Speak only when English is about to show.
    if (!englishVisible) speakTerm();
    setFlipped((f) => !f);
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

  // Per-side text + which face owns the speaker icon (always the English side).
  const frontText = frontIsEnglish ? card.term : card.definition;
  const backText = frontIsEnglish ? card.definition : card.term;
  const frontIsAudible = frontIsEnglish;
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

      {/* Card — vertically centered in remaining space */}
      <div className="flex flex-1 items-center justify-center">
        <button
          type="button"
          onClick={onCardTap}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="relative w-full max-w-2xl select-none aspect-[4/5] sm:aspect-[5/3]"
          style={{
            perspective: "1400px",
          }}
          aria-label={flipped ? "Lật về mặt trước" : "Lật xem nghĩa"}
        >
        <div
          className={`flip-3d relative h-full w-full ${flipped ? "flipped" : ""}`}
        >
          <CardFace>
            {/* TOP — editorial label */}
            <div className="flex items-center gap-2">
              <span className="h-px w-6 bg-[var(--color-ink-muted)]/40" />
              <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-[var(--color-ink-muted)] sm:text-xs">
                {frontIsEnglish ? "English" : "Tiếng Việt"}
              </span>
              <span className="h-px w-6 bg-[var(--color-ink-muted)]/40" />
            </div>

            {/* CENTER — term in display serif + IPA italic */}
            <div className="flex flex-col items-center gap-4 px-2 text-center">
              <p
                className="break-words font-display text-4xl font-medium leading-[1.05] tracking-tight sm:text-6xl md:text-7xl"
                style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50' }}
              >
                {frontText}
              </p>
              {frontIsEnglish && card.pronunciation && (
                <p className="font-display text-base italic text-[var(--color-ink-muted)] sm:text-lg">
                  /{card.pronunciation}/
                </p>
              )}
            </div>

            {/* BOTTOM — minimal hint */}
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[var(--color-ink-muted)] sm:text-xs">
              <span className="h-1 w-1 rounded-full bg-current opacity-50" />
              Bấm để lật
              <span className="h-1 w-1 rounded-full bg-current opacity-50" />
            </p>

            {frontIsAudible && (
              <SpeakerButton
                onClick={(e) => {
                  e.stopPropagation();
                  unlock();
                  speakTerm();
                }}
              />
            )}
          </CardFace>

          <CardFace back>
            {/* TOP — editorial label */}
            <div className="flex items-center gap-2">
              <span className="h-px w-6 bg-[var(--color-ink-muted)]/40" />
              <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-[var(--color-ink-muted)] sm:text-xs">
                {frontIsEnglish ? "Tiếng Việt" : "English"}
              </span>
              <span className="h-px w-6 bg-[var(--color-ink-muted)]/40" />
            </div>

            {/* CENTER — definition + IPA + example */}
            <div className="flex flex-col items-center gap-4 px-2 text-center">
              <p
                className="break-words font-display text-3xl font-medium leading-[1.1] tracking-tight sm:text-4xl md:text-5xl"
                style={{ fontVariationSettings: '"opsz" 96, "SOFT" 50' }}
              >
                {backText}
              </p>
              {!frontIsEnglish && card.pronunciation && (
                <p className="font-display text-base italic text-[var(--color-ink-muted)] sm:text-lg">
                  /{card.pronunciation}/
                </p>
              )}
              {card.example && (
                <p className="mt-3 max-w-md border-t border-[var(--color-line)] pt-3 font-display text-sm italic leading-relaxed text-[var(--color-ink-muted)] sm:text-base">
                  &ldquo;{card.example}&rdquo;
                </p>
              )}
            </div>

            {/* BOTTOM — guidance */}
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[var(--color-ink-muted)] sm:text-xs">
              <span className="h-1 w-1 rounded-full bg-current opacity-50" />
              Chấm độ thuộc bên dưới
              <span className="h-1 w-1 rounded-full bg-current opacity-50" />
            </p>

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
      </div>

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
    <button
      type="button"
      aria-label="Phát âm"
      onClick={onClick}
      className="speaker-btn tap absolute right-4 top-4 flex items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-bg)]/70 text-[var(--color-ink-muted)] backdrop-blur-sm hover:border-[var(--color-accent)]/60 hover:text-[var(--color-accent)]"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M11 5L6 9H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3l5 4z" fill="currentColor" />
        <path d="M16 7a5 5 0 0 1 0 10" />
        <path d="M19 4a9 9 0 0 1 0 16" opacity="0.5" />
      </svg>
    </button>
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
      className={`flip-face absolute inset-0 rounded-[var(--radius-card)] border-2 border-[var(--color-line)] bg-[var(--color-bg-elev)] card-shadow ${
        back ? "flip-back" : ""
      }`}
    >
      {/* Radial warm-spot lighting */}
      <div className="card-vignette absolute inset-0 rounded-[var(--radius-card)]" />

      {/* Analog film grain */}
      <div className="card-grain absolute inset-0 rounded-[var(--radius-card)]" />

      {/* Hairline border on top of everything */}
      <div className="pointer-events-none absolute inset-0 rounded-[var(--radius-card)] ring-1 ring-inset ring-white/[0.06]" />

      {/* Editorial corner ticks */}
      <CornerTick className="absolute left-3 top-3" position="tl" />
      <CornerTick className="absolute right-3 top-3" position="tr" />
      <CornerTick className="absolute bottom-3 left-3" position="bl" />
      <CornerTick className="absolute bottom-3 right-3" position="br" />

      {/* Content */}
      <div className="relative flex h-full w-full flex-col items-center justify-between p-6 sm:p-10">
        {children}
      </div>
    </div>
  );
}

function CornerTick({
  className,
  position,
}: {
  className?: string;
  position: "tl" | "tr" | "bl" | "br";
}) {
  const path = {
    tl: "M 2 14 L 2 2 L 14 2",
    tr: "M 10 2 L 22 2 L 22 14",
    bl: "M 2 10 L 2 22 L 14 22",
    br: "M 10 22 L 22 22 L 22 10",
  }[position];
  return (
    <svg
      aria-hidden
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      className={`text-[var(--color-ink-muted)] opacity-40 ${className ?? ""}`}
    >
      <path d={path} stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" />
    </svg>
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
