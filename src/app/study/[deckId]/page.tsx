import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDeck, listCards } from "@/lib/repo";
import { FlashcardsSession } from "./flashcards-session";
import { LearnSession } from "./learn-session";
import { MatchSession } from "./match-session";
import { TestEntry } from "./test-entry";
import { ComingSoon } from "./coming-soon";

type Mode =
  | "flashcards"
  | "learn"
  | "match"
  | "test"
  | "blocks"
  | "blast"
  | "review";

const MODE_LABEL: Record<Mode, string> = {
  flashcards: "Thẻ ghi nhớ",
  learn: "Học",
  match: "Ghép thẻ",
  test: "Kiểm tra",
  blocks: "Khối hộp",
  blast: "Blast",
  review: "Ôn tập",
};

export default async function StudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { deckId } = await params;
  const { mode: rawMode } = await searchParams;
  const sb = await createSupabaseServerClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/login");

  const deck = await getDeck(sb, deckId);
  if (!deck) notFound();
  const allCards = await listCards(sb, deckId);

  const mode: Mode = (
    [
      "flashcards",
      "learn",
      "match",
      "test",
      "blocks",
      "blast",
      "review",
    ] as Mode[]
  ).includes(rawMode as Mode)
    ? (rawMode as Mode)
    : "flashcards";

  const now = Date.now();
  const queue =
    mode === "review"
      ? allCards.filter((c) => new Date(c.due).getTime() <= now)
      : allCards;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 px-4 py-5 sm:py-8">
      <nav className="flex items-center justify-between text-sm">
        <Link
          href={`/decks/${deckId}`}
          className="text-[var(--color-ink-muted)] hover:underline"
        >
          ← {deck.name}
        </Link>
        <span className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
          {MODE_LABEL[mode]}
        </span>
      </nav>

      <ModeBody mode={mode} cards={queue} deckId={deckId} />
    </main>
  );
}

function ModeBody({
  mode,
  cards,
  deckId,
}: {
  mode: Mode;
  cards: Awaited<ReturnType<typeof listCards>>;
  deckId: string;
}) {
  if (cards.length === 0) return <EmptyState mode={mode} deckId={deckId} />;

  switch (mode) {
    case "flashcards":
    case "review":
      return <FlashcardsSession initialCards={cards} mode={mode} />;
    case "learn":
      return <LearnSession initialCards={cards} />;
    case "match":
      if (cards.length < 4) {
        return (
          <ComingSoon
            deckId={deckId}
            modeLabel="Ghép thẻ"
            description="Cần ít nhất 4 thẻ để chơi. Thêm thẻ rồi quay lại."
          />
        );
      }
      return <MatchSession initialCards={cards} deckId={deckId} />;
    case "test":
      return <TestEntry initialCards={cards} deckId={deckId} />;
    case "blocks":
      return (
        <ComingSoon
          deckId={deckId}
          modeLabel="Khối hộp"
          description="Game xếp khối kết hợp ôn từ — sắp ra mắt."
        />
      );
    case "blast":
      return (
        <ComingSoon
          deckId={deckId}
          modeLabel="Blast"
          description="Game bắn asteroid phản xạ nghĩa từ — sắp ra mắt."
        />
      );
  }
}

function EmptyState({ mode, deckId }: { mode: Mode; deckId: string }) {
  return (
    <div className="my-auto flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-5xl">🎉</p>
      <h2 className="text-xl font-semibold">
        {mode === "review"
          ? "Không còn thẻ nào cần ôn!"
          : "Bộ thẻ này trống"}
      </h2>
      <p className="max-w-sm text-sm text-[var(--color-ink-muted)]">
        {mode === "review"
          ? "Quay lại sau, FSRS sẽ lên lịch thẻ tiếp theo cho bạn."
          : "Thêm thẻ vào bộ rồi quay lại học."}
      </p>
      <Link
        href={`/decks/${deckId}`}
        className="rounded-full bg-[var(--color-accent)] px-5 py-2 font-medium text-[var(--color-accent-ink)]"
      >
        Về bộ thẻ
      </Link>
    </div>
  );
}
