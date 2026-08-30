"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { updateDeck, deleteDeck } from "@/lib/repo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Deck, DeckGroup as IDeckGroup } from "@/lib/types";

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

export function DeckGroupsList({ deckStats, deckGroups = [] }: { deckStats: DeckStat[], deckGroups?: IDeckGroup[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftGroup, setDraftGroup] = useState("");
  const [draftName, setDraftName] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [priorityIds, setPriorityIds] = useState<Set<string>>(
    () => new Set(deckStats.filter(({ deck }) => deck.isPriority).map(({ deck }) => deck.id)),
  );

  const groups = useMemo(() => groupDecks(deckStats), [deckStats]);

  function beginEdit(deck: Deck) {
    setErr(null);
    setEditingId(deck.id);
    setDraftGroup(deck.groupName ?? "");
    setDraftName(deck.name ?? "");
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

  function saveDeck(deckId: string) {
    setErr(null);
    start(async () => {
      try {
        const sb = createSupabaseBrowserClient();
        await updateDeck(sb, deckId, { name: draftName, groupName: draftGroup });
        setEditingId(null);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Không lưu được thay đổi");
      }
    });
  }

  function handleDelete(deckId: string) {
    if (!confirm("Bạn có chắc chắn muốn xóa bộ thẻ này không? Tất cả thẻ bên trong cũng sẽ bị xóa!")) return;
    setErr(null);
    start(async () => {
      try {
        const sb = createSupabaseBrowserClient();
        await deleteDeck(sb, deckId);
        if (editingId === deckId) setEditingId(null);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Không xóa được bộ thẻ");
      }
    });
  }

  function togglePriority(deck: Deck) {
    const nextPriority = !priorityIds.has(deck.id);
    setPriorityIds((current) => {
      const next = new Set(current);
      if (nextPriority) next.add(deck.id);
      else next.delete(deck.id);
      return next;
    });
    setErr(null);
    start(async () => {
      try {
        const sb = createSupabaseBrowserClient();
        await updateDeck(sb, deck.id, { isPriority: nextPriority });
        router.refresh();
      } catch (error) {
        setPriorityIds((current) => {
          const next = new Set(current);
          if (nextPriority) next.delete(deck.id);
          else next.add(deck.id);
          return next;
        });
        setErr(error instanceof Error ? error.message : "Không cập nhật được ưu tiên");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
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
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <button
                          type="button"
                          onClick={() => togglePriority(deck)}
                          disabled={pending}
                          aria-pressed={priorityIds.has(deck.id)}
                          aria-label={priorityIds.has(deck.id) ? `Bỏ ưu tiên ${deck.name}` : `Ưu tiên ${deck.name}`}
                          className={
                            "tap flex shrink-0 items-center justify-center rounded-xl text-xl active:scale-90 " +
                            (priorityIds.has(deck.id)
                              ? "bg-[var(--color-warn-soft)] text-[var(--color-warn)]"
                              : "text-[var(--color-ink-muted)]")
                          }
                        >
                          {priorityIds.has(deck.id) ? "★" : "☆"}
                        </button>
                        <Link
                          href={`/decks/${deck.id}`}
                          className="min-w-0 flex-1 py-1"
                        >
                          <p className="break-words font-semibold">{deck.name}</p>
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
                      </div>

                      <div className="flex flex-col gap-2 sm:w-64">
                        <div className="grid grid-cols-2 gap-2">
                          <Link
                            href={`/decks/${deck.id}`}
                            className="rounded-full border border-[var(--color-line)] px-4 py-2 text-center text-sm font-medium transition-colors hover:border-[var(--color-accent)]"
                          >
                            Mở bộ
                          </Link>
                          <Link
                            href={`/study/daily?deckId=${deck.id}`}
                            className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-center text-sm font-medium text-[var(--color-accent-ink)]"
                          >
                            Học 10 phút
                          </Link>
                        </div>

                        {editingId === deck.id ? (
                          <div className="flex flex-col gap-2">
                            <input
                              autoFocus
                              value={draftName}
                              onChange={(e) => setDraftName(e.target.value)}
                              placeholder="Tên bộ thẻ"
                              className="w-full min-w-0 rounded-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                            />
                            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                              <select
                                value={draftGroup}
                                onChange={(e) => setDraftGroup(e.target.value)}
                                className="min-w-0 rounded-full border border-[var(--color-line)] bg-[var(--color-bg-elev)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                              >
                                <option value="">-- Không nhóm --</option>
                                {deckGroups.map(g => (
                                  <option key={g.id} value={g.name}>{g.name}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => saveDeck(deck.id)}
                                className="rounded-full bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-[var(--color-accent-ink)] disabled:opacity-50"
                              >
                                Lưu
                              </button>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => handleDelete(deck.id)}
                                className="rounded-full border border-[var(--color-bad)] px-3 py-2 text-sm font-medium text-[var(--color-bad)] transition-colors hover:bg-[var(--color-bad)] hover:text-white disabled:opacity-50"
                              >
                                Xóa
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => beginEdit(deck)}
                            className="rounded-full border border-dashed border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                          >
                            Sửa
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
