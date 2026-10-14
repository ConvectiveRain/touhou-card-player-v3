import { describe, expect, it } from "vitest";
import { GameJudge } from "../../types/GameJudge";
import { CardInfo, GameJudgeState, MatchType, SendOption } from "../../types/GameTypes";
import { BoardLayout, BoardLayoutInput, computeBoardLayout } from "../../lib/geometry";
import { createTestGlobalData, createTestOuterRef } from "../../test/fixtures";
import { createDragHandlers, DragInfo } from "./cardDrag";

const DontSend: SendOption = { send: false, except: null };

/** A point that is outside every deck grid, so a drop lands on no deck at all. */
const OffBoard = { clientX: 5, clientY: 5 } as React.MouseEvent;

function makeLayout(judge: GameJudge, overrides: Partial<BoardLayoutInput> = {}): BoardLayout {
  return computeBoardLayout({
    containerWidth: 1600,
    cardWidthPercentage: 0.08,
    deckRows: judge.deckRows,
    deckColumns: judge.deckColumns,
    isMelee: judge.isMelee(),
    isCPU: judge.matchType === MatchType.CPU,
    isServer: judge.isServer(),
    isServerClientObserver: judge.isServerClientObserverMode(),
    isNoOpponent: judge.matchType === MatchType.None,
    isSelectingCards: judge.state === GameJudgeState.SelectingCards,
    isObserver: judge.isObserver(),
    players: judge.players,
    ...overrides,
  });
}

/** A CPU match with one card in each deck, so both sides are distinguishable. */
function makeCpuHarness() {
  const data = createTestGlobalData();
  const judge = new GameJudge(createTestOuterRef({ globalData: data }));
  judge.matchType = MatchType.CPU;
  judge.addCPUPlayer();
  judge.addToDeck(0, new CardInfo("alice", 0), 0, DontSend);
  judge.addToDeck(1, new CardInfo("marisa", 0), 0, DontSend);
  const layout = makeLayout(judge);

  const dragInfo = (cardInfo: CardInfo, deckIndex: 0 | 1): DragInfo => ({
    dragging: true,
    dragType: "fromDeck",
    // far enough in the past that the release counts as a drag, not a click
    mouseDownTimestamp: Date.now() - 1000,
    initialMouseX: 0,
    initialMouseY: 0,
    relativeToCardX: 0,
    relativeToCardY: 0,
    currentMouseX: 0,
    currentMouseY: 0,
    cardInfo,
    dragFromDeck: { deckIndex, cardIndex: 0 },
  });

  const drop = (cardInfo: CardInfo, deckIndex: 0 | 1) => {
    const handlers = createDragHandlers({
      judge,
      notifyJudgeChanged: () => {},
      layout,
      selectableCards: [],
      dragInfo: dragInfo(cardInfo, deckIndex),
      setDragInfo: () => {},
      setHoveringCardInfo: () => {},
      sendToAll: DontSend,
      isCPU: true,
      isMelee: false,
    });
    handlers.handleMouseUp(OffBoard, null);
  };

  return { judge, drop };
}

describe("createDragHandlers dropWhileSelecting", () => {
  it("removes the card from the deck it was picked up from, not the local one", () => {
    const { judge, drop } = makeCpuHarness();

    // the CPU's far deck is a legal drag source while building a lineup
    drop(new CardInfo("marisa", 0), 1);

    expect(judge.getDeck(1, 0)).toBeNull();
    expect(judge.getDeck(0, 0)?.toKey()).toBe("alice-0");
  });

  it("still removes the local card when the local deck is the source", () => {
    const { judge, drop } = makeCpuHarness();

    drop(new CardInfo("alice", 0), 0);

    expect(judge.getDeck(0, 0)).toBeNull();
    expect(judge.getDeck(1, 0)?.toKey()).toBe("marisa-0");
  });
});
