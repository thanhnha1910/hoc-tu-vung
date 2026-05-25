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

let cachedVoice: SpeechSynthesisVoice | null = null;

// Voices load asynchronously in some browsers (Chrome). Reset cache when the
// list updates so the next speak() call re-picks with the full list.
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    cachedVoice = null;
  });
}

/**
 * Pick the highest-quality English voice available.
 * Priority: known-natural voices by name → premium/enhanced/neural keywords →
 * en-US → any English voice. Cached after first successful pick.
 */
function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  if (typeof window === "undefined") return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  if (english.length === 0) return voices[0];

  // Preferred natural-sounding voices, in priority order.
  // macOS premium voices use "(Premium)" / "(Enhanced)" suffix on Sonoma+.
  const preferred = [
    "Ava (Premium)",
    "Ava (Enhanced)",
    "Ava",
    "Samantha (Premium)",
    "Samantha (Enhanced)",
    "Samantha",
    "Allison (Premium)",
    "Allison",
    "Joelle (Premium)",
    "Joelle",
    "Evan (Premium)",
    "Nathan (Premium)",
    "Zoe (Premium)",
    "Microsoft Aria Online",
    "Microsoft Jenny Online",
    "Microsoft Aria",
    "Microsoft Jenny",
    "Microsoft Guy",
    "Google US English",
    "Google UK English Female",
    "Karen",
    "Serena",
    "Daniel",
  ];
  for (const name of preferred) {
    const match = english.find((v) => v.name.includes(name));
    if (match) {
      cachedVoice = match;
      return match;
    }
  }

  // Fallback: any voice with quality keywords in the name
  const natural = english.find((v) =>
    /premium|enhanced|natural|neural|online/i.test(v.name),
  );
  if (natural) {
    cachedVoice = natural;
    return natural;
  }

  cachedVoice =
    english.find((v) => v.lang === "en-US") ??
    english.find((v) => v.lang === "en-GB") ??
    english[0];
  return cachedVoice;
}

export function speak(text: string, rate = 0.9): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickEnglishVoice();
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
