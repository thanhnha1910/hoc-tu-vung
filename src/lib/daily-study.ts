import type { Card, Deck, Rating } from "./types";

export type DailyTaskType = "recall" | "listen" | "write";

export interface DailyQueueItem {
  card: Card;
  task: DailyTaskType;
  attempt: number;
}

export type FocusQueuePhase = "first" | "retry" | "weak" | "loop";

export interface FocusQueueItem extends DailyQueueItem {
  batchIndex: number;
  cycle: number;
  phase: FocusQueuePhase;
}

interface QueueOptions {
  now?: Date;
  deckId?: string;
  newCardLimit?: number;
  maxCards?: number;
}

/**
 * Build one global queue. Priority decks receive two slots for every regular
 * slot, while regular overdue cards are never starved.
 */
export function buildDailyQueue(
  cards: Card[],
  decks: Deck[],
  options: QueueOptions = {},
): DailyQueueItem[] {
  const now = options.now ?? new Date();
  const newCardLimit = options.newCardLimit ?? 5;
  const maxCards = options.maxCards ?? 80;
  const priorityIds = new Set(
    decks.filter((deck) => deck.isPriority).map((deck) => deck.id),
  );

  const eligible = cards
    .filter((card) => !options.deckId || card.deckId === options.deckId)
    .filter((card) => new Date(card.due).getTime() <= now.getTime());

  const reviewCards = eligible
    .filter((card) => card.state !== "new")
    .sort(compareCards);
  const newCards = eligible
    .filter((card) => card.state === "new")
    .sort(compareCards);
  const selectedNewCards = softPriorityOrder(newCards, priorityIds).slice(
    0,
    newCardLimit,
  );

  const candidates = [...reviewCards, ...selectedNewCards];
  if (options.deckId) {
    return candidates.slice(0, maxCards).map(toQueueItem);
  }

  return softPriorityOrder(candidates, priorityIds)
    .slice(0, maxCards)
    .map(toQueueItem);
}

/**
 * Build a focused deck queue from every card in deck order. The batch marker
 * controls the learning UI; it does not cap the number of cards in a session.
 */
export function buildFocusQueue(
  cards: Card[],
  batchSize = 5,
): FocusQueueItem[] {
  const safeBatchSize = Math.max(1, Math.floor(batchSize));
  return cards.map((card, index) => ({
    card,
    task: "recall",
    attempt: 0,
    batchIndex: Math.floor(index / safeBatchSize),
    cycle: 1,
    phase: "first",
  }));
}

/**
 * Reinsert a weak card once inside its current group. AGAIN appears after two
 * intervening turns; HARD after four. The retry never crosses into the next
 * five-card group.
 */
export function insertFocusRetry(
  queue: FocusQueueItem[],
  currentIndex: number,
  rating: Rating,
  updatedCard: Card,
): FocusQueueItem[] {
  const current = queue[currentIndex];
  if (!current || current.phase !== "first" || rating > 2) return queue;

  const spacing = rating === 1 ? 2 : 4;
  const nextBatchIndex = queue.findIndex(
    (item, index) =>
      index > currentIndex &&
      item.phase === "first" &&
      item.batchIndex > current.batchIndex,
  );
  const boundary = nextBatchIndex === -1 ? queue.length : nextBatchIndex;
  const insertionIndex = Math.min(currentIndex + spacing + 1, boundary);
  const retry: FocusQueueItem = {
    ...current,
    card: updatedCard,
    attempt: 1,
    phase: "retry",
  };

  return [
    ...queue.slice(0, insertionIndex),
    retry,
    ...queue.slice(insertionIndex),
  ];
}

/** Build another continuous practice cycle: weak cards first, then all cards. */
export function buildFocusLoop(
  cards: Card[],
  weakCardIds: ReadonlySet<string>,
  cycle: number,
): FocusQueueItem[] {
  const weak = cards.filter((card) => weakCardIds.has(card.id));
  return [...weak, ...cards].map((card, index) => ({
    card,
    task: "recall",
    attempt: 1,
    batchIndex: Math.floor(index / 5),
    cycle,
    phase: index < weak.length ? "weak" : "loop",
  }));
}

/** Claim the only SRS write allowed for a card during one focused session. */
export function claimFirstSessionGrade(
  gradedCardIds: Set<string>,
  cardId: string,
): boolean {
  if (gradedCardIds.has(cardId)) return false;
  gradedCardIds.add(cardId);
  return true;
}

export function normalizeStudyAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function isStudyAnswerCorrect(given: string, expected: string): boolean {
  return normalizeStudyAnswer(given) === normalizeStudyAnswer(expected);
}

export function buildListeningOptions(
  card: Card,
  pool: Card[],
  count = 4,
): string[] {
  const seen = new Set([normalizeStudyAnswer(card.definition)]);
  const distractors = pool
    .filter((candidate) => candidate.id !== card.id)
    .sort((a, b) => stableHash(`${card.id}:${a.id}`) - stableHash(`${card.id}:${b.id}`))
    .map((candidate) => candidate.definition)
    .filter((definition) => {
      const normalized = normalizeStudyAnswer(definition);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, count - 1);

  return [card.definition, ...distractors].sort(
    (a, b) => stableHash(`${card.id}:${a}`) - stableHash(`${card.id}:${b}`),
  );
}

function toQueueItem(card: Card): DailyQueueItem {
  let task: DailyTaskType = "recall";
  if (card.state !== "new") {
    task = card.reps % 3 === 1 ? "listen" : card.reps % 3 === 2 ? "write" : "recall";
  }
  return { card, task, attempt: 0 };
}

function compareCards(a: Card, b: Card): number {
  const dueDelta = new Date(a.due).getTime() - new Date(b.due).getTime();
  if (dueDelta !== 0) return dueDelta;
  if (a.lapses !== b.lapses) return b.lapses - a.lapses;
  return a.id.localeCompare(b.id);
}

function softPriorityOrder(cards: Card[], priorityIds: Set<string>): Card[] {
  const priority = cards.filter((card) => priorityIds.has(card.deckId));
  const regular = cards.filter((card) => !priorityIds.has(card.deckId));
  const ordered: Card[] = [];

  while (priority.length > 0 || regular.length > 0) {
    for (let index = 0; index < 2 && priority.length > 0; index += 1) {
      ordered.push(priority.shift()!);
    }
    if (regular.length > 0) ordered.push(regular.shift()!);
  }
  return ordered;
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return hash;
}
