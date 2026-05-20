"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Card } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { deleteCard } from "@/lib/repo";

const STATE_LABEL: Record<Card["state"], string> = {
  new: "Mới",
  learning: "Đang học",
  review: "Ôn tập",
  relearning: "Học lại",
};

const STATE_COLOR: Record<Card["state"], string> = {
  new: "text-[var(--color-ink-muted)]",
  learning: "text-[var(--color-warn)]",
  review: "text-[var(--color-good)]",
  relearning: "text-[var(--color-bad)]",
};

export function CardRow({ card }: { card: Card }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onDelete() {
    if (!confirm(`Xoá thẻ "${card.term}"?`)) return;
    start(async () => {
      const sb = createSupabaseBrowserClient();
      await deleteCard(sb, card.id);
      router.refresh();
    });
  }

  return (
    <li className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{card.term}</p>
        <p className="truncate text-sm text-[var(--color-ink-muted)]">
          {card.definition}
        </p>
      </div>
      <span className={`text-xs ${STATE_COLOR[card.state]}`}>
        {STATE_LABEL[card.state]}
      </span>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        aria-label="Xoá thẻ"
        className="tap flex items-center justify-center rounded-full text-[var(--color-ink-muted)] hover:text-[var(--color-bad)] disabled:opacity-50"
      >
        ✕
      </button>
    </li>
  );
}
