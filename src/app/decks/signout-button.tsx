"use client";

export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="tap rounded-full border border-[var(--color-line)] px-4 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
      >
        Đăng xuất
      </button>
    </form>
  );
}
