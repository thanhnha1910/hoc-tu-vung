"use client";

import { useEffect, useState } from "react";

export type FrontSide = "term" | "definition";

export interface StudySettings {
  shuffle: boolean;
  autoPlay: boolean;
  frontSide: FrontSide;
  /** Voice rate 0.5-1.5, 1 = normal */
  speechRate: number;
  /** Browser voiceURI; null means automatically select the best English voice. */
  voiceURI: string | null;
}

const KEY = "hoc-tu-vung:settings:v1";

export const DEFAULT_SETTINGS: StudySettings = {
  shuffle: false,
  autoPlay: true,
  frontSide: "term", // English term shown first by default
  // Slightly slower than natural pace so learners can shadow comfortably.
  speechRate: 0.9,
  voiceURI: null,
};

function readSettings(): StudySettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(s: StudySettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* localStorage may be disabled */
  }
}

/** React hook: settings + setter. Persists to localStorage. */
export function useStudySettings(): [
  StudySettings,
  (patch: Partial<StudySettings>) => void,
] {
  const [settings, setSettings] = useState<StudySettings>(DEFAULT_SETTINGS);

  // Hydrate from localStorage after mount
  useEffect(() => {
    setSettings(readSettings());
  }, []);

  function update(patch: Partial<StudySettings>) {
    setSettings((s) => {
      const next = { ...s, ...patch };
      writeSettings(next);
      return next;
    });
  }

  return [settings, update];
}
