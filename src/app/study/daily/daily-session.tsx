"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildDailyQueue,
  buildFocusLoop,
  buildFocusQueue,
  claimFirstSessionGrade,
  insertFocusRetry,
  type DailyQueueItem,
  type FocusQueueItem,
} from "@/lib/daily-study";
import { insertReviewLog, updateCardSrs } from "@/lib/repo";
import { type FrontSide, useStudySettings } from "@/lib/settings";
import { gradeCard } from "@/lib/srs";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { speak, stopSpeaking, unlock } from "@/lib/tts";
import type { Card, Deck, Rating } from "@/lib/types";
import { RATING } from "@/lib/types";
import { SettingsPanel } from "../[deckId]/settings-panel";

const SESSION_SECONDS = 10 * 60;

interface Props {
  initialCards: Card[];
  decks: Deck[];
  selectedDeckId?: string;
}

interface SessionStats {
  remembered: number;
  difficult: number;
  forgotten: number;
}

export function DailySession({ initialCards, decks, selectedDeckId }: Props) {
  const [settings, updateSettings] = useStudySettings();
  const isFocusSession = Boolean(selectedDeckId);
  const initialQueue = useMemo(
    () =>
      isFocusSession
        ? buildFocusQueue(initialCards)
        : buildDailyQueue(initialCards, decks),
    [decks, initialCards, isFocusSession],
  );
  const [queue, setQueue] = useState<(DailyQueueItem | FocusQueueItem)[]>(
    initialQueue,
  );
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(SESSION_SECONDS);
  const [started, setStarted] = useState(false);
  const [timeReached, setTimeReached] = useState(false);
  const [finished, setFinished] = useState(false);
  const [uniqueSeen, setUniqueSeen] = useState(0);
  const [saving, setSaving] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const [stats, setStats] = useState<SessionStats>({
    remembered: 0,
    difficult: 0,
    forgotten: 0,
  });
  const writeChain = useRef<Promise<void>>(Promise.resolve());
  const gradedCardIds = useRef(new Set<string>());
  const seenCardIds = useRef(new Set<string>());
  const weakCardIds = useRef(new Set<string>());
  const latestCards = useRef(
    new Map(initialCards.map((card) => [card.id, card])),
  );
  const cycle = useRef(1);
  const current = queue[index];

  useEffect(() => {
    if (!started || finished || timeReached) return;
    const timer = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finished, started, timeReached]);

  function persist(card: Card, rating: Rating) {
    const sb = createSupabaseBrowserClient();
    const result = gradeCard(card, rating, "daily");
    setSaving((value) => value + 1);
    writeChain.current = writeChain.current
      .then(async () => {
        await updateCardSrs(sb, result.card);
        await insertReviewLog(sb, result.log);
      })
      .catch((error) => {
        console.error(error);
        setSaveError(true);
      })
      .finally(() => setSaving((value) => Math.max(0, value - 1)));
    return result.card;
  }

  function onGrade(rating: Rating) {
    if (!current) return;
    let updatedCard = current.card;
    const shouldPersist =
      !isFocusSession ||
      claimFirstSessionGrade(gradedCardIds.current, current.card.id);
    if (shouldPersist) {
      updatedCard = persist(current.card, rating);
      latestCards.current.set(current.card.id, updatedCard);
    }
    if (!seenCardIds.current.has(current.card.id)) {
      seenCardIds.current.add(current.card.id);
      setUniqueSeen(seenCardIds.current.size);
    }
    if (rating <= RATING.HARD) weakCardIds.current.add(current.card.id);
    else weakCardIds.current.delete(current.card.id);

    setStats((value) => ({
      remembered: value.remembered + (rating >= RATING.GOOD ? 1 : 0),
      difficult: value.difficult + (rating === RATING.HARD ? 1 : 0),
      forgotten: value.forgotten + (rating === RATING.AGAIN ? 1 : 0),
    }));

    let nextQueue = queue;
    if (isFocusSession && isFocusQueueItem(current)) {
      nextQueue = insertFocusRetry(
        queue as FocusQueueItem[],
        index,
        rating,
        updatedCard,
      );
    } else if (rating <= RATING.HARD && current.attempt < 1) {
      const retry: DailyQueueItem = {
        card: updatedCard,
        task: current.task === "listen" ? "recall" : "write",
        attempt: current.attempt + 1,
      };
      const insertionIndex = Math.min(index + 4, queue.length);
      nextQueue = [
        ...queue.slice(0, insertionIndex),
        retry,
        ...queue.slice(insertionIndex),
      ];
    }

    let nextIndex = index + 1;
    if (isFocusSession && nextIndex >= nextQueue.length) {
      cycle.current += 1;
      const currentCards = initialCards.map(
        (card) => latestCards.current.get(card.id) ?? card,
      );
      const shuffledCards = shuffleCards(currentCards);
      const refill = buildFocusLoop(
        shuffledCards,
        weakCardIds.current,
        cycle.current,
      );
      nextQueue = [...nextQueue, ...refill];
    }
    if (nextQueue !== queue) setQueue(nextQueue);

    if (remaining === 0 && isFocusSession) {
      setIndex(nextIndex);
      setTimeReached(true);
    } else if (remaining === 0 || nextIndex >= nextQueue.length) {
      setFinished(true);
    } else {
      setIndex(nextIndex);
    }
  }

  if (finished) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--color-good-soft)] text-3xl">
          ✓
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {isFocusSession ? "Đã kết thúc phiên luyện" : "Hoàn thành phiên hôm nay"}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            Bạn đã luyện {stats.remembered + stats.difficult + stats.forgotten}{" "}
            lượt · {uniqueSeen} thẻ khác nhau.
          </p>
        </div>
        <div className="grid w-full max-w-sm grid-cols-3 gap-2">
          <SummaryStat value={stats.remembered} label="Nhớ được" tone="good" />
          <SummaryStat value={stats.difficult} label="Gần nhớ" tone="warn" />
          <SummaryStat value={stats.forgotten} label="Cần học lại" tone="bad" />
        </div>
        {saving > 0 && (
          <p className="text-xs text-[var(--color-ink-muted)]">Đang lưu tiến độ…</p>
        )}
        {saveError && (
          <p className="rounded-2xl bg-[var(--color-bad-soft)] px-4 py-3 text-sm text-[var(--color-bad)]">
            Một phần tiến độ chưa lưu được. Hãy giữ mạng và thử học lại thẻ đó sau.
          </p>
        )}
        {saving > 0 ? (
          <button
            type="button"
            disabled
            className="tap mt-2 w-full max-w-sm rounded-2xl bg-[var(--color-accent)] px-5 font-semibold text-[var(--color-accent-ink)] opacity-60"
          >
            Đang hoàn tất lưu…
          </button>
        ) : (
          <Link
            href="/decks"
            className="tap mt-2 inline-flex w-full max-w-sm items-center justify-center rounded-2xl bg-[var(--color-accent)] px-5 font-semibold text-[var(--color-accent-ink)]"
          >
            Về trang hôm nay
          </Link>
        )}
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <span className="text-5xl">🌿</span>
        <div>
          <h1 className="text-xl font-bold">
            {isFocusSession ? "Bộ này chưa có thẻ" : "Bạn đã ôn đủ rồi"}
          </h1>
          <p className="mt-2 max-w-xs text-sm text-[var(--color-ink-muted)]">
            {isFocusSession
              ? "Hãy thêm từ hoặc cụm từ trước khi bắt đầu phiên tập trung."
              : "Chưa có thẻ nào đến hạn. Bạn có thể thêm từ mới hoặc luyện thêm một bộ."}
          </p>
        </div>
        <Link
          href="/decks"
          className="tap inline-flex items-center rounded-2xl bg-[var(--color-accent)] px-5 font-semibold text-[var(--color-accent-ink)]"
        >
          Xem các bộ thẻ
        </Link>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex justify-end">
          <SettingsPanel settings={settings} onChange={updateSettings} />
        </div>
        <SessionSetup
          frontSide={settings.frontSide}
          isFocusSession={isFocusSession}
          cardCount={initialCards.length}
          onDirectionChange={(frontSide) => updateSettings({ frontSide })}
          onStart={() => {
            unlock();
            setStarted(true);
          }}
        />
      </div>
    );
  }

  if (timeReached) {
    return (
      <TimeMilestone
        uniqueSeen={uniqueSeen}
        turns={stats.remembered + stats.difficult + stats.forgotten}
        saving={saving}
        onContinue={() => {
          setRemaining(SESSION_SECONDS);
          setTimeReached(false);
        }}
        onFinish={() => setFinished(true)}
      />
    );
  }

  const completed = isFocusSession ? uniqueSeen : index;
  const estimatedTotal = isFocusSession
    ? initialCards.length
    : Math.max(queue.length, completed + 1);
  const focusItem = isFocusQueueItem(current) ? current : null;
  const totalGroups = Math.max(1, Math.ceil(initialCards.length / 5));
  const progressLabel = focusItem
    ? focusItem.cycle === 1
      ? `Nhóm ${Math.min(focusItem.batchIndex + 1, totalGroups)}/${totalGroups}`
      : focusItem.phase === "weak"
        ? "Ôn thẻ yếu"
        : `Vòng luyện ${focusItem.cycle}`
    : undefined;
  return (
    <div className="flex flex-1 flex-col gap-4">
      <SessionProgress
        completed={completed}
        total={estimatedTotal}
        remaining={remaining}
        saving={saving}
        label={progressLabel}
      />
      <div className="flex items-center justify-end gap-2">
        <DirectionSwitch
          frontSide={settings.frontSide}
          onChange={(frontSide) => updateSettings({ frontSide })}
        />
        <SettingsPanel settings={settings} onChange={updateSettings} />
      </div>
      {saveError && (
        <p className="rounded-xl bg-[var(--color-bad-soft)] px-3 py-2 text-xs text-[var(--color-bad)]">
          Mạng không ổn định — bạn vẫn có thể tiếp tục học.
        </p>
      )}
      <DailyPrompt
        key={`${current.card.id}:${current.attempt}:${focusItem?.cycle ?? 1}:${settings.frontSide}`}
        item={current}
        frontSide={settings.frontSide}
        autoPlay={settings.autoPlay}
        speechRate={settings.speechRate}
        voiceURI={settings.voiceURI}
        deckName={decks.find((deck) => deck.id === current.card.deckId)?.name}
        onGrade={onGrade}
      />
    </div>
  );
}

function DailyPrompt({
  item,
  frontSide,
  autoPlay,
  speechRate,
  voiceURI,
  deckName,
  onGrade,
}: {
  item: DailyQueueItem;
  frontSide: FrontSide;
  autoPlay: boolean;
  speechRate: number;
  voiceURI: string | null;
  deckName?: string;
  onGrade: (rating: Rating) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const frontIsEnglish = frontSide === "term";
  const frontText = frontIsEnglish ? item.card.term : item.card.definition;
  const backText = frontIsEnglish ? item.card.definition : item.card.term;

  useEffect(() => {
    const englishVisible = frontIsEnglish ? !revealed : revealed;
    if (autoPlay && englishVisible) {
      speak(item.card.term, speechRate, voiceURI);
    }
    return stopSpeaking;
  }, [
    autoPlay,
    frontIsEnglish,
    item.card.id,
    item.card.term,
    revealed,
    speechRate,
    voiceURI,
  ]);

  function playTerm() {
    unlock();
    speak(item.card.term, speechRate, voiceURI);
  }

  return (
    <StudyCard
      eyebrow={revealed ? "Mặt sau" : `Mặt trước · ${frontIsEnglish ? "Tiếng Anh" : "Tiếng Việt"}`}
      deckName={deckName}
    >
      {!revealed ? (
        <>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
              {frontIsEnglish ? "Hãy nhớ nghĩa tiếng Việt" : "Hãy nhớ từ tiếng Anh"}
            </p>
            <h1 className="mt-4 break-words text-3xl font-bold leading-snug sm:text-4xl">
              {frontText}
            </h1>
            {frontIsEnglish && item.card.pronunciation && (
              <p className="mt-2 text-base text-[var(--color-ink-muted)]">
                /{item.card.pronunciation}/
              </p>
            )}
            {frontIsEnglish && (
              <button
                type="button"
                onClick={playTerm}
                className="tap mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] px-4 text-sm font-semibold"
              >
                🔊 Nghe phát âm
              </button>
            )}
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-[var(--color-ink-muted)]">
              Tự trả lời trong đầu hoặc nói thành tiếng, rồi mới lật thẻ.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="tap w-full rounded-2xl bg-[var(--color-accent)] px-5 font-semibold text-[var(--color-accent-ink)]"
          >
            Lật thẻ · xem {frontIsEnglish ? "nghĩa Việt" : "tiếng Anh"}
          </button>
        </>
      ) : (
        <>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
              {frontIsEnglish ? "Tiếng Việt" : "Tiếng Anh"}
            </p>
            <div className="flex max-w-full items-center justify-center gap-3">
              <h1 className="break-words text-3xl font-bold leading-tight sm:text-5xl">
                {backText}
              </h1>
              {!frontIsEnglish && (
                <button
                  type="button"
                  onClick={playTerm}
                  className="tap shrink-0 rounded-full border border-[var(--color-line)] text-xl"
                  aria-label="Nghe phát âm tiếng Anh"
                >
                  🔊
                </button>
              )}
            </div>
            {!frontIsEnglish && item.card.pronunciation && (
              <p className="text-base text-[var(--color-ink-muted)]">
                /{item.card.pronunciation}/
              </p>
            )}
            <div className="w-full rounded-2xl bg-[var(--color-bg)] px-4 py-3 text-sm">
              <span className="font-semibold">{item.card.term}</span>
              <span className="mx-2 text-[var(--color-ink-muted)]">→</span>
              <span className="text-[var(--color-ink-muted)]">{item.card.definition}</span>
            </div>
            {item.card.example && (
              <p className="w-full rounded-2xl border border-[var(--color-line)] px-4 py-3 text-left text-sm leading-relaxed text-[var(--color-ink-muted)]">
                “{item.card.example}”
              </p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <GradeButton label="Chưa nhớ" tone="bad" onClick={() => onGrade(RATING.AGAIN)} />
            <GradeButton label="Gần nhớ" tone="warn" onClick={() => onGrade(RATING.HARD)} />
            <GradeButton label="Nhớ được" tone="good" onClick={() => onGrade(RATING.GOOD)} />
          </div>
        </>
      )}
    </StudyCard>
  );
}

function SessionSetup({
  frontSide,
  isFocusSession,
  cardCount,
  onDirectionChange,
  onStart,
}: {
  frontSide: FrontSide;
  isFocusSession: boolean;
  cardCount: number;
  onDirectionChange: (frontSide: FrontSide) => void;
  onStart: () => void;
}) {
  return (
    <StudyCard eyebrow="Phiên flashcard 10 phút">
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">Bạn muốn xem mặt nào trước?</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--color-ink-muted)]">
            {isFocusSession
              ? `${cardCount} thẻ sẽ tự chạy theo từng nhóm 5. Thẻ yếu được ôn lại rồi ứng dụng tự chuyển sang nhóm tiếp theo.`
              : "Mỗi thẻ chỉ hiện một mặt. Bạn tự nhớ, lật xem đáp án rồi chấm mức độ nhớ."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Chọn mặt trước flashcard">
          <DirectionChoice
            selected={frontSide === "term"}
            title="English → Tiếng Việt"
            example="recommend → khuyên"
            onClick={() => onDirectionChange("term")}
          />
          <DirectionChoice
            selected={frontSide === "definition"}
            title="Tiếng Việt → English"
            example="khuyên → recommend"
            onClick={() => onDirectionChange("definition")}
          />
        </div>

        <div className="rounded-2xl bg-[var(--color-accent-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--color-accent)]">
          Mẹo: bắt đầu với Anh → Việt để nhận mặt chữ, sau đó đổi sang Việt → Anh để luyện nói và nhớ chủ động.
        </div>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="tap w-full rounded-2xl bg-[var(--color-accent)] px-5 font-semibold text-[var(--color-accent-ink)]"
      >
        Bắt đầu 10 phút
      </button>
    </StudyCard>
  );
}

function DirectionChoice({
  selected,
  title,
  example,
  onClick,
}: {
  selected: boolean;
  title: string;
  example: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`tap min-h-24 rounded-2xl border-2 p-4 text-left transition-colors ${
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
          : "border-[var(--color-line)] bg-[var(--color-bg)]"
      }`}
    >
      <span className="flex items-center justify-between gap-2 font-semibold">
        {title}
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
            selected
              ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
              : "border-[var(--color-line)]"
          }`}
          aria-hidden
        >
          {selected ? "✓" : ""}
        </span>
      </span>
      <span className="mt-2 block text-sm text-[var(--color-ink-muted)]">{example}</span>
    </button>
  );
}

function DirectionSwitch({
  frontSide,
  onChange,
}: {
  frontSide: FrontSide;
  onChange: (frontSide: FrontSide) => void;
}) {
  const frontIsEnglish = frontSide === "term";
  return (
    <button
      type="button"
      onClick={() => onChange(frontIsEnglish ? "definition" : "term")}
      className="tap inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-bg-elev)] px-3 text-xs font-semibold text-[var(--color-ink-muted)]"
      aria-label={`Đổi sang ${frontIsEnglish ? "tiếng Việt trước" : "tiếng Anh trước"}`}
    >
      <span>{frontIsEnglish ? "EN → VI" : "VI → EN"}</span>
      <span aria-hidden>⇄</span>
    </button>
  );
}

function StudyCard({
  eyebrow,
  deckName,
  tone,
  children,
}: {
  eyebrow: string;
  deckName?: string;
  tone?: "correct" | "wrong";
  children: React.ReactNode;
}) {
  return (
    <section className="daily-card flex min-h-[calc(100dvh-8.5rem)] flex-1 flex-col gap-5 rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-bg-elev)] p-5 sm:min-h-[34rem] sm:p-7">
      <header className="flex items-center justify-between gap-3 text-xs">
        <span
          className={
            "font-semibold uppercase tracking-[0.16em] " +
            (tone === "correct"
              ? "text-[var(--color-good)]"
              : tone === "wrong"
                ? "text-[var(--color-bad)]"
                : "text-[var(--color-accent)]")
          }
        >
          {eyebrow}
        </span>
        {deckName && (
          <span className="max-w-[50%] truncate text-[var(--color-ink-muted)]">
            {deckName}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function SessionProgress({
  completed,
  total,
  remaining,
  saving,
  label,
}: {
  completed: number;
  total: number;
  remaining: number;
  saving: number;
  label?: string;
}) {
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = Math.min(100, (completed / Math.max(1, total)) * 100);
  return (
    <div className="flex items-center gap-3">
      {label && (
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
          {label}
        </span>
      )}
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-line)]">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="shrink-0 font-mono text-xs text-[var(--color-ink-muted)]">
        {minutes}:{String(seconds).padStart(2, "0")}
      </span>
      <span className="sr-only" aria-live="polite">
        {saving > 0 ? "Đang lưu tiến độ" : "Đã lưu tiến độ"}
      </span>
    </div>
  );
}

function TimeMilestone({
  uniqueSeen,
  turns,
  saving,
  onContinue,
  onFinish,
}: {
  uniqueSeen: number;
  turns: number;
  saving: number;
  onContinue: () => void;
  onFinish: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--color-accent-soft)] text-3xl">
        ⏱
      </div>
      <div>
        <h1 className="text-2xl font-bold">Bạn đã học đủ 10 phút</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          {uniqueSeen} thẻ khác nhau · {turns} lượt luyện. Hàng đợi hiện tại vẫn
          được giữ nguyên.
        </p>
      </div>
      {saving > 0 && (
        <p className="text-xs text-[var(--color-ink-muted)]">
          Đang lưu {saving} thay đổi…
        </p>
      )}
      <div className="grid w-full max-w-sm gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="tap rounded-2xl bg-[var(--color-accent)] px-5 font-semibold text-[var(--color-accent-ink)]"
        >
          Luyện thêm 10 phút
        </button>
        <button
          type="button"
          onClick={onFinish}
          disabled={saving > 0}
          className="tap rounded-2xl border border-[var(--color-line)] px-5 font-semibold disabled:opacity-50"
        >
          {saving > 0 ? "Đang hoàn tất lưu…" : "Kết thúc phiên"}
        </button>
      </div>
    </div>
  );
}

function isFocusQueueItem(
  item: DailyQueueItem | FocusQueueItem,
): item is FocusQueueItem {
  return "phase" in item;
}

function shuffleCards(cards: Card[]): Card[] {
  const result = [...cards];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function GradeButton({
  label,
  tone,
  onClick,
}: {
  label: string;
  tone: "bad" | "warn" | "good";
  onClick: () => void;
}) {
  const toneClass = {
    bad: "bg-[var(--color-bad-soft)] text-[var(--color-bad)]",
    warn: "bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
    good: "bg-[var(--color-good-soft)] text-[var(--color-good)]",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap rounded-2xl px-2 text-sm font-semibold active:scale-95 ${toneClass}`}
    >
      {label}
    </button>
  );
}

function SummaryStat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "bad" | "warn" | "good";
}) {
  const toneClass = {
    bad: "bg-[var(--color-bad-soft)] text-[var(--color-bad)]",
    warn: "bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
    good: "bg-[var(--color-good-soft)] text-[var(--color-good)]",
  }[tone];
  return (
    <div className={`rounded-2xl p-3 ${toneClass}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-[10px] opacity-75">{label}</p>
    </div>
  );
}
