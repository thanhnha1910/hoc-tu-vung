import Link from "next/link";

export function ComingSoon({
  deckId,
  modeLabel,
  description,
}: {
  deckId: string;
  modeLabel: string;
  description: string;
}) {
  return (
    <div className="my-auto flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-5xl">🚧</p>
      <h2 className="text-xl font-semibold">{modeLabel} — sắp ra mắt</h2>
      <p className="max-w-md text-sm text-[var(--color-ink-muted)]">
        {description}
      </p>
      <Link
        href={`/decks/${deckId}`}
        className="mt-3 rounded-full bg-[var(--color-accent)] px-5 py-2 font-medium text-[var(--color-accent-ink)]"
      >
        Về bộ thẻ
      </Link>
    </div>
  );
}
