import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listDecks, listDueCards } from "@/lib/repo";
import { DailySession } from "./daily-session";

export default async function DailyStudyPage({
  searchParams,
}: {
  searchParams: Promise<{ deckId?: string }>;
}) {
  const { deckId } = await searchParams;
  const sb = await createSupabaseServerClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/login");

  const [cards, decks] = await Promise.all([
    listDueCards(sb, { deckId, limit: 200 }),
    listDecks(sb),
  ]);
  const selectedDeck = deckId
    ? decks.find((deck) => deck.id === deckId)
    : undefined;
  if (deckId && !selectedDeck) redirect("/decks");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 sm:px-6 sm:pt-8">
      <nav className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={selectedDeck ? `/decks/${selectedDeck.id}` : "/decks"}
          className="tap inline-flex items-center rounded-full px-2 text-sm text-[var(--color-ink-muted)]"
        >
          ← Thoát
        </Link>
        <span className="min-w-0 truncate text-sm font-semibold">
          {selectedDeck ? selectedDeck.name : "Học hôm nay"}
        </span>
        <span className="w-14" aria-hidden />
      </nav>

      <DailySession
        initialCards={cards}
        decks={decks}
        selectedDeckId={selectedDeck?.id}
      />
    </main>
  );
}
