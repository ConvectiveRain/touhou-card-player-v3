"use client";

import { useCallback, useEffect, useState } from "react";
import type { GameJudge } from "../../types/GameJudge";
import {
  CardWidthPercentageMax, CardWidthPercentageMin, DefaultCardWidthPercentage,
  maxCardWidthPercentageForDeck,
} from "../../lib/geometry";
import { clamp } from "../../lib/math";
import { loadGameSetting, saveGameSetting } from "../../lib/persistence";

/** How much one press of the smaller/larger button changes the card width. */
const CardWidthStep = 0.01;

/**
 * Applies both limits to a card width: the user-settable range, and the narrower range a wide
 * deck leaves, so that the whole row still fits in the canvas.
 */
function clampCardWidth(percentage: number, deckColumns: number): number {
  return Math.min(
    clamp(percentage, CardWidthPercentageMin, CardWidthPercentageMax),
    maxCardWidthPercentageForDeck(deckColumns),
  );
}

export type BoardSetting = {
  cardWidthPercentage: number;
  cardSmaller: () => void;
  cardLarger: () => void;
  /** Re-applies the deck-width limit after the deck gained a column. */
  refitCardWidth: () => void;
};

/**
 * The persisted board shape: card width plus the deck size that lives on the judge. Restoring and
 * saving them belongs together, and keeping the pair out of the session hook leaves that hook to
 * deal with match state only.
 */
export function useBoardSetting(judge: GameJudge, markJudgeChanged: () => void): BoardSetting {
  const [cardWidthPercentage, setCardWidthPercentage] = useState<number>(DefaultCardWidthPercentage);

  const cardSmaller = useCallback(() => {
    setCardWidthPercentage((current) => clampCardWidth(current - CardWidthStep, judge.deckColumns));
  }, [judge]);

  const cardLarger = useCallback(() => {
    setCardWidthPercentage((current) => clampCardWidth(current + CardWidthStep, judge.deckColumns));
  }, [judge]);

  const refitCardWidth = useCallback(() => {
    setCardWidthPercentage((current) => clampCardWidth(current, judge.deckColumns));
  }, [judge]);

  // restore the saved board shape on first mount
  useEffect(() => {
    const stored = loadGameSetting();
    if (!stored) { return; }
    if (typeof stored.cardWidthPercentage === "number") {
      // the saved width was chosen for the saved deck size, which may be wider than this build allows
      setCardWidthPercentage(
        clampCardWidth(stored.cardWidthPercentage, stored.deckColumns ?? judge.deckColumns),
      );
    }
    if (typeof stored.deckRows === "number") {
      judge.deckRows = stored.deckRows;
    }
    if (typeof stored.deckColumns === "number") {
      judge.deckColumns = stored.deckColumns;
    }
    judge.adjustDeckSize(judge.deckRows, judge.deckColumns, { send: false, except: null });
    markJudgeChanged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist, skipping the defaults so "unset" stays distinguishable
  useEffect(() => {
    saveGameSetting({
      cardWidthPercentage,
      deckRows: judge.deckRows,
      deckColumns: judge.deckColumns,
    });
  }, [cardWidthPercentage, judge.deckRows, judge.deckColumns]);

  return { cardWidthPercentage, cardSmaller, cardLarger, refitCardWidth };
}
