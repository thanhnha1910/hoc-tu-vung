"use client";

/**
 * Text-to-speech wrapper around Web Speech API.
 *
 * Browser autoplay rules: speechSynthesis is blocked until the first user
 * gesture (click/tap/keypress) in this document. So:
 *   - Always call `unlock()` inside the first interaction (we do this when
 *     user clicks card / Start button).
 *   - After unlock, subsequent programmatic speak() works fine.
 */

let unlocked = false;

export function unlock(): void {
  if (typeof window === "undefined" || unlocked) return;
  if (!("speechSynthesis" in window)) return;
  // A silent utterance is enough to unlock on iOS/Safari.
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  window.speechSynthesis.speak(u);
  unlocked = true;
}

/** Get the best English voice available (caches result). */
let cachedVoice: SpeechSynthesisVoice | null = null;
function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  if (typeof window === "undefined") return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  // Prefer en-US, then en-GB, then any English voice
  cachedVoice =
    voices.find((v) => v.lang === "en-US") ??
    voices.find((v) => v.lang === "en-GB") ??
    voices.find((v) => v.lang.startsWith("en")) ??
    voices[0];
  return cachedVoice;
}

export function speak(text: string, rate = 0.95): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickEnglishVoice();
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "en-US";
  u.rate = rate;
  u.pitch = 1;
  u.volume = 1;
  synth.speak(u);
  unlocked = true;
}
