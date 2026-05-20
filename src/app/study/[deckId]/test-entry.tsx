"use client";

import { useState } from "react";
import type { Card } from "@/lib/types";
import { TestConfig, type TestConfigValues } from "./test-config";
import { TestSession } from "./test-session";

interface Props {
  initialCards: Card[];
  deckId: string;
}

/**
 * Wraps the Kiểm tra flow: first show a config screen,
 * then run the quiz, then show results.
 */
export function TestEntry({ initialCards, deckId }: Props) {
  const [config, setConfig] = useState<TestConfigValues | null>(null);

  if (!config) {
    return (
      <TestConfig
        cards={initialCards}
        onStart={setConfig}
        deckId={deckId}
      />
    );
  }

  return (
    <TestSession
      cards={initialCards}
      config={config}
      deckId={deckId}
      onRestart={() => setConfig(null)}
    />
  );
}
