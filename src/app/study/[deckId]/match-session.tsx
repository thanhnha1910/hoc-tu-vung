"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Card } from "@/lib/types";
import { speak, unlock } from "@/lib/tts";
import { useStudySettings } from "@/lib/settings";
import { getBestTime, setBestTime } from "@/lib/best-times";
import { SettingsPanel } from "./settings-panel";

interface Props {
  initialCards: Card[];
  deckId?: string;
}

interface Tile {
  id: string;
  cardId: string;
  text: string;
  kind: "term" | "definition";
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const BATCH_SIZE = 6;
const PENALTY_MS = 1000; // +1 second per wrong pair

export function MatchSession({ initialCards, deckId }: Props) {
  const router = useRouter();
  const [settings, updateSettings] = useStudySettings();

  // Pick a random batch of cards
  const batch = useMemo(
    () => shuffleArray(initialCards).slice(0, BATCH_SIZE),
    [initialCards],
  );

  const [tiles, setTiles] = useState<Tile[]>(() => {
    const ts: Tile[] = [];
    for (const c of batch) {
      ts.push({ id: `${c.id}:t`, cardId: c.id, text: c.term, kind: "term" });
      ts.push({
        id: `${c.id}:d`,
        cardId: c.id,
        text: c.definition,
        kind: "definition",
      });
    }
    return shuffleArray(ts);
  });
  const [selected, setSelected] = useState<Tile | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null);

  /** Penalty time accumulated from wrong matches (in milliseconds). */
  const [penaltyMs, setPenaltyMs] = useState(0);
  const [elapsed, setElapsed] = useState(0); // displayed seconds
  const startRef = useRef(Date.now());
  const [finished, setFinished] = useState(false);
  const [bestBeat, setBestBeat] = useState(false);
  const [prevBest, setPrevBest] = useState<number | null>(null);

  // Read previous best on mount
  useEffect(() => {
    if (deckId) setPrevBest(getBestTime(deckId));
  }, [deckId]);

  // Timer = real elapsed + penalty
  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => {
      const real = Date.now() - startRef.current;
      setElapsed((real + penaltyMs) / 1000);
    }, 100);
    return () => clearInterval(t);
  }, [finished, penaltyMs]);

  // ─── Finish detection ───
  useEffect(() => {
    if (matched.size > 0 && matched.size === batch.length && !finished) {
      const finalSeconds = (Date.now() - startRef.current + penaltyMs) / 1000;
      setElapsed(finalSeconds);
      setFinished(true);

      // Save best time
      if (deckId) {
        const beat = setBestTime(deckId, finalSeconds);
        setBestBeat(beat);
      }

    }
  }, [matched, batch, finished, penaltyMs, deckId]);

  function onTilePick(tile: Tile) {
    if (matched.has(tile.cardId) || wrongPair) return;
    unlock();
    if (tile.kind === "term") {
      speak(tile.text, settings.speechRate, settings.voiceURI);
    }
    if (!selected) {
      setSelected(tile);
      return;
    }
    if (selected.id === tile.id) {
      setSelected(null);
      return;
    }
    // Pair check
    if (
      selected.cardId === tile.cardId &&
      selected.kind !== tile.kind
    ) {
      // Correct match — animate-fade then remove from grid
      setMatched((m) => new Set(m).add(tile.cardId));
      setSelected(null);
    } else {
      // Wrong match — add a small time penalty.
      setPenaltyMs((p) => p + PENALTY_MS);
      setWrongPair([selected.id, tile.id]);
      setTimeout(() => {
        setWrongPair(null);
        setSelected(null);
      }, 600);
    }
  }

  // ─── Finish screen ───
  if (finished) {
    return (
      <div className="my-auto flex flex-col items-center gap-5 py-12 text-center">
        <p className="text-5xl">{bestBeat ? "🏆" : "🎯"}</p>
        <h2 className="text-2xl font-semibold">
          {bestBeat ? "Kỷ lục mới!" : "Hoàn thành"}
        </h2>
        <div className="flex flex-col items-center gap-1">
          <p className="font-mono text-4xl font-bold text-[var(--color-mode-match)]">
            {elapsed.toFixed(1)}s
          </p>
          {prevBest !== null && (
            <p className="text-sm text-[var(--color-ink-muted)]">
              {bestBeat
                ? `Cũ: ${prevBest.toFixed(1)}s`
                : `Tốt nhất: ${prevBest.toFixed(1)}s`}
            </p>
          )}
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
            Penalty: +{(penaltyMs / 1000).toFixed(1)}s
          </p>
        </div>
        <Link
          href={`/decks/${deckId ?? ""}`}
          onClick={() => router.refresh()}
          className="mt-3 rounded-full bg-[var(--color-mode-match)] px-6 py-3 font-medium text-white"
        >
          Về bộ thẻ
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-baseline gap-3 text-sm">
          <span className="font-mono text-lg font-semibold text-[var(--color-mode-match)]">
            {elapsed.toFixed(1)}s
          </span>
          <span className="text-xs text-[var(--color-ink-muted)]">
            {matched.size}/{batch.length} cặp
            {prevBest !== null && (
              <span> · best {prevBest.toFixed(1)}s</span>
            )}
          </span>
        </div>
        <SettingsPanel settings={settings} onChange={updateSettings} />
      </div>

      {/* Tiles grid */}
      <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {tiles.map((tile) => {
          const isMatched = matched.has(tile.cardId);
          const isSelected = selected?.id === tile.id;
          const isWrong =
            wrongPair && (wrongPair[0] === tile.id || wrongPair[1] === tile.id);
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => onTilePick(tile)}
              disabled={isMatched}
              aria-pressed={isSelected}
              className={
                "flex min-h-20 items-center justify-center rounded-2xl border p-2 text-center text-xs font-medium transition-all duration-300 sm:min-h-24 sm:p-3 sm:text-sm " +
                (isMatched
                  ? "scale-50 border-[var(--color-good)] bg-[color-mix(in_oklch,var(--color-good)_25%,transparent)] opacity-0"
                  : isWrong
                  ? "animate-pulse border-[var(--color-bad)] bg-[color-mix(in_oklch,var(--color-bad)_20%,transparent)]"
                  : isSelected
                  ? "scale-105 border-[var(--color-mode-match)] bg-[color-mix(in_oklch,var(--color-mode-match)_15%,transparent)]"
                  : "border-[var(--color-line)] bg-[var(--color-bg-elev)] hover:border-[var(--color-mode-match)]/50 hover:bg-[var(--color-bg-elev-2)]")
              }
            >
              <span className="line-clamp-4 break-words leading-tight">
                {tile.text}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-[var(--color-ink-muted)]">
        Bấm 1 ô, rồi bấm ô đúng nghĩa. Sai = +1s vào thời gian.
      </p>
    </div>
  );
}
