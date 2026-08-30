import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDeck, listCards } from "@/lib/repo";
import {
  FlashIcon,
  LearnIcon,
  MatchIcon,
  ModeTile,
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
            href={`/study/daily?deckId=${deck.id}`}
            className="tap flex items-center rounded-full bg-[var(--color-accent-soft)] px-4 text-xs font-semibold text-[var(--color-accent)]"
          >
            {dueNow} thẻ đến hạn
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

      <Link
        href={`/study/daily?deckId=${deck.id}`}
        className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-5 shadow-[var(--shadow-card)] active:scale-[0.99]"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--color-accent)]">
              Học tập trung
            </p>
            <h2 className="mt-1 text-xl font-bold">Học bộ này trong 10 phút</h2>
            <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
              Nhớ chủ động, nghe và viết trong một phiên duy nhất.
            </p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-xl text-[var(--color-accent-ink)]">
            →
          </span>
        </div>
      </Link>

      {/* Secondary practice modes do not alter the FSRS review schedule. */}
      <details className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold">
          Luyện thêm
          <span className="ml-2 font-normal text-[var(--color-ink-muted)]">
            · không thay đổi lịch ôn
          </span>
        </summary>
        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ModeTile
            href={`/study/${deck.id}?mode=flashcards`}
            label="Thẻ ghi nhớ"
            color="flash"
            icon={FlashIcon}
          />
          <ModeTile
            href={`/study/${deck.id}?mode=learn`}
            label="Bài luyện"
            color="learn"
            icon={LearnIcon}
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
      </details>

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
