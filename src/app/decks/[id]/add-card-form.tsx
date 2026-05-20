"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createCard } from "@/lib/repo";

export function AddCardForm({ deckId }: { deckId: string }) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [def, setDef] = useState("");
  const [example, setExample] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      try {
        const sb = createSupabaseBrowserClient();
        await createCard(sb, {
          deckId,
          term: term.trim(),
          definition: def.trim(),
          example: example.trim() || undefined,
        });
        setTerm("");
        setDef("");
        setExample("");
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Lỗi khi thêm thẻ");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-4 sm:grid-cols-[1fr_1fr_auto]"
    >
      <input
        required
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="English term"
        className="rounded-xl border border-[var(--color-line)] bg-transparent px-3 py-2 outline-none focus:border-[var(--color-accent)]"
      />
      <input
        required
        value={def}
        onChange={(e) => setDef(e.target.value)}
        placeholder="Nghĩa tiếng Việt"
        className="rounded-xl border border-[var(--color-line)] bg-transparent px-3 py-2 outline-none focus:border-[var(--color-accent)]"
      />
      <button
        type="submit"
        disabled={pending || !term || !def}
        className="tap rounded-full bg-[var(--color-accent)] px-5 font-medium text-[var(--color-accent-ink)] disabled:opacity-50"
      >
        {pending ? "..." : "+ Thêm"}
      </button>
      <input
        value={example}
        onChange={(e) => setExample(e.target.value)}
        placeholder="Ví dụ câu (tùy chọn)"
        className="rounded-xl border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] sm:col-span-3"
      />
      {err && (
        <p className="text-sm text-[var(--color-bad)] sm:col-span-3">⚠ {err}</p>
      )}
    </form>
  );
}
