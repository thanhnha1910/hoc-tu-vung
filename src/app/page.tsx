import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ code?: string; next?: string }>;
}

export default async function HomePage({ searchParams }: Props) {
  // Supabase OAuth can land back on `/` with `?code=...` if Site URL is set to
  // the root. Forward that to the proper callback handler so login completes.
  const { code, next } = await searchParams;
  if (code) {
    const qs = new URLSearchParams({ code, ...(next ? { next } : {}) });
    redirect(`/auth/callback?${qs.toString()}`);
  }

  const sb = await createSupabaseServerClient();
  const { data } = await sb.auth.getUser();
  if (data.user) redirect("/decks");

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-10 px-5 py-10 sm:py-16">
      <header className="flex flex-col gap-2">
        <span className="text-sm font-medium tracking-wide text-[var(--color-ink-muted)] uppercase">
          Học Từ Vựng
        </span>
        <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">
          Quizlet gặp Anki.
          <br />
          <span className="text-[var(--color-accent)]">
            Học nhanh, nhớ lâu.
          </span>
        </h1>
        <p className="mt-3 max-w-prose text-base text-[var(--color-ink-muted)] sm:text-lg">
          Mọi dạng học vui như Quizlet (Flashcards, Learn, Match, Test) chạy
          trên cùng một bộ lịch ôn thông minh FSRS — bạn chỉ cần ôn đúng thứ
          mình sắp quên.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <FeatureCard
          title="Flashcards"
          desc="Lật thẻ, vuốt, nghe phát âm. Tự chấm Again / Hard / Good / Easy."
        />
        <FeatureCard
          title="Learn (adaptive)"
          desc="MCQ chuyển sang Write khi bạn đã thuộc — đúng kiểu Quizlet Learn."
        />
        <FeatureCard
          title="Match (game)"
          desc="Kéo-thả ghép term với nghĩa, đua thời gian — chơi cả trên điện thoại."
        />
        <FeatureCard
          title="SRS thông minh"
          desc="FSRS xếp lịch ôn dựa trên cách bạn thực sự quên — giảm 20–30% lượt review."
        />
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/login"
          className="rounded-full bg-[var(--color-accent)] px-6 py-3 text-base font-medium text-[var(--color-accent-ink)] shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Bắt đầu học
        </Link>
        <Link
          href="/decks"
          className="rounded-full border border-[var(--color-line)] px-6 py-3 text-base font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bg-elev)]"
        >
          Xem các bộ thẻ
        </Link>
      </div>

      <footer className="mt-auto pt-10 text-sm text-[var(--color-ink-muted)]">
        MVP 1 · Next.js 15 · Tailwind v4 · FSRS · Supabase
      </footer>
    </main>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-5 transition-colors hover:border-[var(--color-accent)]/40">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{desc}</p>
    </div>
  );
}
