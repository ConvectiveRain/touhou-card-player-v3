import { CardInfo, GameJudgeState, MatchType } from "../../types/GameTypes";
import type { GameJudge } from "../../types/GameJudge";
import { CharacterId, GlobalData, MusicSelectionMap } from "../../types/Configs";
import { GetLocalizedString, Localization } from "../../types/Localization";
import { CardBackgroundState } from "../../lib/cardState";
import {
  BoardLayout, canvasPositionToDeckPosition, computeUnusedCardsStrip, getCardTransitionString,
  growCanvasHeight, mapDeckSide, toDeckCardPosition, unusedCardsStripMaxWidth,
} from "../../lib/geometry";
import type { UnusedCardsStrip } from "../../lib/geometry";
import type { CollectedPilesModel } from "./CollectedPiles";
import type { CardPlaceholderVisual, CardVisual } from "./CardLayer";
import type { DragInfo } from "./cardDrag";
import { canDropToOpponentDeck, dropDecksWhileSelecting } from "./cardDrag";

/**
 * The board's render pass. Given the current game state it decides where every card goes,
 * which slots are empty, which cards are selectable, and what the collected piles look
 * like. It is a pure function of its inputs (fresh collections are built on each call),
 * which makes the trickiest part of the board testable in isolation.
 */

export type SelectableCard = {
  cardInfo: CardInfo;
  x: number;
  y: number;
};

export type CardVisualsInput = {
  globalData: GlobalData;
  judge: GameJudge;
  layout: BoardLayout;
  musicSelection: MusicSelectionMap;
  currentCharacterId: CharacterId;
  /** Position of the card-selection slider, used to scroll the selectable row. */
  cardSelectionSliderValue: number;
  dragInfo: DragInfo | null;
  hoveringCardInfo: CardInfo | null;
  /** Result of the previous pass, kept as the stable ordering of the unused pile. */
  unusedCards: Array<CardInfo>;
  onCardHover: (cardInfo: CardInfo | null) => void;
  onDeckCardClick: (playerIndex: 0 | 1, cardIndex: number, cardInfo: CardInfo) => void;
};

export type CardVisuals = {
  cards: Map<string, CardVisual>;
  placeholders: Array<CardPlaceholderVisual>;
  selectableCards: Array<SelectableCard>;
  unusedStrip: UnusedCardsStrip;
  /** Horizontal space the unused pile claims, also used to lay out collected piles. */
  unusedStripMaxWidth: number;
  collectedModel: CollectedPilesModel;
  /** Key of the answer card while cheat mode is on, or null. */
  cheatCardKey: string | null;
  /** Canvas height including the room the unused pile needs. */
  canvasHeight: number;
};

const ObserverNamesWidth = 150;

export function buildCardVisuals(input: CardVisualsInput): CardVisuals {
  const {
    globalData, judge, layout, musicSelection, currentCharacterId,
    cardSelectionSliderValue, dragInfo, hoveringCardInfo, unusedCards,
    onCardHover, onDeckCardClick,
  } = input;

  const {
    cardWidth, cardHeight, deckWidth, deckLeft, canvasWidth, canvasSpacing, canvasMargin,
    cardSelectionOverlap,
  } = layout;

  const isMelee = judge.isMelee();
  const isCPU = judge.matchType === MatchType.CPU;
  const isNoOpponent = judge.matchType === MatchType.None;
  const isServerClientObserver = judge.isServerClientObserverMode();
  const isSelectingCards = judge.state === GameJudgeState.SelectingCards;

  const cards = new Map<string, CardVisual>();
  const placeholders: Array<CardPlaceholderVisual> = [];
  const naturalCardOrder: Array<CardInfo> = [];
  const cardInsideDeck = new Set<string>();
  const characterInsideDeck = new Set<CharacterId>();
  const cardInsideCollected = new Set<string>();

  globalData.characterConfigs.forEach((characterConfig, characterId) => {
    characterConfig.card.forEach((cardId, index) => {
      const cardInfo = new CardInfo(characterId, index);
      cards.set(cardInfo.toKey(), {
        cardInfoKey: cardInfo.toKey(),
        visible: false,
        x: 0,
        y: 0,
        zIndex: 0,
        width: `${cardWidth}px`,
        source: cardId,
        backgroundState: CardBackgroundState.Normal,
        upsideDown: false,
      });
      naturalCardOrder.push(cardInfo);
    });
  });

  judge.players.forEach((player) => {
    player.deck.forEach((cardInfo) => {
      cardInsideDeck.add(cardInfo.toKey());
      if (cardInfo.characterId !== null) {
        characterInsideDeck.add(cardInfo.characterId);
      }
    });
    player.collected.forEach((cardInfo) => {
      cardInsideCollected.add(cardInfo.toKey());
    });
  });

  // region placeholder slots -------------------------------------------------

  for (let deckIndex = 0; deckIndex < 2; deckIndex++) {
    if (deckIndex === 1 && (isMelee || isNoOpponent)) { continue; }
    const playerIndex = mapDeckSide(deckIndex as 0 | 1, layout.selfOnNearSide);
    if (judge.players.length <= playerIndex) { continue; }
    judge.players[playerIndex].deck.forEach((cardInfo, index) => {
      let placeholderHidden = cardInfo.characterId !== null;
      if (
        dragInfo !== null && dragInfo.dragging && dragInfo.dragType === "fromDeck" &&
        dragInfo.cardInfo.toKey() === cardInfo.toKey()
      ) {
        placeholderHidden = false;
      }
      placeholders.push({
        ...toDeckCardPosition(layout, deckIndex as 0 | 1, index),
        hidden: placeholderHidden,
      });
    });
  }

  // region deck cards --------------------------------------------------------

  judge.players.forEach((player, playerIndexRaw) => {
    const playerIndex = playerIndexRaw as 0 | 1;
    if (playerIndex === 1 && !layout.showOpponentDeck) { return; }
    const deckIndex = mapDeckSide(playerIndex, layout.selfOnNearSide);
    player.deck.forEach((cardInfo, index) => {
      if (cardInfo.characterId === null) { return; }
      const card = cards.get(cardInfo.toKey());
      if (card === undefined) { return; }
      const position = toDeckCardPosition(layout, deckIndex, index);
      card.visible = true;
      card.x = position.x;
      card.y = position.y;
      card.zIndex = 200;
      if (deckIndex === 1) { card.upsideDown = true; }

      let hoverable = judge.state === GameJudgeState.SelectingCards;
      if (judge.state === GameJudgeState.TurnWinnerDetermined && deckIndex === 0) {
        hoverable = true;
      }
      if (hoverable && !judge.isObserver()) {
        card.onMouseEnter = () => { onCardHover(cardInfo); };
        card.onMouseLeave = () => { onCardHover(null); };
      }
      if (judge.state === GameJudgeState.TurnStart && !judge.isObserver()) {
        card.onClick = () => { onDeckCardClick(playerIndex, index, cardInfo); };
      }
    });
  });

  // region unused pile -------------------------------------------------------

  const unusedStrip = computeUnusedCardsStrip(layout, unusedCards.length, {
    isServerClientObserver, isMelee, isSelectingCards,
  });
  const canvasHeight = growCanvasHeight(layout.baseCanvasHeight, unusedStrip.requiredCanvasHeight);

  unusedCards.forEach((cardInfo, index) => {
    const card = cards.get(cardInfo.toKey());
    if (card === undefined) { return; }
    card.visible = true;
    card.x = canvasMargin + unusedStrip.step * index;
    card.y = unusedStrip.yBase - unusedStrip.step * index;
    card.zIndex = index;
  });

  // region pick feedback -----------------------------------------------------

  judge.pickEvents.forEach((pickEvent) => {
    if (pickEvent.cardInfo.characterId === null) { return; }
    const card = cards.get(pickEvent.cardInfo.toKey());
    if (card === undefined) { return; }
    card.backgroundState = pickEvent.characterId() === currentCharacterId
      ? CardBackgroundState.Correct
      : CardBackgroundState.Incorrect;
  });

  // region selectable row ----------------------------------------------------

  const selectableCards: Array<SelectableCard> = [];
  if (isSelectingCards) {
    naturalCardOrder.forEach((cardInfo) => {
      if (cardInfo.characterId === null) { return; }
      if (characterInsideDeck.has(cardInfo.characterId)) { return; }
      if (dragInfo && dragInfo.cardInfo.characterId === cardInfo.characterId) { return; }
      if (musicSelection.get(cardInfo.characterId) === -1) { return; }
      selectableCards.push({ cardInfo, x: 0, y: 0 });
      const card = cards.get(cardInfo.toKey());
      if (card === undefined) { return; }
      if (!judge.isObserver()) {
        card.onMouseEnter = () => { onCardHover(cardInfo); };
        card.onMouseLeave = () => { onCardHover(null); };
      }
    });

    const selectableTotalWidth = cardWidth + (selectableCards.length - 1) * (cardWidth - cardSelectionOverlap);
    const offset = selectableTotalWidth > deckWidth
      ? -cardSelectionSliderValue * (selectableTotalWidth - deckWidth)
      : 0;
    selectableCards.forEach((entry, index) => {
      const card = cards.get(entry.cardInfo.toKey());
      if (card === undefined) { return; }
      const x = deckLeft + index * (cardWidth - cardSelectionOverlap) + offset;
      const y = layout.middleBarTop + 16;
      entry.x = x;
      entry.y = y;
      card.visible = true;
      card.x = x;
      card.y = y;
      card.zIndex = selectableCards.length - index;
    });
  }

  // region collected piles ---------------------------------------------------

  const observerList: CollectedPilesModel["observerList"] = layout.observerNames.length > 0
    ? {
      x: (isMelee && judge.isObserver())
        ? canvasMargin + unusedCardsStripMaxWidth(layout) + canvasMargin
        : canvasWidth - canvasMargin - ObserverNamesWidth,
      y: (isMelee && judge.isObserver()) ? layout.playerNameTop : layout.opponentCollectedTop,
      width: ObserverNamesWidth,
      height: cardHeight + canvasSpacing + layout.playerNameHeight,
      entries: judge.players
        .map((player, id) => ({ player, id }))
        .filter(({ player }) => player.isObserver)
        .map(({ player, id }) => ({ name: player.name, isSelf: id === judge.myPlayerIndex })),
    }
    : null;

  const scoreBadges: CollectedPilesModel["scoreBadges"] = [];
  const scoreLabels: CollectedPilesModel["scoreLabels"] = [];

  if (!isSelectingCards) {
    let opponentIndex = 0;

    judge.players.forEach((player, playerId) => {
      const collected = player.collected;
      if (playerId === 1 && isNoOpponent) { return; }
      if (player.isObserver) { return; }

      const onOpponentSide = judge.isObserver()
        ? (isMelee ? false : playerId === 0)
        : playerId !== judge.myPlayerIndex;
      const y = onOpponentSide
        ? layout.opponentCollectedTop
        : layout.playerCollectedTop + layout.hoverRaiseHeight;
      let startX = canvasWidth - canvasMargin - cardWidth * 2 - canvasSpacing;
      let totalWidth = canvasWidth - canvasMargin * 2;

      if (onOpponentSide) {
        if (layout.observerNames.length > 0) {
          totalWidth -= ObserverNamesWidth + canvasMargin;
        }
        if (layout.opponentCount === 1) {
          totalWidth -= cardWidth + canvasSpacing;
          startX = canvasMargin + cardWidth + canvasSpacing;
        } else {
          startX = canvasMargin
            + ((totalWidth - (layout.opponentCount - 1) * canvasSpacing) / layout.opponentCount + canvasSpacing) * opponentIndex;
          totalWidth = (totalWidth - (layout.opponentCount - 1) * canvasSpacing) / layout.opponentCount;
        }
      } else {
        if (isMelee) {
          totalWidth -= unusedCardsStripMaxWidth(layout) + canvasMargin;
        }
        if (judge.isObserver() && isMelee) {
          totalWidth = totalWidth - layout.opponentCount * canvasSpacing - ObserverNamesWidth - canvasMargin;
          totalWidth = totalWidth / (layout.opponentCount + 1);
          startX = canvasWidth - canvasMargin
            - (totalWidth + canvasSpacing) * (layout.opponentCount - opponentIndex) - cardWidth;
        } else {
          totalWidth -= cardWidth + canvasSpacing;
        }
      }
      if (playerId !== judge.myPlayerIndex) { opponentIndex += 1; }

      totalWidth -= cardWidth;
      let delta = collected.length === 1 ? 0 : totalWidth / (collected.length - 1);
      if (delta > cardWidth * 0.66) { delta = cardWidth * 0.66; }
      if (!onOpponentSide) { delta = -delta; }

      if ((!onOpponentSide || layout.opponentCount === 1) && !(isMelee && judge.isObserver())) {
        scoreBadges.push({
          key: `collected-text-${playerId}`,
          left: onOpponentSide ? canvasMargin : canvasWidth - canvasMargin - cardWidth,
          top: y,
          width: cardWidth,
          height: cardHeight,
          score: collected.length,
        });
      }

      const roleLabel = judge.isObserver()
        ? GetLocalizedString(Localization.GamePlayer)
        : GetLocalizedString(Localization.GameOpponent);

      if (onOpponentSide && layout.opponentCount >= 2) {
        scoreLabels.push({
          key: `opponent-name-deck-count-${playerId}`,
          left: startX,
          top: layout.opponentNameTop,
          width: totalWidth + cardWidth,
          align: "left",
          prefix: `${roleLabel} ${player.name}`,
          score: collected.length,
        });
      }
      if (!onOpponentSide && isMelee && judge.isObserver()) {
        scoreLabels.push({
          key: `opponent-name-deck-count-${playerId}`,
          left: startX - totalWidth,
          top: layout.playerNameTop,
          width: totalWidth + cardWidth,
          align: "right",
          prefix: `${GetLocalizedString(Localization.GamePlayer)} ${player.name}`,
          score: collected.length,
        });
      }

      if (collected.length === 0) { return; }
      collected.forEach((cardInfo, index) => {
        const card = cards.get(cardInfo.toKey());
        if (card === undefined) { return; }
        card.visible = true;
        card.x = startX + delta * index;
        card.y = y;
        card.zIndex = index;
        card.onMouseEnter = () => { onCardHover(cardInfo); };
        card.onMouseLeave = () => { onCardHover(null); };
        if (onOpponentSide) { card.upsideDown = true; }
        if (hoveringCardInfo !== null && hoveringCardInfo.toKey() === cardInfo.toKey()) {
          card.y += onOpponentSide ? 16 : -16;
        }
      });
    });
  }

  // region hover and drag feedback -------------------------------------------

  if (isSelectingCards && hoveringCardInfo !== null && dragInfo === null) {
    const card = cards.get(hoveringCardInfo.toKey());
    if (card !== undefined) {
      card.backgroundState = CardBackgroundState.Hover;
      if (!cardInsideDeck.has(hoveringCardInfo.toKey())) {
        card.y -= 16;
      }
    }
  }
  if (!isSelectingCards && hoveringCardInfo !== null && dragInfo === null) {
    const card = cards.get(hoveringCardInfo.toKey());
    if (card !== undefined) {
      card.backgroundState = CardBackgroundState.Hover;
      card.zIndex = 1000;
    }
  }

  if (isSelectingCards && dragInfo !== null) {
    applyDragFeedback({
      cards, judge, layout, dragInfo,
      allowedDecks: dropDecksWhileSelecting(judge),
    });
  }

  if (
    judge.state === GameJudgeState.TurnWinnerDetermined &&
    dragInfo !== null && dragInfo.dragType === "fromDeck"
  ) {
    const allowedDecks: Array<0 | 1> = [0];
    if (canDropToOpponentDeck(judge, isCPU)) {
      allowedDecks.push(1);
    }
    applyDragFeedback({
      cards, judge, layout, dragInfo, allowedDecks,
      winnerDetermined: true, is1v1: layout.is1v1, isCPU,
    });
  }

  // region cheat hint --------------------------------------------------------

  let cheatCardKey: string | null = null;
  for (const player of judge.players) {
    const answer = player.deck.find((card) => card.characterId === currentCharacterId);
    if (answer) {
      cheatCardKey = answer.toKey();
      break;
    }
  }

  return {
    cards,
    placeholders,
    selectableCards,
    unusedStrip,
    unusedStripMaxWidth: unusedCardsStripMaxWidth(layout),
    collectedModel: { observerList, scoreBadges, scoreLabels },
    cheatCardKey,
    canvasHeight,
  };
}

function applyDragFeedback({
  cards, judge, layout, dragInfo, allowedDecks, winnerDetermined = false, is1v1 = false, isCPU = false,
}: {
  cards: Map<string, CardVisual>;
  judge: GameJudge;
  layout: BoardLayout;
  dragInfo: DragInfo;
  allowedDecks: Array<0 | 1>;
  winnerDetermined?: boolean;
  is1v1?: boolean;
  isCPU?: boolean;
}): void {
  const deckPos = canvasPositionToDeckPosition(
    layout, dragInfo.currentMouseX, dragInfo.currentMouseY, allowedDecks,
  );
  const card = cards.get(dragInfo.cardInfo.toKey());
  if (card === undefined) { return; }
  card.visible = true;
  card.zIndex = 1000;
  card.transition = getCardTransitionString("0.1s");
  card.backgroundState = CardBackgroundState.Hover;

  let snap = false;
  if (!winnerDetermined) {
    snap = deckPos !== null;
  } else if (deckPos !== null) {
    if (deckPos.deckIndex === 0) {
      snap = true;
    } else if (is1v1) {
      const opponentIndex = judge.isClient() ? 0 : 1;
      const hasGive = (isCPU || judge.isServer()) ? judge.givesLeft > 0 : judge.givesLeft < 0;
      const isEmptySlot = judge.players[opponentIndex].deck[deckPos.cardIndex].characterId === null;
      snap = hasGive && isEmptySlot;
    }
  }

  if (snap && deckPos !== null) {
    const position = toDeckCardPosition(layout, deckPos.deckIndex, deckPos.cardIndex);
    card.x = position.x;
    card.y = position.y;
    if (deckPos.deckIndex === 1) { card.upsideDown = true; }
  } else {
    card.x = dragInfo.currentMouseX - dragInfo.relativeToCardX;
    card.y = dragInfo.currentMouseY - dragInfo.relativeToCardY;
  }
}
