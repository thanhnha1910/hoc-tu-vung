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
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  window.speechSynthesis.speak(u);
  unlocked = true;
}

let cachedAutoVoice: SpeechSynthesisVoice | null = null;

// Voices load asynchronously in some browsers (Chrome). Reset cache when the
// list updates so the next speak() call re-picks with the full list.
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    cachedAutoVoice = null;
  });
}

const PREFERRED_NAMES = [
  "Ava (Premium)",
  "Ava (Enhanced)",
  "Samantha (Premium)",
  "Samantha (Enhanced)",
  "Allison (Premium)",
  "Joelle (Premium)",
  "Evan (Premium)",
  "Nathan (Premium)",
  "Zoe (Premium)",
  "Microsoft Aria Online",
  "Microsoft Jenny Online",
  "Microsoft Aria",
  "Microsoft Jenny",
  "Google US English",
  "Google UK English Female",
  "Ava",
  "Samantha",
  "Karen",
  "Serena",
  "Daniel",
];

function voiceScore(voice: SpeechSynthesisVoice): number {
  const preferredIndex = PREFERRED_NAMES.findIndex((name) =>
    voice.name.includes(name),
  );
  let score = preferredIndex === -1 ? 0 : 500 - preferredIndex * 10;
  if (/premium|enhanced|natural|neural|online/i.test(voice.name)) score += 200;
  if (voice.lang.toLowerCase() === "en-us") score += 80;
  else if (voice.lang.toLowerCase() === "en-gb") score += 60;
  else if (voice.lang.toLowerCase().startsWith("en")) score += 40;
  if (voice.localService) score += 10;
  if (voice.default) score += 5;
  return score;
}

export function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return [];
  }
  const seen = new Set<string>();
  return window.speechSynthesis
    .getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith("en"))
    .filter((voice) => {
      if (seen.has(voice.voiceURI)) return false;
      seen.add(voice.voiceURI);
      return true;
    })
    .sort((a, b) => voiceScore(b) - voiceScore(a));
}

/**
 * Pick the highest-quality English voice available.
 * Priority: known-natural voices by name → premium/enhanced/neural keywords →
 * en-US → any English voice. Cached after first successful pick.
 */
function pickEnglishVoice(voiceURI?: string | null): SpeechSynthesisVoice | null {
  if (typeof window === "undefined") return null;
  const english = getEnglishVoices();
  if (voiceURI) {
    const selected = english.find((voice) => voice.voiceURI === voiceURI);
    if (selected) return selected;
  }
  if (cachedAutoVoice) return cachedAutoVoice;
  cachedAutoVoice = english[0] ?? window.speechSynthesis.getVoices()[0] ?? null;
  return cachedAutoVoice;
}

export function speak(
  text: string,
  rate = 0.9,
  voiceURI?: string | null,
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickEnglishVoice(voiceURI);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "en-US";
  // Clamp rate to a shadowing-friendly band — too slow sounds robotic,
  // too fast hurts pronunciation clarity.
  u.rate = Math.min(1.5, Math.max(0.6, rate));
  u.pitch = 1.0;
  u.volume = 1;
  synth.speak(u);
  unlocked = true;
}

export function stopSpeaking(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}
