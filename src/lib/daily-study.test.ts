import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDailyQueue,
  buildFocusLoop,
  buildFocusQueue,
  buildListeningOptions,
  claimFirstSessionGrade,
  insertFocusRetry,
  isStudyAnswerCorrect,
  normalizeStudyAnswer,
} from "./daily-study.ts";
import type { Card, Deck } from "./types.ts";

const NOW = new Date("2026-08-30T10:00:00.000Z");

function deck(id: string, isPriority = false): Deck {
  return {
    id,
    ownerId: "owner",
    name: id,
    description: null,
    groupName: null,
    isPriority,
    sourceLang: "en",
    targetLang: "vi",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

function card(
  id: string,
  deckId: string,
  overrides: Partial<Card> = {},
): Card {
  return {
    id,
    deckId,
    ownerId: "owner",
    term: `term ${id}`,
    definition: `nghĩa ${id}`,
    example: null,
    pronunciation: null,
    imageUrl: null,
    state: "review",
    due: new Date(NOW.getTime() - 60_000).toISOString(),
    stability: 1,
    difficulty: 5,
    elapsedDays: 1,
    scheduledDays: 1,
    reps: 0,
    lapses: 0,
    lastReview: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

test("priority decks get two soft-priority slots without starving regular decks", () => {
  const decks = [deck("priority", true), deck("regular")];
  const cards = [
    card("p1", "priority"),
    card("p2", "priority"),
    card("p3", "priority"),
    card("p4", "priority"),
    card("r1", "regular"),
    card("r2", "regular"),
  ];

  const queue = buildDailyQueue(cards, decks, { now: NOW });
  assert.deepEqual(
    queue.slice(0, 6).map((item) => item.card.deckId),
    ["priority", "priority", "regular", "priority", "priority", "regular"],
  );
});

test("queue excludes future cards and caps new cards", () => {
  const decks = [deck("priority", true), deck("regular")];
  const newCards = Array.from({ length: 8 }, (_, index) =>
    card(`new-${index}`, index < 6 ? "priority" : "regular", { state: "new" }),
  );
  const future = card("future", "priority", {
    due: new Date(NOW.getTime() + 60_000).toISOString(),
  });

  const queue = buildDailyQueue([...newCards, future], decks, {
    now: NOW,
    newCardLimit: 5,
  });
  assert.equal(queue.length, 5);
  assert.equal(queue.some((item) => item.card.id === "future"), false);
  assert.equal(queue.some((item) => item.card.deckId === "regular"), true);
});

test("deck filter creates an exclusive focused queue", () => {
  const decks = [deck("a"), deck("b", true)];
  const queue = buildDailyQueue(
    [card("a1", "a"), card("b1", "b")],
    decks,
    { now: NOW, deckId: "a" },
  );
  assert.deepEqual(queue.map((item) => item.card.id), ["a1"]);
});

test("focus queue keeps every card and marks five-card groups", () => {
  const cards = Array.from({ length: 12 }, (_, index) =>
    card(`focus-${index + 1}`, "a", {
      state: "new",
      due: new Date(NOW.getTime() + 60_000).toISOString(),
    }),
  );
  const queue = buildFocusQueue(cards);

  assert.equal(queue.length, 12);
  assert.deepEqual(queue.map((item) => item.batchIndex), [
    0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2,
  ]);
  assert.equal(queue.every((item) => item.phase === "first"), true);
});

test("weak retry stays inside its five-card group and happens only once", () => {
  const cards = Array.from({ length: 10 }, (_, index) =>
    card(`focus-${index + 1}`, "a"),
  );
  const initial = buildFocusQueue(cards);
  const withAgain = insertFocusRetry(initial, 0, 1, cards[0]);
  assert.deepEqual(
    withAgain.slice(0, 6).map((item) => `${item.card.id}:${item.phase}`),
    [
      "focus-1:first",
      "focus-2:first",
      "focus-3:first",
      "focus-1:retry",
      "focus-4:first",
      "focus-5:first",
    ],
  );

  const lastInBatch = withAgain.findIndex(
    (item) => item.card.id === "focus-5" && item.phase === "first",
  );
  const withHard = insertFocusRetry(withAgain, lastInBatch, 2, cards[4]);
  const nextBatch = withHard.findIndex((item) => item.batchIndex === 1);
  assert.equal(withHard[nextBatch - 1].card.id, "focus-5");
  assert.equal(withHard[nextBatch - 1].phase, "retry");
  assert.equal(insertFocusRetry(withHard, nextBatch - 1, 1, cards[4]), withHard);
});

test("focus loop puts unique weak cards first then keeps the full deck", () => {
  const cards = Array.from({ length: 6 }, (_, index) =>
    card(`focus-${index + 1}`, "a"),
  );
  const loop = buildFocusLoop(cards, new Set(["focus-2", "focus-5"]), 2);
  assert.deepEqual(loop.slice(0, 2).map((item) => item.card.id), [
    "focus-2",
    "focus-5",
  ]);
  assert.equal(loop.length, 8);
  assert.equal(loop[0].phase, "weak");
  assert.equal(loop[2].phase, "loop");
});

test("a focused session persists each card grade only once", () => {
  const graded = new Set<string>();
  assert.equal(claimFirstSessionGrade(graded, "focus-1"), true);
  assert.equal(claimFirstSessionGrade(graded, "focus-1"), false);
  assert.equal(claimFirstSessionGrade(graded, "focus-2"), true);
});

test("answer normalization is case, punctuation, spacing and curly-quote tolerant", () => {
  assert.equal(normalizeStudyAnswer("  Make   a Decision! "), "make a decision");
  assert.equal(isStudyAnswerCorrect("DON’T give up", "don't give up"), true);
  assert.equal(isStudyAnswerCorrect("make decision", "make a decision"), false);
});

test("listening options are stable, unique and include the correct definition", () => {
  const target = card("target", "a", { definition: "quyết định" });
  const pool = [
    target,
    card("1", "a", { definition: "lựa chọn" }),
    card("2", "a", { definition: "lựa chọn" }),
    card("3", "a", { definition: "trách nhiệm" }),
    card("4", "a", { definition: "thói quen" }),
  ];
  const first = buildListeningOptions(target, pool);
  const second = buildListeningOptions(target, pool);
  assert.deepEqual(first, second);
  assert.equal(first.includes("quyết định"), true);
  assert.equal(new Set(first).size, first.length);
});
