import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { countDue, listDecks } from "@/lib/repo";
import { NewDeckForm } from "./new-deck-form";
import { SignOutButton } from "./signout-button";

export default async function DecksPage() {
  const sb = await createSupabaseServerClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/login");

  const [decks, dueCount] = await Promise.all([listDecks(sb), countDue(sb)]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-5 py-8 sm:py-12">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-[var(--color-ink-muted)] uppercase">
            Xin chào
          </p>
          <h1 className="truncate text-xl font-semibold sm:text-3xl">
            {auth.user.email}
          </h1>
        </div>
        <SignOutButton />
      </header>

      <Link
        href="/review"
        className="rounded-[var(--radius-card)] border border-[var(--color-accent)]/30 bg-gradient-to-br from-[var(--color-accent)]/10 to-transparent p-5 transition-transform active:scale-[0.99]"
      >
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--color-ink-muted)]">Hôm nay</p>
            <p className="mt-1 text-3xl font-semibold">
              {dueCount}{" "}
              <span className="text-base font-normal text-[var(--color-ink-muted)]">
                thẻ cần ôn
              </span>
            </p>
          </div>
          <span className="text-sm font-medium text-[var(--color-accent)]">
            Bắt đầu →
          </span>
        </div>
      </Link>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Bộ thẻ của bạn</h2>
          <span className="text-sm text-[var(--color-ink-muted)]">
            {decks.length} bộ
          </span>
        </div>

        {decks.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-ink-muted)]">
            Chưa có bộ thẻ nào. Tạo bộ đầu tiên ở dưới ↓
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {decks.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/decks/${d.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-4 transition-colors hover:border-[var(--color-accent)]/40"
                >
                  <div>
                    <p className="font-medium">{d.name}</p>
                    {d.description && (
                      <p className="text-sm text-[var(--color-ink-muted)]">
                        {d.description}
                      </p>
                    )}
                  </div>
                  <span className="text-[var(--color-ink-muted)]">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <NewDeckForm />
    </main>
  );
}
