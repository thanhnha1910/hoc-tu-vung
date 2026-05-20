import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listDueCards } from "@/lib/repo";
import { FlashcardsSession } from "../study/[deckId]/flashcards-session";

/**
 * /review — global "today's queue" across all decks.
 * One unified session, so the user can just bash through whatever
 * FSRS thinks is due regardless of which deck owns it.
 */
export default async function ReviewPage() {
  const sb = await createSupabaseServerClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/login");

  const due = await listDueCards(sb, { limit: 200 });

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 px-4 py-5 sm:py-8">
      <nav className="flex items-center justify-between text-sm">
        <Link
          href="/decks"
          className="text-[var(--color-ink-muted)] hover:underline"
        >
          ← Bộ thẻ
        </Link>
        <span className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
          Ôn hôm nay
        </span>
      </nav>

      {due.length === 0 ? (
        <div className="my-auto flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-5xl">🌿</p>
          <h2 className="text-xl font-semibold">Không còn thẻ nào cần ôn</h2>
          <p className="max-w-sm text-sm text-[var(--color-ink-muted)]">
            FSRS đã sắp xếp lại lịch. Bạn có thể học thẻ mới hoặc nghỉ một chút.
          </p>
          <Link
            href="/decks"
            className="rounded-full bg-[var(--color-accent)] px-5 py-2 font-medium text-[var(--color-accent-ink)]"
          >
            Về bộ thẻ
          </Link>
        </div>
      ) : (
        <FlashcardsSession initialCards={due} mode="review" />
      )}
    </main>
  );
}
