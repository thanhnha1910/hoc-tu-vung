import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

type Color =
  | "flash"
  | "learn"
  | "test"
  | "blocks"
  | "blast"
  | "match"
  | "review";

interface Props {
  href: Route | string;
  label: string;
  color: Color;
  icon: ReactNode;
  disabled?: boolean;
  badge?: string;
}

export function ModeTile({
  href,
  label,
  color,
  icon,
  disabled,
  badge,
}: Props) {
  const colorVar = `var(--color-mode-${color})`;
  const className =
    "group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border bg-[var(--color-bg-elev)] p-3 text-left transition-all hover:scale-[1.02] hover:bg-[var(--color-bg-elev-2)] active:scale-[0.98] sm:p-4";

  const inner = (
    <>
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white sm:h-11 sm:w-11"
        style={{ background: colorVar }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 break-words text-sm font-semibold leading-tight sm:text-base">
        {label}
      </span>
      {badge && (
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide sm:px-2 sm:text-[10px]"
          style={{
            background: `color-mix(in oklch, ${colorVar} 18%, transparent)`,
            color: colorVar,
          }}
        >
          {badge}
        </span>
      )}
    </>
  );

  if (disabled) {
    return (
      <div
        className={`${className} pointer-events-none opacity-50 grayscale`}
        style={{ borderColor: `color-mix(in oklch, ${colorVar} 35%, transparent)` }}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href as Route}
      className={className}
      style={{
        borderColor: `color-mix(in oklch, ${colorVar} 35%, transparent)`,
      }}
    >
      {inner}
    </Link>
  );
}

// ─── Icons (24×24, white stroke, line style — Quizlet-ish) ───

export const FlashIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="6" width="14" height="14" rx="2" />
    <path d="M8 3h12a2 2 0 0 1 2 2v12" />
  </svg>
);

export const LearnIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 1 0 18" strokeDasharray="4 3" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
  </svg>
);

export const TestIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    <path d="M8 11h8M8 15h5" />
  </svg>
);

export const BlocksIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <rect x="3" y="3" width="6" height="6" rx="1" />
    <rect x="15" y="3" width="6" height="6" rx="1" />
    <rect x="3" y="15" width="6" height="6" rx="1" />
    <rect x="15" y="15" width="6" height="6" rx="1" />
  </svg>
);

export const BlastIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2c2.5 3 4 6 4 9a4 4 0 0 1-8 0c0-3 1.5-6 4-9z" />
    <path d="M8 16c-1.5 1-3 3-3 5h14c0-2-1.5-4-3-5" />
  </svg>
);

export const MatchIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="8" height="14" rx="1.5" />
    <rect x="13" y="5" width="8" height="14" rx="1.5" />
    <path d="M11 12h2" />
  </svg>
);

export const ReviewIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 11a8 8 0 1 0-2.34 5.66" />
    <path d="M20 5v6h-6" />
    <path d="M9 12l2 2 4-5" />
  </svg>
);
