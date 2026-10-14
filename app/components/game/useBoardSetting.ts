"use client";

import { useCallback, useEffect, useState } from "react";
import type { GameJudge } from "../../types/GameJudge";
import {
  DefaultCardWidthPercentage, clampCardWidthPercentage,
} from "../../lib/geometry";
import { loadGameSetting, saveGameSetting } from "../../lib/persistence";

/** How much one press of the smaller/larger button changes the card width. */
const CardWidthStep = 0.01;

export type BoardSetting = {
  cardWidthPercentage: number;
  cardSmaller: () => void;
  cardLarger: () => void;
};

/**
 * The persisted board shape: card width plus the deck size that lives on the judge. Restoring and
 * saving them belongs together, and keeping the pair out of the session hook leaves that hook to
 * deal with match state only.
 */
export function useBoardSetting(judge: GameJudge, markJudgeChanged: () => void): BoardSetting {
  const [cardWidthPercentage, setCardWidthPercentage] = useState<number>(DefaultCardWidthPercentage);
  // False until the stored shape has been applied. The persist effect must not run before that:
  // it would write the pre-restore defaults over the stored setting, and the mount effect would
  // then read that clobbered value back.
  const [restored, setRestored] = useState<boolean>(false);

  const cardSmaller = useCallback(() => {
    setCardWidthPercentage((current) => clampCardWidthPercentage(current - CardWidthStep, judge.deckColumns));
  }, [judge]);

  const cardLarger = useCallback(() => {
    setCardWidthPercentage((current) => clampCardWidthPercentage(current + CardWidthStep, judge.deckColumns));
  }, [judge]);

  const refitCardWidth = useCallback(() => {
    setCardWidthPercentage((current) => clampCardWidthPercentage(current, judge.deckColumns));
  }, [judge]);

  // The deck can be resized from the outside too - a peer sends its deck size over `syncSettings`,
  // and a reconnecting client applies it in a sync payload - so the cards follow the judge's column
  // count wherever the change came from.
  useEffect(() => {
    refitCardWidth();
  }, [judge.deckColumns, refitCardWidth]);

  // restore the saved board shape on first mount
  useEffect(() => {
    const stored = loadGameSetting();
    if (stored) {
      if (typeof stored.cardWidthPercentage === "number") {
        // the saved width was chosen for the saved deck size, which may be wider than this build allows
        setCardWidthPercentage(
          clampCardWidthPercentage(stored.cardWidthPercentage, stored.deckColumns ?? judge.deckColumns),
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
    }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist once the stored shape has been restored, skipping the defaults so "unset" stays
  // distinguishable
  useEffect(() => {
    if (!restored) { return; }
    saveGameSetting({
      cardWidthPercentage,
      deckRows: judge.deckRows,
      deckColumns: judge.deckColumns,
    });
  }, [restored, cardWidthPercentage, judge.deckRows, judge.deckColumns]);

  return { cardWidthPercentage, cardSmaller, cardLarger };
}
