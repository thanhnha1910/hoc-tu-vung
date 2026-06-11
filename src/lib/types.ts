/**
 * Domain types for the Học Từ Vựng app.
 * These mirror the Supabase schema (see /supabase/schema.sql).
 */

export type CardState = "new" | "learning" | "review" | "relearning";

/** A study deck owned by a user. */
export interface Deck {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  groupName: string | null;
  sourceLang: string; // ISO 639-1, e.g. "en"
  targetLang: string; // e.g. "vi"
  createdAt: string;
  updatedAt: string;
}

/** A single flashcard inside a deck. */
export interface Card {
  id: string;
  deckId: string;
  ownerId: string;

  // Content
  term: string; // English word/phrase
  definition: string; // Vietnamese meaning
  example: string | null;
  pronunciation: string | null; // IPA
  imageUrl: string | null;

  // FSRS state — see https://github.com/open-spaced-repetition/ts-fsrs
  state: CardState;
  due: string; // ISO timestamp
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReview: string | null;

  createdAt: string;
  updatedAt: string;
}

/** Append-only log written by every learning mode. */
export interface ReviewLog {
  id: string;
  cardId: string;
  ownerId: string;
  rating: 1 | 2 | 3 | 4; // Again | Hard | Good | Easy
  state: CardState;
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  lastElapsedDays: number;
  scheduledDays: number;
  /** Which learning mode generated this rating. */
  mode: LearningMode;
  reviewedAt: string;
}

export type LearningMode =
  | "flashcards"
  | "learn"
  | "match"
  | "test"
  | "write"
  | "spell"
  | "review";

export type Rating = 1 | 2 | 3 | 4;
export const RATING = {
  AGAIN: 1 as const,
  HARD: 2 as const,
  GOOD: 3 as const,
  EASY: 4 as const,
};

export const RATING_LABEL: Record<Rating, string> = {
  1: "Quên",
  2: "Khó",
  3: "Được",
  4: "Dễ",
};
