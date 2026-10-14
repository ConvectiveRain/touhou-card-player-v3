import { CardInfo, GameJudgeState, MatchType, SendOption } from "../../types/GameTypes";
import type { GameJudge } from "../../types/GameJudge";
import {
  BoardLayout, DeckSide, canvasPositionToDeckPosition, mapDeckSide,
  opponentPlayerIndex, selfPlayerIndex, toDeckCardPosition,
} from "../../lib/geometry";
import type { SelectableCard } from "./cardVisuals";

/**
 * Drag & drop for the board. All of it is expressed as closures over the current state, so
 * the whole interaction is one object instead of three large handlers buried in the
 * component body.
 */

/** A press shorter than this counts as a click rather than a drag. */
export const DragClickThresholdMs = 100;

export type DragInfo = {
  dragging: boolean;
  mouseDownTimestamp: number;
  initialMouseX: number;
  initialMouseY: number;
  relativeToCardX: number;
  relativeToCardY: number;
  currentMouseX: number;
  currentMouseY: number;
  cardInfo: CardInfo;
  dragType: "fromSelectable" | "fromDeck";
  dragFromDeck: { deckIndex: DeckSide; cardIndex: number } | null;
};

/**
 * While a lineup is being built only the local deck is a drop target, unless the opponent
 * is the CPU (whose deck can be pre-filled by hand).
 */
export function dropDecksWhileSelecting(judge: GameJudge): Array<DeckSide> {
  return judge.matchType === MatchType.CPU ? [0, 1] : [0];
}

/** True when the winner is expected to hand a card over to their opponent. */
export function canDropToOpponentDeck(judge: GameJudge, isCPU: boolean): boolean {
  return ((judge.isServer() || isCPU) && judge.givesLeft > 0)
    || (judge.isClient() && judge.givesLeft < 0);
}

export type DragHandlersOptions = {
  judge: GameJudge;
  /** Flags the judge as changed so React re-renders the mutated instance. */
  notifyJudgeChanged: () => void;
  layout: BoardLayout;
  selectableCards: Array<SelectableCard>;
  dragInfo: DragInfo | null;
  setDragInfo: (dragInfo: DragInfo | null) => void;
  setHoveringCardInfo: (cardInfo: CardInfo | null) => void;
  sendToAll: SendOption;
  isCPU: boolean;
  isMelee: boolean;
};

export type DragHandlers = {
  /** `rect` is the board's bounding rect, read by the caller from its own container. */
  handleMouseDown: (event: React.MouseEvent, rect: DOMRect | null) => void;
  handleMouseMove: (event: React.MouseEvent, rect: DOMRect | null) => void;
  handleMouseUp: (event: React.MouseEvent, rect: DOMRect | null) => void;
};

export function createDragHandlers(options: DragHandlersOptions): DragHandlers {
  const {
    judge, notifyJudgeChanged, layout, selectableCards, dragInfo, setDragInfo,
    setHoveringCardInfo, sendToAll, isCPU, isMelee,
  } = options;

  const cardWidth = layout.cardWidth;
  const cardHeight = layout.cardHeight;

  const mousePosition = (event: React.MouseEvent, rect: DOMRect | null) => ({
    x: event.clientX - (rect ? rect.left : 0),
    y: event.clientY - (rect ? rect.top : 0),
  });

  const startDragging = (
    cardInfo: CardInfo,
    position: { x: number; y: number },
    cardPosition: { x: number; y: number },
    dragType: DragInfo["dragType"],
    dragFromDeck: DragInfo["dragFromDeck"],
  ) => {
    setDragInfo({
      dragging: true,
      dragType,
      mouseDownTimestamp: Date.now(),
      initialMouseX: position.x,
      initialMouseY: position.y,
      relativeToCardX: position.x - cardPosition.x,
      relativeToCardY: position.y - cardPosition.y,
      cardInfo,
      currentMouseX: position.x,
      currentMouseY: position.y,
      dragFromDeck,
    });
  };

  const handleMouseDown = (event: React.MouseEvent, rect: DOMRect | null) => {
    if (judge.matchType === MatchType.Observer) { return; }
    const position = mousePosition(event, rect);

    if (judge.state === GameJudgeState.SelectingCards) {
      // is the press on a card of the selectable row?
      for (const entry of selectableCards) {
        if (
          position.x >= entry.x && position.x <= entry.x + cardWidth &&
          position.y >= entry.y && position.y <= entry.y + cardHeight
        ) {
          startDragging(entry.cardInfo, position, entry, "fromSelectable", null);
          return;
        }
      }

      // is the press on a card already placed in a deck?
      let deckPos = canvasPositionToDeckPosition(layout, position.x, position.y, [0, 1]);
      if (judge.isServerClientObserverMode() && deckPos !== null && deckPos.deckIndex === 1) {
        // a remote opponent's cards cannot be rearranged from here
        deckPos = null;
      }
      if (deckPos !== null) {
        const playerIndex = mapDeckSide(deckPos.deckIndex, layout.selfOnNearSide);
        const cardInfo = judge.getDeck(playerIndex, deckPos.cardIndex);
        if (cardInfo !== null) {
          notifyJudgeChanged();
          startDragging(
            cardInfo, position,
            toDeckCardPosition(layout, deckPos.deckIndex, deckPos.cardIndex),
            "fromDeck",
            { deckIndex: deckPos.deckIndex, cardIndex: deckPos.cardIndex },
          );
        }
      }
      return;
    }

    if (judge.state === GameJudgeState.TurnWinnerDetermined) {
      // only the local deck can be picked up when handing cards over
      const deckPos = canvasPositionToDeckPosition(layout, position.x, position.y, [0]);
      if (deckPos !== null) {
        const playerIndex = selfPlayerIndex(judge.isClient(), isMelee);
        const cardInfo = judge.getDeck(playerIndex, deckPos.cardIndex);
        if (cardInfo !== null) {
          startDragging(
            cardInfo, position,
            toDeckCardPosition(layout, deckPos.deckIndex, deckPos.cardIndex),
            "fromDeck",
            { deckIndex: deckPos.deckIndex, cardIndex: deckPos.cardIndex },
          );
        }
      }
    }
  };

  const handleMouseMove = (event: React.MouseEvent, rect: DOMRect | null) => {
    if (!dragInfo || !dragInfo.dragging) { return; }
    const position = mousePosition(event, rect);
    setDragInfo({ ...dragInfo, currentMouseX: position.x, currentMouseY: position.y });
  };

  /** Places the dragged card while building a lineup. */
  const dropWhileSelecting = (position: { x: number; y: number }, seeAsClick: boolean) => {
    if (!dragInfo) { return; }
    let deckPos = canvasPositionToDeckPosition(
      layout, position.x, position.y, dropDecksWhileSelecting(judge),
    );

    if (seeAsClick) {
      if (dragInfo.dragType === "fromSelectable") {
        // a plain click appends the card to the first empty slot
        if (deckPos === null) {
          const playerIndex = selfPlayerIndex(judge.isClient(), isMelee);
          for (let index = 0; index < judge.deckRows * judge.deckColumns; index++) {
            if (judge.getDeck(playerIndex, index) === null) {
              deckPos = { deckIndex: 0, cardIndex: index };
              break;
            }
          }
          if (deckPos === null && isCPU) {
            for (let index = 0; index < judge.deckRows * judge.deckColumns; index++) {
              if (judge.getDeck(1, index) === null) {
                deckPos = { deckIndex: 1, cardIndex: index };
                break;
              }
            }
          }
        }
      } else if (dragInfo.dragType === "fromDeck") {
        deckPos = null;
      }
    }

    let fromPlayerIndex: DeckSide = 0;
    if (dragInfo.dragType === "fromDeck") {
      // Derived from the deck side the card was picked up from, not from the local role: the CPU
      // opponent's deck is a legal drag source, and removing from the wrong player silently
      // empties the local deck instead.
      fromPlayerIndex = mapDeckSide(dragInfo.dragFromDeck!.deckIndex, layout.selfOnNearSide);
    }

    if (deckPos !== null) {
      if (dragInfo.dragType === "fromDeck") {
        judge.removeFromDeck(fromPlayerIndex, dragInfo.dragFromDeck!.cardIndex, sendToAll);
      }
      const toPlayerIndex = mapDeckSide(deckPos.deckIndex, layout.selfOnNearSide);
      const occupant = judge.getDeck(toPlayerIndex, deckPos.cardIndex);
      if (occupant !== null) {
        judge.removeFromDeck(toPlayerIndex, deckPos.cardIndex, sendToAll);
        if (dragInfo.dragType === "fromDeck") {
          // swap the two cards
          judge.addToDeck(fromPlayerIndex, occupant, dragInfo.dragFromDeck!.cardIndex, sendToAll);
        }
      }
      judge.addToDeck(toPlayerIndex, dragInfo.cardInfo, deckPos.cardIndex, sendToAll);
      notifyJudgeChanged();
    } else if (dragInfo.dragType === "fromDeck") {
      judge.removeFromDeck(fromPlayerIndex, dragInfo.dragFromDeck!.cardIndex, sendToAll);
      notifyJudgeChanged();
    }
  };

  /** Places the dragged card when the winner is handing cards to their opponent. */
  const dropWhileGiving = (position: { x: number; y: number }, seeAsClick: boolean) => {
    if (!dragInfo || dragInfo.dragType !== "fromDeck") { return; }
    const selfIndex = selfPlayerIndex(judge.isClient(), isMelee);
    const opponentIndex = opponentPlayerIndex(judge.isClient());

    const allowedDecks: Array<DeckSide> = [0];
    if (canDropToOpponentDeck(judge, isCPU)) {
      allowedDecks.push(1);
    }
    let deckPos = canvasPositionToDeckPosition(layout, position.x, position.y, allowedDecks);

    if (
      seeAsClick && allowedDecks.includes(1) &&
      (deckPos === null || (deckPos.deckIndex === 0 && deckPos.cardIndex === dragInfo.dragFromDeck!.cardIndex))
    ) {
      // a click sends the card to the first empty opponent slot
      for (let index = 0; index < judge.deckRows * judge.deckColumns; index++) {
        if (judge.getDeck(opponentIndex, index) === null) {
          deckPos = { deckIndex: 1, cardIndex: index };
          break;
        }
      }
    }
    if (deckPos !== null && deckPos.deckIndex === 1 && judge.getDeck(opponentIndex, deckPos.cardIndex) !== null) {
      deckPos = null;
    }

    if (deckPos !== null) {
      if (deckPos.deckIndex === 0) {
        // swap inside the local deck
        const occupant = judge.getDeck(selfIndex, deckPos.cardIndex);
        judge.removeFromDeck(selfIndex, dragInfo.dragFromDeck!.cardIndex, sendToAll);
        if (occupant !== null) {
          judge.removeFromDeck(selfIndex, deckPos.cardIndex, sendToAll);
          judge.addToDeck(selfIndex, occupant, dragInfo.dragFromDeck!.cardIndex, sendToAll);
        }
        judge.addToDeck(selfIndex, dragInfo.cardInfo, deckPos.cardIndex, sendToAll);
      } else {
        judge.removeFromDeck(selfIndex, dragInfo.dragFromDeck!.cardIndex, sendToAll);
        judge.addToDeck(opponentIndex, dragInfo.cardInfo, deckPos.cardIndex, sendToAll);
        if (judge.isClient()) {
          judge.givesLeft += 1;
        } else {
          judge.givesLeft -= 1;
        }
        judge.sendEvent({ type: "give" }, sendToAll);
      }
      setHoveringCardInfo(null);
      notifyJudgeChanged();
    }
  };

  const handleMouseUp = (event: React.MouseEvent, rect: DOMRect | null) => {
    if (judge.matchType === MatchType.Observer) { return; }
    if (!dragInfo || !dragInfo.dragging) { return; }

    const position = mousePosition(event, rect);
    const seeAsClick = Date.now() - dragInfo.mouseDownTimestamp < DragClickThresholdMs;

    if (judge.state === GameJudgeState.SelectingCards) {
      dropWhileSelecting(position, seeAsClick);
    } else if (judge.state === GameJudgeState.TurnWinnerDetermined) {
      dropWhileGiving(position, seeAsClick);
    }
    setDragInfo(null);
  };

  return { handleMouseDown, handleMouseMove, handleMouseUp };
}
