"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createDeck } from "@/lib/repo";

export function NewDeckForm({ groupNames = [] }: { groupNames?: string[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [groupName, setGroupName] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      try {
        const sb = createSupabaseBrowserClient();
        const deck = await createDeck(sb, {
          name: name.trim(),
          description: desc.trim() || undefined,
          groupName: groupName.trim() || undefined,
        });
        setName("");
        setDesc("");
        setGroupName("");
        setOpen(false);
        router.refresh();
        router.push(`/decks/${deck.id}`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Có lỗi xảy ra");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-dashed border-[var(--color-line)] px-5 py-3 font-medium text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        + Tạo bộ thẻ mới
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-4"
    >
      <input
        autoFocus
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tên bộ thẻ (vd: IELTS Advanced)"
        className="rounded-xl border border-[var(--color-line)] bg-transparent px-3 py-2 text-base outline-none focus:border-[var(--color-accent)]"
      />
      <input
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        list="new-deck-group-options"
        placeholder="Nhóm bài (vd: Bài 1)"
        className="rounded-xl border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
      />
      <datalist id="new-deck-group-options">
        {groupNames.map((group) => (
          <option key={group} value={group} />
        ))}
      </datalist>
      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Mô tả (tùy chọn)"
        className="rounded-xl border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
      />
      {err && <p className="text-sm text-[var(--color-bad)]">⚠ {err}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-full bg-[var(--color-accent)] px-4 py-2 font-medium text-[var(--color-accent-ink)] disabled:opacity-50"
        >
          {pending ? "Đang tạo..." : "Tạo"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-[var(--color-line)] px-4 py-2"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
