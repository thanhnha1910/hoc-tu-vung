"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createDeckGroup, deleteDeckGroup } from "@/lib/repo";
import type { DeckGroup } from "@/lib/types";

export function DeckGroupsManager({ groups }: { groups: DeckGroup[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    
    setErr(null);
    start(async () => {
      try {
        const sb = createSupabaseBrowserClient();
        await createDeckGroup(sb, name);
        setName("");
        router.refresh();
      } catch (error) {
        setErr(error instanceof Error ? error.message : "Có lỗi xảy ra");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Bạn có chắc chắn muốn xóa nhóm này? Các bộ thẻ trong nhóm này sẽ không bị xóa mà chỉ mất tên nhóm.")) return;
    
    setErr(null);
    start(async () => {
      try {
        const sb = createSupabaseBrowserClient();
        await deleteDeckGroup(sb, id);
        router.refresh();
      } catch (error) {
        setErr(error instanceof Error ? error.message : "Có lỗi xảy ra");
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
        Quản lý nhóm bài
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Quản lý Nhóm Bài</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
        >
          Đóng
        </button>
      </div>

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên nhóm mới (vd: Bài 1)"
          className="flex-1 rounded-xl border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-xl bg-[var(--color-accent)] px-4 py-2 font-medium text-[var(--color-accent-ink)] disabled:opacity-50"
        >
          Thêm
        </button>
      </form>

      {err && <p className="text-sm text-[var(--color-bad)]">⚠ {err}</p>}

      {groups.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Chưa có nhóm nào được tạo.</p>
      ) : (
        <ul className="flex flex-col gap-2 max-h-60 overflow-y-auto">
          {groups.map((group) => (
            <li
              key={group.id}
              className="flex items-center justify-between rounded-xl border border-[var(--color-line)] px-3 py-2"
            >
              <span className="text-sm font-medium">{group.name}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleDelete(group.id)}
                className="text-xs font-medium text-[var(--color-bad)] hover:underline disabled:opacity-50"
              >
                Xóa
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
