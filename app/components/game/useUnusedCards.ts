"use client";

import { useEffect, useMemo, useRef } from "react";
import type { GameJudge } from "../../types/GameJudge";
import { CardInfo, GameJudgeState } from "../../types/GameTypes";
import { CharacterId, GlobalData, MusicSelectionMap } from "../../types/Configs";
import { collectCardKeys, collectCharacterIds, computeUnusedCardsList } from "../../lib/unusedCards";

/**
 * The pile of cards that are not part of the current lineup.
 *
 * The result is what the board positions and what the "unused cards" caption counts, so it has to
 * be stable while cards leave the pile (hence the baseline). Both the baseline and the list are
 * owned here instead of being published state, and the memo depends on `judgeVersion` because the
 * judge is a mutable model.
 */
export function useUnusedCards(options: {
  data: GlobalData;
  musicSelection: MusicSelectionMap;
  playingOrder: Array<CharacterId>;
  judge: GameJudge;
  judgeVersion: number;
  /** The card being dragged, if any: its siblings belong to the pile while the drag lasts. */
  draggedCard: CardInfo | null;
}): Array<CardInfo> {
  const { data, musicSelection, playingOrder, judge, judgeVersion, draggedCard } = options;
  // The previous result, kept only so cards already in the pile hold their place while another
  // one (typically the card being dragged out of a deck) joins it.
  const baselineRef = useRef<Array<CardInfo>>([]);

  const unusedCards = useMemo(() => {
    const deckCards = judge.players.flatMap((player) => player.deck);
    const collectedCards = judge.players.flatMap((player) => player.collected);
    return computeUnusedCardsList({
      characterConfigs: data.characterConfigs,
      playingOrder,
      musicSelection,
      isGameplay: judge.state !== GameJudgeState.SelectingCards,
      cardInsideDeck: collectCardKeys(deckCards),
      cardInsideCollected: collectCardKeys(collectedCards),
      characterInsideDeck: collectCharacterIds(deckCards),
      draggedCard,
      baseline: baselineRef.current,
    });
    // `judge` is a mutable model: judgeVersion is the dependency that actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, musicSelection, playingOrder, judgeVersion, draggedCard]);

  useEffect(() => {
    baselineRef.current = unusedCards;
  }, [unusedCards]);

  return unusedCards;
}
