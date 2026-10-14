import { CardAspectRatio } from "../types/Configs";
import { DeckPosition } from "../types/GameTypes";

/**
 * Pure geometry for the game board. Everything here is a function of its inputs, so the
 * layout can be reasoned about (and tested) without mounting the board component.
 */

export type Position = { x: number; y: number };
export type DeckSide = 0 | 1;

export const CanvasSpacing = 6;
export const CanvasMargin = 16;
export const PlayerNameHeight = 32;
export const SliderHeight = 28;
export const HoverRaiseHeight = 16;
export const ButtonSize = 36;

export const DefaultCardWidthPercentage = 0.08;
export const CardWidthPercentageMin = 0.04;
export const CardWidthPercentageMax = 0.40;

export const DefaultDeckRows = 3;
export const DefaultDeckColumns = 8;
export const MaxDeckRows = 5;
export const MaxDeckColumns = 15;

/** A whole deck row may take at most this share of the canvas width. */
export const MaxCardWidthTotalPercentage = 0.85;

/**
 * The widest one card of a `deckColumns` wide deck may be, so that the row stays within
 * `MaxCardWidthTotalPercentage` of the canvas.
 */
export function maxCardWidthPercentageForDeck(deckColumns: number): number {
  return MaxCardWidthTotalPercentage / deckColumns;
}

export const CardTransitionProperties = [
  "top", "left", "transform", "background-color", "width", "height",
] as const;

export function getCardTransitionString(duration: string): string {
  return CardTransitionProperties.map((property) => `${property} ${duration}`).join(", ");
}

export type BoardLayoutInput = {
  /** Width of the board container in px (falls back to the previous 800 default). */
  containerWidth: number;
  cardWidthPercentage: number;
  deckRows: number;
  deckColumns: number;
  isMelee: boolean;
  isCPU: boolean;
  isServer: boolean;
  isServerClientObserver: boolean;
  isNoOpponent: boolean;
  isSelectingCards: boolean;
  isObserver: boolean;
  players: ReadonlyArray<{ name: string; isObserver: boolean }>;
};

export type BoardLayout = {
  canvasSpacing: number;
  canvasMargin: number;
  canvasWidth: number;
  cardWidth: number;
  cardHeight: number;
  deckRows: number;
  deckColumns: number;
  deckWidth: number;
  deckHeight: number;
  deckLeft: number;
  deckRight: number;
  buttonSize: number;
  playerNameHeight: number;
  hoverRaiseHeight: number;
  middleBarHeight: number;

  is1v1: boolean;
  /** True when player 0's deck is the near-side deck. */
  selfOnNearSide: boolean;
  showPlayerName: boolean;
  showOpponentName: boolean;
  showOpponentDeck: boolean;
  showOpponentCollected: boolean;
  showPlayerCollected: boolean;
  opponentCount: number;
  observerNames: Array<string>;

  opponentCollectedTop: number;
  opponentCollectedBottom: number;
  opponentNameTop: number;
  opponentNameBottom: number;
  opponentDeckTop: number;
  opponentDeckBottom: number;
  middleBarTop: number;
  middleBarBottom: number;
  playerDeckTop: number;
  playerDeckBottom: number;
  playerNameTop: number;
  playerNameBottom: number;
  playerCollectedTop: number;
  playerCollectedBottom: number;

  cardSelectionOverlap: number;
  /** Canvas height implied by the deck/name/collected stack alone. */
  baseCanvasHeight: number;
};

export function computeBoardLayout(input: BoardLayoutInput): BoardLayout {
  const {
    deckRows, deckColumns, isMelee, isCPU, isServer, isServerClientObserver, isNoOpponent,
    isSelectingCards, isObserver, players,
  } = input;

  const canvasWidth = input.containerWidth > 0 ? input.containerWidth : 800;
  const cardWidth = canvasWidth * input.cardWidthPercentage;
  const cardHeight = cardWidth / CardAspectRatio;

  const is1v1 = isCPU || (isServerClientObserver && !isMelee);
  // Player 0 is drawn on the near side: that is the server, the CPU opponent, practice and
  // melee. A client or observer is player 1, so their deck is mirrored to the near side.
  const selfOnNearSide = isServer || isCPU || isNoOpponent || isMelee;

  const middleBarHeight = isSelectingCards
    ? HoverRaiseHeight + cardHeight + CanvasSpacing + SliderHeight
    : 80;

  const deckWidth = deckColumns * cardWidth + (deckColumns - 1) * CanvasSpacing;
  const deckHeight = deckRows * cardHeight + (deckRows - 1) * CanvasSpacing;
  const deckLeft = (canvasWidth - deckWidth) / 2;
  const deckRight = deckLeft + deckWidth;

  const showPlayerName = !(isNoOpponent || isCPU);
  const showOpponentName = showPlayerName && !(isObserver && isMelee) && !(isSelectingCards && isMelee);
  const showOpponentDeck = isCPU || (isServerClientObserver && !isMelee);
  const showOpponentCollected = !isSelectingCards && (isServerClientObserver || isCPU) && (!isMelee || !isObserver);
  const showPlayerCollected = !isSelectingCards || isMelee;

  let opponentCount = 0;
  const observerNames: Array<string> = [];
  for (let i = 1; i < players.length; i++) {
    if (!players[i].isObserver) { opponentCount += 1; }
    else { observerNames.push(players[i].name); }
  }

  const opponentCollectedTop = CanvasMargin;
  const opponentCollectedBottom = showOpponentCollected
    ? opponentCollectedTop + cardHeight + HoverRaiseHeight
    : opponentCollectedTop;

  const opponentNameTop = showOpponentCollected
    ? opponentCollectedBottom + CanvasSpacing
    : opponentCollectedBottom;
  const opponentNameBottom = showOpponentName
    ? opponentNameTop + PlayerNameHeight
    : opponentNameTop;

  const opponentDeckTop = showOpponentName ? opponentNameBottom + CanvasSpacing : opponentNameBottom;
  const opponentDeckBottom = showOpponentDeck ? opponentDeckTop + deckHeight : opponentDeckTop;

  const middleBarTop = showOpponentDeck ? opponentDeckBottom + CanvasSpacing : opponentDeckBottom;
  const middleBarBottom = middleBarTop + middleBarHeight;

  const playerDeckTop = middleBarBottom + CanvasSpacing;
  const playerDeckBottom = playerDeckTop + deckHeight;

  const playerNameTop = !showPlayerName
    ? playerDeckBottom + (isMelee ? PlayerNameHeight : (isNoOpponent ? CanvasMargin : 50))
    : (isSelectingCards
      ? playerDeckBottom + CanvasMargin + ButtonSize + CanvasSpacing
      : playerDeckBottom + CanvasSpacing + (isNoOpponent ? CanvasMargin : 50));
  const playerNameBottom = showPlayerName ? playerNameTop + PlayerNameHeight : playerNameTop;

  const playerCollectedTop = playerNameBottom + CanvasSpacing;
  const playerCollectedBottom = showPlayerCollected
    ? playerCollectedTop + cardHeight + HoverRaiseHeight
    : playerCollectedTop;

  return {
    canvasSpacing: CanvasSpacing,
    canvasMargin: CanvasMargin,
    canvasWidth,
    cardWidth,
    cardHeight,
    deckRows,
    deckColumns,
    deckWidth,
    deckHeight,
    deckLeft,
    deckRight,
    buttonSize: ButtonSize,
    playerNameHeight: PlayerNameHeight,
    hoverRaiseHeight: HoverRaiseHeight,
    middleBarHeight,

    is1v1,
    selfOnNearSide,
    showPlayerName,
    showOpponentName,
    showOpponentDeck,
    showOpponentCollected,
    showPlayerCollected,
    opponentCount,
    observerNames,

    opponentCollectedTop,
    opponentCollectedBottom,
    opponentNameTop,
    opponentNameBottom,
    opponentDeckTop,
    opponentDeckBottom,
    middleBarTop,
    middleBarBottom,
    playerDeckTop,
    playerDeckBottom,
    playerNameTop,
    playerNameBottom,
    playerCollectedTop,
    playerCollectedBottom,

    cardSelectionOverlap: cardWidth * 0.3,
    baseCanvasHeight: playerCollectedBottom + CanvasMargin,
  };
}

/**
 * Maps between the "near/far deck side" (0 is always the near side) and a player index.
 * The mapping is its own inverse, which is why one helper covers both directions.
 */
export function mapDeckSide(index: DeckSide, selfOnNearSide: boolean): DeckSide {
  return selfOnNearSide ? index : ((1 - index) as DeckSide);
}

/** Player index of the local player, which depends only on the role and melee count. */
export function selfPlayerIndex(isClient: boolean, isMelee: boolean): DeckSide {
  return isMelee ? 0 : (isClient ? 1 : 0);
}

/** Player index of the single remote/CPU opponent. */
export function opponentPlayerIndex(isClient: boolean): DeckSide {
  return isClient ? 0 : 1;
}

export function toDeckCardPosition(
  layout: BoardLayout, deckIndex: DeckSide, cardIndex: number,
): Position {
  const row = Math.floor(cardIndex / layout.deckColumns);
  const column = cardIndex % layout.deckColumns;
  if (deckIndex === 0) {
    return {
      x: layout.deckLeft + column * (layout.cardWidth + layout.canvasSpacing),
      y: layout.playerDeckTop + row * (layout.cardHeight + layout.canvasSpacing),
    };
  }
  return {
    x: layout.deckLeft + (layout.deckColumns - 1 - column) * (layout.cardWidth + layout.canvasSpacing),
    y: layout.opponentDeckTop + (layout.deckRows - 1 - row) * (layout.cardHeight + layout.canvasSpacing),
  };
}

/** Hit-tests a canvas point against the deck grids. `allowedDecks` uses near/far side indices. */
export function canvasPositionToDeckPosition(
  layout: BoardLayout, x: number, y: number, allowedDecks: ReadonlyArray<number> = [0, 1],
): DeckPosition | null {
  for (const rawDeckIndex of allowedDecks) {
    const deckIndex = rawDeckIndex as DeckSide;
    if (!layout.showOpponentDeck && deckIndex === 1) {
      continue;
    }
    const deckTop = deckIndex === 0 ? layout.playerDeckTop : layout.opponentDeckTop;
    if (
      y >= deckTop && y <= deckTop + layout.deckHeight &&
      x >= layout.deckLeft && x <= layout.deckLeft + layout.deckWidth
    ) {
      const relativeX = x - layout.deckLeft;
      const relativeY = y - deckTop;
      const columnStride = layout.cardWidth + layout.canvasSpacing;
      const rowStride = layout.cardHeight + layout.canvasSpacing;
      let column = Math.floor(relativeX / columnStride);
      let row = Math.floor(relativeY / rowStride);
      // only count the point as inside the grid when it lands on an actual card
      if (relativeX < column * columnStride + layout.cardWidth &&
          relativeY < row * rowStride + layout.cardHeight) {
        if (deckIndex === 1) {
          column = layout.deckColumns - 1 - column;
          row = layout.deckRows - 1 - row;
        }
        const cardIndex = row * layout.deckColumns + column;
        return { deckIndex, cardIndex };
      }
    }
  }
  return null;
}

export function unusedCardsStripMaxWidth(layout: BoardLayout): number {
  return layout.cardWidth + 50;
}

export type UnusedCardsStrip = {
  /** Top of the left-most card in the strip. */
  yBase: number;
  bottom: number;
  /** Horizontal space available for the strip. */
  totalWidth: number;
  /** Offset applied per card (cards overlap as the strip fills up). */
  step: number;
  /** Height the canvas needs so the strip is not clipped. */
  requiredCanvasHeight: number;
};

export function computeUnusedCardsStrip(
  layout: BoardLayout,
  cardCount: number,
  flags: { isServerClientObserver: boolean; isMelee: boolean; isSelectingCards: boolean },
): UnusedCardsStrip {
  const maxWidth = unusedCardsStripMaxWidth(layout);
  let totalWidth = (layout.canvasWidth - layout.deckWidth) / 2 - CanvasSpacing - CanvasMargin - 45;
  if (totalWidth > maxWidth) {
    totalWidth = maxWidth;
  }

  let step = 0;
  if (totalWidth > layout.cardWidth) {
    step = (totalWidth - layout.cardWidth) / (cardCount - 1);
  }
  if (step > 5) { step = 5; }

  let yBase = layout.playerDeckTop + layout.deckHeight - layout.cardHeight;
  if (flags.isServerClientObserver && !flags.isMelee) {
    yBase = layout.opponentDeckTop + layout.deckHeight - layout.cardHeight - 30;
    if (!flags.isSelectingCards) {
      yBase = layout.middleBarBottom - layout.cardHeight - 40;
    }
  } else if (flags.isServerClientObserver && flags.isMelee) {
    yBase = layout.playerCollectedBottom - layout.cardHeight;
  }

  const bottom = yBase + layout.cardHeight;
  return {
    yBase,
    bottom,
    totalWidth,
    step,
    requiredCanvasHeight: bottom + 25 + CanvasMargin,
  };
}

/** Which buttons in the column to the right of the player deck are visible. */
export type DeckColumnVisibility = {
  cardSmaller: boolean;
  cardLarger: boolean;
  filterByDeck: boolean;
  start: boolean;
  randomFill: boolean;
  clearDeck: boolean;
  shuffleDeck: boolean;
  switchOpponent: boolean;
  removeRow: boolean;
  addRow: boolean;
};

export function computeDeckColumnVisibility(opts: {
  isSelectingCards: boolean;
  isTurnCountdownNext: boolean;
  isObserver: boolean;
}): DeckColumnVisibility {
  const canEditDeck = opts.isSelectingCards && !opts.isObserver;
  return {
    cardSmaller: true,
    cardLarger: true,
    filterByDeck: !opts.isSelectingCards && !opts.isTurnCountdownNext && !opts.isObserver,
    start: !opts.isObserver,
    randomFill: canEditDeck,
    clearDeck: canEditDeck,
    shuffleDeck: canEditDeck,
    // An observer still needs a way back out of observer mode, so the mode button stays usable.
    switchOpponent: opts.isSelectingCards || opts.isObserver,
    removeRow: canEditDeck,
    addRow: canEditDeck,
  };
}

/** The `top` of every button in the deck column, in the column's stacking order. */
export type DeckColumnPositions = {
  cardSmaller: number;
  cardLarger: number;
  filterByDeck: number;
  start: number;
  randomFill: number;
  clearDeck: number;
  shuffleDeck: number;
  switchOpponent: number;
  removeRow: number;
  addRow: number;
};

/**
 * The single source of truth for the deck column's vertical cursor: only visible buttons
 * consume vertical space, and the row controls are pinned near the bottom of the deck.
 * `bottomY` is where the cursor ends, so the canvas can reserve
 * `bottomY - canvasSpacing + canvasMargin`.
 */
export function computeDeckColumnLayout(
  layout: BoardLayout, visible: DeckColumnVisibility,
): { positions: DeckColumnPositions; bottomY: number } {
  const stride = layout.buttonSize + layout.canvasSpacing;
  let y = layout.playerDeckTop;
  const positions = {} as DeckColumnPositions;

  positions.cardSmaller = y;
  y += stride;
  positions.cardLarger = y;
  y += stride;
  positions.filterByDeck = y;
  if (visible.filterByDeck) { y += stride; }
  positions.start = y;
  if (visible.start) { y += stride; }
  positions.randomFill = y;
  if (visible.randomFill) { y += stride; }
  positions.clearDeck = y;
  if (visible.clearDeck) { y += stride; }
  positions.shuffleDeck = y;
  if (visible.shuffleDeck) { y += stride; }
  positions.switchOpponent = y;
  if (visible.switchOpponent) { y += stride; }

  if (visible.removeRow) {
    const pinnedY = layout.playerDeckTop + layout.deckHeight - layout.buttonSize * 2 - layout.canvasSpacing;
    if (pinnedY > y) { y = pinnedY; }
  }
  positions.removeRow = y;
  if (visible.removeRow) { y += stride; }
  positions.addRow = y;
  if (visible.addRow) { y += stride; }

  return { positions, bottomY: y };
}

/** Grow-only canvas height helper used by the state-dependent strips and labels. */
export function growCanvasHeight(currentHeight: number, requiredHeight: number): number {
  return requiredHeight > currentHeight ? requiredHeight : currentHeight;
}
