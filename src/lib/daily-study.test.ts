import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDailyQueue,
  buildListeningOptions,
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
