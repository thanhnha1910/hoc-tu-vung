/**
 * Data-access layer: thin wrapper around Supabase that maps DB rows
 * (snake_case) to our app types (camelCase).
 *
 * All functions take a Supabase client so they work in both
 * Server Components (server client) and Client Components (browser client).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card, Deck, DeckGroup, LearningMode, Rating, ReviewLog } from "./types";

// ---------- DB row shapes (snake_case) ----------
interface DeckRow {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  group_name: string | null;
  is_priority: boolean;
  source_lang: string;
  target_lang: string;
  created_at: string;
  updated_at: string;
}

interface DeckGroupRow {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

interface CardRow {
  id: string;
  deck_id: string;
  owner_id: string;
  term: string;
  definition: string;
  example: string | null;
  pronunciation: string | null;
  image_url: string | null;
  state: Card["state"];
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  last_review: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Mappers ----------
function deckFromRow(r: DeckRow): Deck {
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    description: r.description,
    groupName: r.group_name,
    isPriority: r.is_priority ?? false,
    sourceLang: r.source_lang,
    targetLang: r.target_lang,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function deckGroupFromRow(r: DeckGroupRow): DeckGroup {
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    createdAt: r.created_at,
  };
}

function cardFromRow(r: CardRow): Card {
  return {
    id: r.id,
    deckId: r.deck_id,
    ownerId: r.owner_id,
    term: r.term,
    definition: r.definition,
    example: r.example,
    pronunciation: r.pronunciation,
    imageUrl: r.image_url,
    state: r.state,
    due: r.due,
    stability: r.stability,
    difficulty: r.difficulty,
    elapsedDays: r.elapsed_days,
    scheduledDays: r.scheduled_days,
    reps: r.reps,
    lapses: r.lapses,
    lastReview: r.last_review,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ---------- Decks ----------
export async function listDecks(sb: SupabaseClient): Promise<Deck[]> {
  const { data, error } = await sb
    .from("decks")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as DeckRow[]).map(deckFromRow);
}

export async function getDeck(
  sb: SupabaseClient,
  id: string,
): Promise<Deck | null> {
  const { data, error } = await sb
    .from("decks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? deckFromRow(data as DeckRow) : null;
}

export async function createDeck(
  sb: SupabaseClient,
  input: { name: string; description?: string; groupName?: string },
): Promise<Deck> {
  const { data: user } = await sb.auth.getUser();
  if (!user.user) throw new Error("Not authenticated");
  const { data, error } = await sb
    .from("decks")
    .insert({
      name: input.name,
      description: input.description ?? null,
      group_name: input.groupName?.trim() || null,
      owner_id: user.user.id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return deckFromRow(data as DeckRow);
}

export interface DeckCardStat {
  deckId: string;
  total: number;
  due: number;
  fresh: number;
}

/** Load dashboard counts in one cards query instead of one query per deck. */
export async function listDeckCardStats(
  sb: SupabaseClient,
  now: Date = new Date(),
): Promise<DeckCardStat[]> {
  const { data, error } = await sb
    .from("cards")
    .select("deck_id,state,due");
  if (error) throw error;

  const byDeck = new Map<string, DeckCardStat>();
  for (const row of (data ?? []) as Pick<CardRow, "deck_id" | "state" | "due">[]) {
    const stat = byDeck.get(row.deck_id) ?? {
      deckId: row.deck_id,
      total: 0,
      due: 0,
      fresh: 0,
    };
    stat.total += 1;
    if (new Date(row.due).getTime() <= now.getTime()) stat.due += 1;
    if (row.state === "new") stat.fresh += 1;
    byDeck.set(row.deck_id, stat);
  }
  return [...byDeck.values()];
}

export async function updateDeck(
  sb: SupabaseClient,
  id: string,
  input: {
    name?: string;
    groupName?: string | null;
    isPriority?: boolean;
  },
): Promise<void> {
  const payload: any = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.groupName !== undefined) payload.group_name = input.groupName?.trim() || null;
  if (input.isPriority !== undefined) payload.is_priority = input.isPriority;

  const { error } = await sb
    .from("decks")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteDeck(
  sb: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await sb.from("decks").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Deck Groups ----------
export async function listDeckGroups(sb: SupabaseClient): Promise<DeckGroup[]> {
  const { data, error } = await sb
    .from("deck_groups")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as DeckGroupRow[]).map(deckGroupFromRow);
}

export async function createDeckGroup(
  sb: SupabaseClient,
  name: string,
): Promise<DeckGroup> {
  const { data: user } = await sb.auth.getUser();
  if (!user.user) throw new Error("Not authenticated");
  const { data, error } = await sb
    .from("deck_groups")
    .insert({
      name: name.trim(),
      owner_id: user.user.id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return deckGroupFromRow(data as DeckGroupRow);
}

export async function deleteDeckGroup(
  sb: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await sb.from("deck_groups").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Cards ----------
export async function listCards(
  sb: SupabaseClient,
  deckId: string,
): Promise<Card[]> {
  const { data, error } = await sb
    .from("cards")
    .select("*")
    .eq("deck_id", deckId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as CardRow[]).map(cardFromRow);
}

export async function listDueCards(
  sb: SupabaseClient,
  opts: { deckId?: string; limit?: number } = {},
): Promise<Card[]> {
  let q = sb
    .from("cards")
    .select("*")
    .lte("due", new Date().toISOString())
    .order("due", { ascending: true })
    .limit(opts.limit ?? 100);
  if (opts.deckId) q = q.eq("deck_id", opts.deckId);
  const { data, error } = await q;
  if (error) throw error;
  return (data as CardRow[]).map(cardFromRow);
}

export async function createCard(
  sb: SupabaseClient,
  input: {
    deckId: string;
    term: string;
    definition: string;
    example?: string;
    pronunciation?: string;
  },
): Promise<Card> {
  const { data: user } = await sb.auth.getUser();
  if (!user.user) throw new Error("Not authenticated");
  const { data, error } = await sb
    .from("cards")
    .insert({
      deck_id: input.deckId,
      owner_id: user.user.id,
      term: input.term,
      definition: input.definition,
      example: input.example ?? null,
      pronunciation: input.pronunciation ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return cardFromRow(data as CardRow);
}

/** Bulk-insert many cards in one request. Returns number inserted. */
export async function bulkCreateCards(
  sb: SupabaseClient,
  deckId: string,
  rows: { term: string; definition: string; example?: string }[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const { data: user } = await sb.auth.getUser();
  if (!user.user) throw new Error("Not authenticated");
  const payload = rows.map((r) => ({
    deck_id: deckId,
    owner_id: user.user!.id,
    term: r.term,
    definition: r.definition,
    example: r.example ?? null,
  }));
  const { data, error } = await sb.from("cards").insert(payload).select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function updateCardSrs(
  sb: SupabaseClient,
  card: Card,
): Promise<void> {
  const { error } = await sb
    .from("cards")
    .update({
      state: card.state,
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsed_days: card.elapsedDays,
      scheduled_days: card.scheduledDays,
      reps: card.reps,
      lapses: card.lapses,
      last_review: card.lastReview,
    })
    .eq("id", card.id);
  if (error) throw error;
}

export async function deleteCard(
  sb: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await sb.from("cards").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Review logs ----------
export async function insertReviewLog(
  sb: SupabaseClient,
  log: Omit<ReviewLog, "id">,
): Promise<void> {
  const { error } = await sb.from("review_logs").insert({
    card_id: log.cardId,
    owner_id: log.ownerId,
    rating: log.rating satisfies Rating,
    state: log.state,
    due: log.due,
    stability: log.stability,
    difficulty: log.difficulty,
    elapsed_days: log.elapsedDays,
    last_elapsed_days: log.lastElapsedDays,
    scheduled_days: log.scheduledDays,
    mode: log.mode satisfies LearningMode,
    reviewed_at: log.reviewedAt,
  });
  if (error) throw error;
}

export async function countDue(sb: SupabaseClient): Promise<number> {
  const { count, error } = await sb
    .from("cards")
    .select("*", { count: "exact", head: true })
    .lte("due", new Date().toISOString());
  if (error) throw error;
  return count ?? 0;
}
