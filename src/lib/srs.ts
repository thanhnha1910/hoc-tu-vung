/**
 * SRS engine wrapper around ts-fsrs.
 *
 * The whole point: every learning mode (Flashcards, Learn, Match, Test...)
 * calls `gradeCard(card, rating, mode)` and gets back:
 *   - the next state to persist on the Card
 *   - a ReviewLog row to append
 *
 * This way all modes share one queue and one scheduling brain.
 */
import {
  Card as FsrsCard,
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Grade,
  Rating as FsrsRating,
  State as FsrsState,
} from "ts-fsrs";
import type { Card, LearningMode, Rating, ReviewLog } from "./types";

/** Tunable: target retention ratio. 0.9 = remember 90 % of reviews. */
const TARGET_RETENTION = 0.9;

const scheduler = fsrs(
  generatorParameters({
    request_retention: TARGET_RETENTION,
    enable_fuzz: true,
  }),
);

/** Map our app's State string to ts-fsrs enum. */
function toFsrsState(s: Card["state"]): FsrsState {
  switch (s) {
    case "new":
      return FsrsState.New;
    case "learning":
      return FsrsState.Learning;
    case "review":
      return FsrsState.Review;
    case "relearning":
      return FsrsState.Relearning;
  }
}

function fromFsrsState(s: FsrsState): Card["state"] {
  switch (s) {
    case FsrsState.New:
      return "new";
    case FsrsState.Learning:
      return "learning";
    case FsrsState.Review:
      return "review";
    case FsrsState.Relearning:
      return "relearning";
  }
}

function toFsrsRating(r: Rating): Grade {
  // ts-fsrs Grade = Again=1 | Hard=2 | Good=3 | Easy=4 — matches our Rating exactly.
  return r as unknown as Grade;
}

function buildFsrsCard(card: Card, now: Date): FsrsCard {
  if (card.state === "new" && !card.lastReview) {
    return createEmptyCard(now);
  }
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    reps: card.reps,
    lapses: card.lapses,
    state: toFsrsState(card.state),
    last_review: card.lastReview ? new Date(card.lastReview) : undefined,
  };
}

/**
 * Preview all four button outcomes (Again / Hard / Good / Easy) before user picks.
 * Used to show "next interval" hints on each button.
 */
export function previewIntervals(
  card: Card,
  now: Date = new Date(),
): Record<Rating, { dueIn: string; due: Date }> {
  const fsrsCard = buildFsrsCard(card, now);
  const log = scheduler.repeat(fsrsCard, now);
  return {
    1: formatDue(log[FsrsRating.Again].card.due),
    2: formatDue(log[FsrsRating.Hard].card.due),
    3: formatDue(log[FsrsRating.Good].card.due),
    4: formatDue(log[FsrsRating.Easy].card.due),
  };
}

/**
 * Apply a rating: returns the new card state + a review log row to persist.
 */
export function gradeCard(
  card: Card,
  rating: Rating,
  mode: LearningMode,
  now: Date = new Date(),
): { card: Card; log: Omit<ReviewLog, "id"> } {
  const fsrsCard = buildFsrsCard(card, now);
  const result = scheduler.repeat(fsrsCard, now)[toFsrsRating(rating)];

  const updatedCard: Card = {
    ...card,
    state: fromFsrsState(result.card.state),
    due: result.card.due.toISOString(),
    stability: result.card.stability,
    difficulty: result.card.difficulty,
    elapsedDays: result.card.elapsed_days,
    scheduledDays: result.card.scheduled_days,
    reps: result.card.reps,
    lapses: result.card.lapses,
    lastReview: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const log: Omit<ReviewLog, "id"> = {
    cardId: card.id,
    ownerId: card.ownerId,
    rating,
    state: updatedCard.state,
    due: updatedCard.due,
    stability: updatedCard.stability,
    difficulty: updatedCard.difficulty,
    elapsedDays: result.log.elapsed_days,
    lastElapsedDays: result.log.last_elapsed_days,
    scheduledDays: result.log.scheduled_days,
    mode,
    reviewedAt: now.toISOString(),
  };

  return { card: updatedCard, log };
}

/** Return cards whose `due` is in the past or now. */
export function dueCards(cards: Card[], now: Date = new Date()): Card[] {
  return cards.filter((c) => new Date(c.due).getTime() <= now.getTime());
}

/** Initial state for a freshly created card (still in "new" until first review). */
export function newCardDefaults(now: Date = new Date()): Pick<
  Card,
  | "state"
  | "due"
  | "stability"
  | "difficulty"
  | "elapsedDays"
  | "scheduledDays"
  | "reps"
  | "lapses"
  | "lastReview"
> {
  const empty = createEmptyCard(now);
  return {
    state: "new",
    due: empty.due.toISOString(),
    stability: empty.stability,
    difficulty: empty.difficulty,
    elapsedDays: empty.elapsed_days,
    scheduledDays: empty.scheduled_days,
    reps: empty.reps,
    lapses: empty.lapses,
    lastReview: null,
  };
}

function formatDue(due: Date): { dueIn: string; due: Date } {
  const ms = due.getTime() - Date.now();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return { dueIn: `${Math.max(minutes, 1)}p`, due };
  const hours = Math.round(minutes / 60);
  if (hours < 24) return { dueIn: `${hours}h`, due };
  const days = Math.round(hours / 24);
  if (days < 30) return { dueIn: `${days} ng`, due };
  const months = Math.round(days / 30);
  if (months < 12) return { dueIn: `${months} th`, due };
  return { dueIn: `${Math.round(months / 12)} năm`, due };
}
