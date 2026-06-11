import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDeck, listCards } from "@/lib/repo";
import {
  FlashIcon,
  LearnIcon,
  MatchIcon,
  ModeTile,
  ReviewIcon,
  TestIcon,
} from "@/components/mode-tile";
import { AddCardForm } from "./add-card-form";
import { CardRow } from "./card-row";
import { ImportModal } from "./import-modal";

export default async function DeckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/login");

  const deck = await getDeck(sb, id);
  if (!deck) notFound();
  const cards = await listCards(sb, id);

  const now = Date.now();
  const dueNow = cards.filter((c) => new Date(c.due).getTime() <= now).length;
  const newCount = cards.filter((c) => c.state === "new").length;
  const enoughForMatch = cards.length >= 4;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-5 py-6 sm:py-10">
      {/* Top nav */}
      <nav className="flex items-center justify-between text-sm">
        <Link
          href="/decks"
          className="text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
        >
          ← Bộ thẻ
        </Link>
        {dueNow > 0 && (
          <Link
            href={`/study/${deck.id}?mode=review`}
            className="rounded-full bg-[var(--color-accent)] px-4 py-1.5 text-xs font-semibold text-[var(--color-accent-ink)]"
          >
            Ôn hôm nay · {dueNow}
          </Link>
        )}
      </nav>

      {/* Title */}
      <header className="flex flex-col gap-2">
        <h1 className="break-words text-2xl font-bold leading-tight sm:text-4xl">
          {deck.name}
        </h1>
        {deck.description && (
          <p className="text-[var(--color-ink-muted)]">{deck.description}</p>
        )}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-ink-muted)]">
          <span>
            <b className="text-[var(--color-ink)]">{cards.length}</b> thẻ
          </span>
          <span>
            <b className="text-[var(--color-ink)]">{newCount}</b> mới
          </span>
          <span
            className={
              dueNow > 0
                ? "font-medium text-[var(--color-accent)]"
                : "text-[var(--color-ink-muted)]"
            }
          >
            <b className="text-current">{dueNow}</b> cần ôn
          </span>
        </div>
      </header>

      {/* Mode grid */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <ModeTile
          href={`/study/${deck.id}?mode=flashcards`}
          label="Thẻ ghi nhớ"
          color="flash"
          icon={FlashIcon}
        />
        <ModeTile
          href={`/study/${deck.id}?mode=learn`}
          label="Học"
          color="learn"
          icon={LearnIcon}
        />
        <ModeTile
          href={`/study/${deck.id}?mode=review`}
          label="Ôn tập"
          color="review"
          icon={ReviewIcon}
          disabled={dueNow === 0}
          badge={dueNow > 0 ? String(dueNow) : undefined}
        />
        <ModeTile
          href={`/study/${deck.id}?mode=test`}
          label="Kiểm tra"
          color="test"
          icon={TestIcon}
          disabled={cards.length < 4}
        />
        <ModeTile
          href={`/study/${deck.id}?mode=match`}
          label="Ghép thẻ"
          color="match"
          icon={MatchIcon}
          disabled={!enoughForMatch}
        />
      </section>

      {/* Quick add + import */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Thêm thẻ</h2>
          <ImportModal deckId={deck.id} />
        </div>
        <AddCardForm deckId={deck.id} />
      </div>

      {/* Card list */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-[var(--color-ink-muted)]">
          Thẻ trong bộ ({cards.length})
        </h2>
        {cards.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-ink-muted)]">
            Chưa có thẻ. Thêm thẻ đầu tiên hoặc nhập nhanh ↑
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)]">
            {cards.map((c) => (
              <CardRow key={c.id} card={c} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
