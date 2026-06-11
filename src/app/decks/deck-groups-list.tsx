"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { updateDeckGroup } from "@/lib/repo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Deck } from "@/lib/types";

export interface DeckStat {
  deck: Deck;
  total: number;
  due: number;
  fresh: number;
}

interface DeckGroup {
  key: string;
  name: string | null;
  label: string;
  items: DeckStat[];
  total: number;
  due: number;
}

export function DeckGroupsList({ deckStats }: { deckStats: DeckStat[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftGroup, setDraftGroup] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const groups = useMemo(() => groupDecks(deckStats), [deckStats]);
  const groupNames = groups
    .map((group) => group.name)
    .filter((name): name is string => Boolean(name));

  function beginEdit(deck: Deck) {
    setErr(null);
    setEditingId(deck.id);
    setDraftGroup(deck.groupName ?? "");
  }

  function toggleGroup(groupKey: string) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }

  function saveGroup(deckId: string) {
    setErr(null);
    start(async () => {
      try {
        const sb = createSupabaseBrowserClient();
        await updateDeckGroup(sb, deckId, draftGroup);
        setEditingId(null);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Không đổi được nhóm bài");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <datalist id="deck-group-options">
        {groupNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {err && <p className="text-sm text-[var(--color-bad)]">{err}</p>}

      {groups.map((group) => {
        const isOpen = openGroups.has(group.key);

        return (
          <section key={group.key} className="flex flex-col gap-2">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggleGroup(group.key)}
              className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-4 text-left transition-colors hover:border-[var(--color-accent)]/50"
            >
              <div className="min-w-0">
                <h3 className="break-words text-base font-semibold">
                  {group.label}
                </h3>
                <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                  {group.items.length} bộ · {group.total} thẻ · {group.due} cần
                  ôn
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-2">
                {group.due > 0 && (
                  <span className="rounded-full bg-[var(--color-accent)]/15 px-3 py-1 text-xs font-medium text-[var(--color-accent)]">
                    {group.due} thẻ
                  </span>
                )}
                <span
                  aria-hidden
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)] text-lg text-[var(--color-ink-muted)]"
                >
                  {isOpen ? "−" : "+"}
                </span>
              </span>
            </button>

            {isOpen && (
              <ul className="ml-0 flex flex-col gap-2 sm:ml-4">
                {group.items.map(({ deck, total, due, fresh }) => (
                  <li
                    key={deck.id}
                    className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)]/70 p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <Link
                        href={`/decks/${deck.id}`}
                        className="min-w-0 flex-1"
                      >
                        <p className="break-words font-medium">{deck.name}</p>
                        {deck.description && (
                          <p className="mt-1 break-words text-sm text-[var(--color-ink-muted)]">
                            {deck.description}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-ink-muted)]">
                          <span>
                            <b className="text-[var(--color-ink)]">{total}</b>{" "}
                            thẻ
                          </span>
                          <span>
                            <b className="text-[var(--color-ink)]">{fresh}</b>{" "}
                            mới
                          </span>
                          <span
                            className={
                              due > 0
                                ? "font-medium text-[var(--color-accent)]"
                                : undefined
                            }
                          >
                            <b className="text-current">{due}</b> cần ôn
                          </span>
                        </div>
                      </Link>

                      <div className="flex flex-col gap-2 sm:w-64">
                        <div className="grid grid-cols-2 gap-2">
                          <Link
                            href={`/study/${deck.id}?mode=flashcards`}
                            className="rounded-full border border-[var(--color-line)] px-4 py-2 text-center text-sm font-medium transition-colors hover:border-[var(--color-accent)]"
                          >
                            Học
                          </Link>
                          <Link
                            href={`/study/${deck.id}?mode=review`}
                            aria-disabled={due === 0}
                            className={
                              due === 0
                                ? "pointer-events-none rounded-full border border-[var(--color-line)] px-4 py-2 text-center text-sm font-medium text-[var(--color-ink-muted)] opacity-50"
                                : "rounded-full bg-[var(--color-accent)] px-4 py-2 text-center text-sm font-medium text-[var(--color-accent-ink)]"
                            }
                          >
                            Ôn
                          </Link>
                        </div>

                        {editingId === deck.id ? (
                          <div className="grid grid-cols-[1fr_auto] gap-2">
                            <input
                              autoFocus
                              list="deck-group-options"
                              value={draftGroup}
                              onChange={(e) => setDraftGroup(e.target.value)}
                              placeholder="Bài 1"
                              className="min-w-0 rounded-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                            />
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => saveGroup(deck.id)}
                              className="rounded-full bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-[var(--color-accent-ink)] disabled:opacity-50"
                            >
                              Lưu
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => beginEdit(deck)}
                            className="rounded-full border border-dashed border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                          >
                            Đổi nhóm
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function groupDecks(deckStats: DeckStat[]): DeckGroup[] {
  const map = new Map<string, DeckGroup>();

  for (const stat of deckStats) {
    const key = stat.deck.groupName?.trim() || "__ungrouped__";
    const label = stat.deck.groupName?.trim() || "Chưa xếp nhóm";
    const existing = map.get(key);

    if (existing) {
      existing.items.push(stat);
      existing.total += stat.total;
      existing.due += stat.due;
    } else {
      map.set(key, {
        key,
        name: stat.deck.groupName?.trim() || null,
        label,
        items: [stat],
        total: stat.total,
        due: stat.due,
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    if (!a.name) return 1;
    if (!b.name) return -1;
    return a.label.localeCompare(b.label, "vi", { numeric: true });
  });
}
