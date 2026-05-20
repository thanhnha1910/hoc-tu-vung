"use client";

/** Per-deck best time for Match game, persisted in localStorage. */

const KEY = "hoc-tu-vung:best-times:v1";

function read(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

export function getBestTime(deckId: string): number | null {
  const all = read();
  return typeof all[deckId] === "number" ? all[deckId] : null;
}

/** Returns true if `seconds` beats the existing best (or no record). */
export function setBestTime(deckId: string, seconds: number): boolean {
  const all = read();
  const prev = all[deckId];
  if (prev !== undefined && prev <= seconds) return false;
  all[deckId] = seconds;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* localStorage may be full or disabled */
  }
  return true;
}
