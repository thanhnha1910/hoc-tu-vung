/**
 * Quiz question generator — pure functions.
 *
 * Used by both Học (Learn) and Kiểm tra (Test). Given a target card +
 * a pool of cards (for distractors), produces a fully-formed Question
 * object ready to render.
 */
import type { Card } from "./types";

export type QuestionType =
  | "preview" // fam 0: passive "tap to mark seen"
  | "mcq-def-to-term" // show definition, pick the English term
  | "mcq-term-to-def" // show term, pick the Vietnamese definition
  | "tf" // show term + a definition, decide if they match
  | "write" // show definition, type the term
  | "cloze"; // example sentence with the term blanked out

export interface Question {
  type: QuestionType;
  card: Card;
  /** Headline text shown above the answer area. */
  prompt: string;
  /** What the user must produce/pick to be correct. */
  expectedAnswer: string;

  // MCQ
  options?: string[];

  // T/F
  shownDefinition?: string;
  shownIsCorrect?: boolean;

  // Cloze
  clozeSentence?: string;
  clozeBlank?: string;
}

// ──────────────────────────────────────────────────────────────
//  Normalization & comparison (used for Write + Cloze)
// ──────────────────────────────────────────────────────────────

/** Lowercase, trim, collapse spaces, strip diacritics. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function isCorrect(given: string, expected: string): boolean {
  return normalize(given) === normalize(expected);
}

// ──────────────────────────────────────────────────────────────
//  Distractors (wrong options for MCQ)
// ──────────────────────────────────────────────────────────────

function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickDistractors(
  pool: readonly Card[],
  except: Card,
  field: "term" | "definition",
  n = 3,
): string[] {
  const others = pool.filter((c) => c.id !== except.id);
  // Dedupe by the chosen field (some pools have duplicate definitions)
  const seen = new Set<string>([normalize(except[field])]);
  const unique: string[] = [];
  for (const c of shuffle(others)) {
    const v = c[field];
    if (!v) continue;
    const key = normalize(v);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(v);
    if (unique.length >= n) break;
  }
  return unique;
}

// ──────────────────────────────────────────────────────────────
//  Question generation
// ──────────────────────────────────────────────────────────────

/**
 * Decide which question type to ask given a card's session familiarity (0-4).
 * Starts with MCQ immediately (no preview slide — Quizlet-style).
 * Ladder: MCQ def→term → MCQ term→def → T/F → Write/Cloze → MASTERED
 */
export function pickQuestionType(
  familiarity: number,
  card: Card,
): QuestionType {
  if (familiarity <= 0) return "mcq-def-to-term";
  if (familiarity === 1) return "mcq-term-to-def";
  if (familiarity === 2) return "tf";
  if (familiarity >= 3) {
    if (
      card.example &&
      card.example.toLowerCase().includes(card.term.toLowerCase())
    ) {
      return "cloze";
    }
    return "write";
  }
  return "mcq-def-to-term";
}

export function generateQuestion(
  card: Card,
  type: QuestionType,
  pool: readonly Card[],
): Question {
  switch (type) {
    case "preview":
      return {
        type,
        card,
        prompt: card.term,
        expectedAnswer: card.term,
      };

    case "mcq-def-to-term": {
      const distractors = pickDistractors(pool, card, "term");
      const options = shuffle([card.term, ...distractors]);
      return {
        type,
        card,
        prompt: card.definition,
        expectedAnswer: card.term,
        options,
      };
    }

    case "mcq-term-to-def": {
      const distractors = pickDistractors(pool, card, "definition");
      const options = shuffle([card.definition, ...distractors]);
      return {
        type,
        card,
        prompt: card.term,
        expectedAnswer: card.definition,
        options,
      };
    }

    case "tf": {
      // 50/50: show the real definition, or a random other one
      const correct = Math.random() < 0.5;
      const distractors = pickDistractors(pool, card, "definition", 1);
      const shownDefinition = correct
        ? card.definition
        : distractors[0] ?? card.definition;
      return {
        type,
        card,
        prompt: card.term,
        expectedAnswer: correct ? "true" : "false",
        shownDefinition,
        shownIsCorrect: correct,
      };
    }

    case "write":
      return {
        type,
        card,
        prompt: card.definition,
        expectedAnswer: card.term,
      };

    case "cloze": {
      const example = card.example ?? "";
      // Replace term (case-insensitive, word-boundary-ish) with ____
      const re = new RegExp(
        `\\b${escapeRegex(card.term)}\\b`,
        "i",
      );
      const blanked = example.replace(re, "_____");
      return {
        type,
        card,
        prompt: blanked || card.definition,
        expectedAnswer: card.term,
        clozeSentence: blanked,
        clozeBlank: card.term,
      };
    }
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ──────────────────────────────────────────────────────────────
//  Bulk: for Test mode, build a quiz of N mixed questions
// ──────────────────────────────────────────────────────────────

export interface QuizPlan {
  questionTypes: QuestionType[];
  count: number;
}

/** Generate a `count`-length quiz from `cards`, mixing only the allowed types. */
export function buildQuiz(
  cards: readonly Card[],
  plan: QuizPlan,
): Question[] {
  const out: Question[] = [];
  if (cards.length === 0 || plan.questionTypes.length === 0) return out;

  const sourceCards = shuffle(cards).slice(0, plan.count);
  for (const card of sourceCards) {
    // Pick a random allowed type that's feasible for this card
    const feasible = plan.questionTypes.filter((t) => {
      if (t === "cloze") {
        return !!(
          card.example &&
          card.example.toLowerCase().includes(card.term.toLowerCase())
        );
      }
      return true;
    });
    const type =
      feasible[Math.floor(Math.random() * feasible.length)] ??
      plan.questionTypes[0];
    out.push(generateQuestion(card, type, cards));
  }
  return out;
}
