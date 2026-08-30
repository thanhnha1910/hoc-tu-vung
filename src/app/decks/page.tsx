import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listDeckCardStats, listDecks, listDeckGroups } from "@/lib/repo";
import { DeckGroupsList } from "./deck-groups-list";
import { DeckGroupsManager } from "./deck-groups-manager";
import { NewDeckForm } from "./new-deck-form";
import { ReminderCard } from "./reminder-card";
import { SignOutButton } from "./signout-button";

export default async function DecksPage() {
  const sb = await createSupabaseServerClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/login");

  const [decks, cardStats, deckGroups] = await Promise.all([
    listDecks(sb),
    listDeckCardStats(sb),
    listDeckGroups(sb),
  ]);
  const statsByDeck = new Map(cardStats.map((stat) => [stat.deckId, stat]));
  const deckStats = decks.map((deck) => ({
    deck,
    total: statsByDeck.get(deck.id)?.total ?? 0,
    due: statsByDeck.get(deck.id)?.due ?? 0,
    fresh: statsByDeck.get(deck.id)?.fresh ?? 0,
  }));
  const dueCount = deckStats.reduce((total, stat) => total + stat.due, 0);
  const priorityCount = decks.filter((deck) => deck.isPriority).length;
  const priorityDue = deckStats
    .filter((stat) => stat.deck.isPriority)
    .reduce((total, stat) => total + stat.due, 0);
  const estimatedMinutes = Math.max(2, Math.min(10, Math.ceil(dueCount * 0.6)));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-4 pb-28 pt-5 sm:px-6 sm:pb-12 sm:pt-10">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
            Học Từ Vựng
          </p>
          <p className="mt-1 truncate text-sm text-[var(--color-ink-muted)]">
            {auth.user.email}
          </p>
        </div>
        <SignOutButton />
      </header>

      <section id="today" className="scroll-mt-4">
        <div className="overflow-hidden rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-5 shadow-[var(--shadow-card)] sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--color-accent)]">
                Phiên học hôm nay
              </p>
              <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
                {dueCount > 0 ? `${dueCount} thẻ đang chờ` : "Bạn đã ôn đủ"}
              </h1>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent-soft)] text-xl">
              {dueCount > 0 ? "↗" : "✓"}
            </span>
          </div>

          <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--color-ink-muted)]">
            {dueCount > 0
              ? `Khoảng ${estimatedMinutes} phút. App tự trộn nhớ chủ động, nghe và viết; bộ có dấu sao được ưu tiên.`
              : "FSRS chưa có thẻ đến hạn. Bạn có thể thêm từ mới hoặc luyện thêm một bộ bất kỳ."}
          </p>

          <div className="mt-5 flex flex-wrap gap-2 text-xs text-[var(--color-ink-muted)]">
            <span className="rounded-full bg-[var(--color-bg)] px-3 py-1.5">
              ⭐ {priorityCount} bộ ưu tiên
            </span>
            {priorityDue > 0 && (
              <span className="rounded-full bg-[var(--color-bg)] px-3 py-1.5">
                {priorityDue} thẻ ưu tiên đến hạn
              </span>
            )}
          </div>

          <Link
            href="/study/daily"
            className="tap mt-6 flex w-full items-center justify-center rounded-2xl bg-[var(--color-accent)] px-5 font-semibold text-[var(--color-accent-ink)] shadow-sm active:scale-[0.99]"
          >
            {dueCount > 0 ? "Bắt đầu học 10 phút" : "Mở phiên học"}
          </Link>
        </div>
      </section>

      <ReminderCard />

      <section id="library" className="scroll-mt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Bộ từ của bạn</h2>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
              Chạm ⭐ để ưu tiên trong phiên hằng ngày
            </p>
          </div>
          <span className="text-sm text-[var(--color-ink-muted)]">
            {decks.length} bộ
          </span>
        </div>

        {decks.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-ink-muted)]">
            Chưa có bộ thẻ nào. Tạo bộ đầu tiên ở dưới ↓
          </p>
        ) : (
          <DeckGroupsList deckStats={deckStats} deckGroups={deckGroups} />
        )}
      </section>

      <details id="manage" className="scroll-mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-4">
        <summary className="cursor-pointer list-none font-semibold">
          Thêm và quản lý bộ từ
        </summary>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <NewDeckForm deckGroups={deckGroups} />
          <DeckGroupsManager groups={deckGroups} />
        </div>
      </details>

      <nav className="fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-40 mx-auto grid max-w-sm grid-cols-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)]/95 p-1.5 shadow-[var(--shadow-float)] backdrop-blur sm:hidden">
        <MobileNavLink href="#today" icon="◉" label="Hôm nay" />
        <MobileNavLink href="#library" icon="▤" label="Bộ từ" />
        <MobileNavLink href="#manage" icon="＋" label="Thêm" />
      </nav>
    </main>
  );
}

function MobileNavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <a
      href={href}
      className="tap flex flex-col items-center justify-center rounded-xl text-[10px] font-medium text-[var(--color-ink-muted)] active:bg-[var(--color-accent-soft)] active:text-[var(--color-accent)]"
    >
      <span className="text-lg leading-none" aria-hidden>{icon}</span>
      <span className="mt-1">{label}</span>
    </a>
  );
}
