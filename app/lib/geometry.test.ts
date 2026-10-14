import { describe, expect, it } from "vitest";
import {
  CanvasMargin, CanvasSpacing, CardWidthPercentageMax, CardWidthPercentageMin, HoverRaiseHeight,
  MaxCardWidthTotalPercentage, MaxDeckColumns, canvasPositionToDeckPosition, cardWidthPercentageLimit,
  clampCardWidthPercentage, computeBoardLayout, computeDeckColumnLayout, computeDeckColumnVisibility,
  computeUnusedCardsStrip, getCardTransitionString, growCanvasHeight, mapDeckSide,
  maxCardWidthPercentageForDeck, toDeckCardPosition, unusedCardsStripMaxWidth,
} from "./geometry";
import type { BoardLayoutInput } from "./geometry";

const baseInput: BoardLayoutInput = {
  containerWidth: 1000,
  cardWidthPercentage: 0.08,
  deckRows: 3,
  deckColumns: 8,
  isMelee: false,
  isCPU: false,
  isServer: false,
  isServerClientObserver: false,
  isNoOpponent: true,
  isSelectingCards: true,
  isObserver: false,
  players: [{ name: "Player", isObserver: false }],
};

function layout(overrides: Partial<BoardLayoutInput> = {}) {
  return computeBoardLayout({ ...baseInput, ...overrides });
}

describe("computeBoardLayout", () => {
  it("derives card and deck sizes from the container width", () => {
    const l = layout();

    expect(l.canvasWidth).toBe(1000);
    expect(l.cardWidth).toBeCloseTo(80);
    expect(l.cardHeight).toBeCloseTo(80 / (703 / 1000));
    expect(l.deckWidth).toBeCloseTo(8 * 80 + 7 * CanvasSpacing);
    expect(l.deckHeight).toBeCloseTo(3 * l.cardHeight + 2 * CanvasSpacing);
    expect(l.deckLeft).toBeCloseTo((1000 - l.deckWidth) / 2);
    expect(l.deckRight).toBeCloseTo(l.deckLeft + l.deckWidth);
  });

  it("falls back to 800px when the container has no width yet", () => {
    expect(layout({ containerWidth: 0 }).canvasWidth).toBe(800);
  });

  it("stacks the board from scratch in single-player practice", () => {
    const l = layout();

    expect(l.showPlayerName).toBe(false);
    expect(l.showOpponentName).toBe(false);
    expect(l.showOpponentDeck).toBe(false);
    expect(l.showOpponentCollected).toBe(false);
    expect(l.showPlayerCollected).toBe(false);

    expect(l.opponentCollectedTop).toBe(CanvasMargin);
    expect(l.opponentDeckTop).toBe(CanvasMargin);
    expect(l.middleBarTop).toBe(CanvasMargin);
    expect(l.playerDeckTop).toBe(l.middleBarBottom + CanvasSpacing);
    expect(l.playerNameTop).toBe(l.playerDeckBottom + CanvasMargin);
    expect(l.baseCanvasHeight).toBe(l.playerCollectedBottom + CanvasMargin);
  });

  it("reserves a tall middle bar while selecting cards and a short one afterwards", () => {
    const selecting = layout({ isSelectingCards: true });
    const playing = layout({ isSelectingCards: false });

    expect(selecting.middleBarHeight).toBeCloseTo(
      HoverRaiseHeight + selecting.cardHeight + CanvasSpacing + 28,
    );
    expect(playing.middleBarHeight).toBe(80);
    expect(playing.is1v1).toBe(false);
  });

  it("shows the opponent deck in a CPU match but keeps player name plates hidden", () => {
    const l = layout({ isCPU: true, isNoOpponent: false, isSelectingCards: false });

    expect(l.showOpponentDeck).toBe(true);
    // name plates only exist for remote matches; versus the CPU the columns stand in for them
    expect(l.showPlayerName).toBe(false);
    expect(l.showOpponentName).toBe(false);
    expect(l.showOpponentCollected).toBe(true);
    expect(l.showPlayerCollected).toBe(true);
    expect(l.is1v1).toBe(true);
    // isMelee is false, so the name row falls back to the 50px remote-opponent gap
    expect(l.playerNameTop).toBeCloseTo(l.playerDeckBottom + 50);
  });

  it("counts opponents and collects observer names", () => {
    const l = layout({
      isNoOpponent: false,
      isServerClientObserver: true,
      players: [
        { name: "Me", isObserver: false },
        { name: "Rival", isObserver: false },
        { name: "Third", isObserver: false },
        { name: "Watcher", isObserver: true },
        { name: "Peeker", isObserver: true },
      ],
      isMelee: true,
    });

    expect(l.opponentCount).toBe(2);
    expect(l.observerNames).toEqual(["Watcher", "Peeker"]);
    expect(l.is1v1).toBe(false);
    expect(l.selfOnNearSide).toBe(true);
  });

  it("hides the opponent name row in a melee where I am an observer", () => {
    const l = layout({
      isServerClientObserver: true,
      isMelee: true,
      isObserver: true,
      isSelectingCards: true,
      isNoOpponent: false,
      players: [
        { name: "P0", isObserver: false },
        { name: "P1", isObserver: false },
        { name: "P2", isObserver: false },
        { name: "Me", isObserver: true },
      ],
    });

    expect(l.showOpponentName).toBe(false);
    expect(l.showPlayerName).toBe(true);
  });

  it("clamps the canvas width fallback and keeps every band above the previous one", () => {
    const l = layout({ isCPU: true, isNoOpponent: false, isSelectingCards: false });

    expect(l.opponentCollectedBottom).toBeGreaterThan(l.opponentCollectedTop);
    expect(l.opponentNameTop).toBeGreaterThanOrEqual(l.opponentCollectedBottom);
    expect(l.opponentDeckTop).toBeGreaterThanOrEqual(l.opponentNameBottom);
    expect(l.middleBarTop).toBeGreaterThanOrEqual(l.opponentDeckBottom);
    expect(l.playerDeckTop).toBeGreaterThan(l.middleBarBottom);
    expect(l.playerCollectedBottom).toBeGreaterThan(l.playerNameBottom);
  });
});

describe("mapDeckSide", () => {
  it("is the identity when the self deck is the near deck", () => {
    expect(mapDeckSide(0, true)).toBe(0);
    expect(mapDeckSide(1, true)).toBe(1);
  });

  it("mirrors when the self deck is the far deck", () => {
    expect(mapDeckSide(0, false)).toBe(1);
    expect(mapDeckSide(1, false)).toBe(0);
  });

  it("is its own inverse", () => {
    for (const selfOnNearSide of [true, false]) {
      for (const index of [0, 1] as const) {
        expect(mapDeckSide(mapDeckSide(index, selfOnNearSide), selfOnNearSide)).toBe(index);
      }
    }
  });
});

describe("toDeckCardPosition", () => {
  it("lays the near deck out left-to-right, top-to-bottom", () => {
    const l = layout();
    const stride = { x: l.cardWidth + CanvasSpacing, y: l.cardHeight + CanvasSpacing };

    expect(toDeckCardPosition(l, 0, 0)).toEqual({ x: l.deckLeft, y: l.playerDeckTop });
    expect(toDeckCardPosition(l, 0, 1)).toEqual({ x: l.deckLeft + stride.x, y: l.playerDeckTop });
    expect(toDeckCardPosition(l, 0, l.deckColumns)).toEqual({ x: l.deckLeft, y: l.playerDeckTop + stride.y });
  });

  it("mirrors the far deck so card 0 sits at its bottom-right", () => {
    const l = layout({ isCPU: true, isNoOpponent: false });
    const stride = { x: l.cardWidth + CanvasSpacing, y: l.cardHeight + CanvasSpacing };

    expect(toDeckCardPosition(l, 1, 0)).toEqual({
      x: l.deckLeft + (l.deckColumns - 1) * stride.x,
      y: l.opponentDeckTop + (l.deckRows - 1) * stride.y,
    });
  });

  it("round-trips through canvasPositionToDeckPosition", () => {
    const l = layout({ isCPU: true, isNoOpponent: false });
    for (const cardIndex of [0, 3, 7, 12, 23]) {
      const position = toDeckCardPosition(l, 0, cardIndex);
      expect(canvasPositionToDeckPosition(l, position.x + 1, position.y + 1, [0])).toEqual({
        deckIndex: 0, cardIndex,
      });

      const farPosition = toDeckCardPosition(l, 1, cardIndex);
      const hit = canvasPositionToDeckPosition(l, farPosition.x + 1, farPosition.y + 1, [0, 1]);
      expect(hit).toEqual({ deckIndex: 1, cardIndex });
    }
  });
});

describe("canvasPositionToDeckPosition", () => {
  it("returns null outside the deck area", () => {
    const l = layout();
    expect(canvasPositionToDeckPosition(l, 0, 0)).toBeNull();
    expect(canvasPositionToDeckPosition(l, l.deckLeft - 5, l.playerDeckTop)).toBeNull();
    expect(canvasPositionToDeckPosition(l, l.deckLeft, l.playerDeckTop + l.deckHeight + 5)).toBeNull();
  });

  it("returns null in the gaps between cards", () => {
    const l = layout();
    // a point inside the grid but in the padding column after the first card
    const x = l.deckLeft + l.cardWidth + CanvasSpacing / 2;
    expect(canvasPositionToDeckPosition(l, x, l.playerDeckTop + 1, [0])).toBeNull();
  });

  it("never hits the far deck when it is hidden", () => {
    const l = layout();
    expect(l.showOpponentDeck).toBe(false);
    expect(canvasPositionToDeckPosition(l, l.deckLeft + 1, 20, [0, 1])).toBeNull();
  });

  it("respects the allowed deck list", () => {
    const l = layout({ isCPU: true, isNoOpponent: false });
    const farPoint = toDeckCardPosition(l, 1, 0);
    expect(canvasPositionToDeckPosition(l, farPoint.x + 1, farPoint.y + 1, [0])).toBeNull();
    expect(canvasPositionToDeckPosition(l, farPoint.x + 1, farPoint.y + 1, [1])).toEqual({
      deckIndex: 1, cardIndex: 0,
    });
  });
});

describe("computeUnusedCardsStrip", () => {
  const flags = { isServerClientObserver: false, isMelee: false, isSelectingCards: true };

  it("sits along the bottom of the player deck in practice mode", () => {
    const l = layout();
    const strip = computeUnusedCardsStrip(l, 5, flags);

    expect(strip.yBase).toBe(l.playerDeckTop + l.deckHeight - l.cardHeight);
    expect(strip.requiredCanvasHeight).toBe(strip.bottom + 25 + CanvasMargin);
    expect(unusedCardsStripMaxWidth(l)).toBe(l.cardWidth + 50);
  });

  it("caps the space it claims to card width plus 50", () => {
    const l = layout({ containerWidth: 4000 });
    const strip = computeUnusedCardsStrip(l, 5, flags);
    expect(strip.totalWidth).toBe(unusedCardsStripMaxWidth(l));
  });

  it("caps the per-card offset at 5px", () => {
    const l = layout();
    const strip = computeUnusedCardsStrip(l, 3, flags);
    expect(strip.step).toBeLessThanOrEqual(5);
  });

  it("moves into the middle bar for a remote observer during gameplay", () => {
    const l = layout({
      isServerClientObserver: true, isNoOpponent: false, isSelectingCards: false,
    });
    const strip = computeUnusedCardsStrip(l, 4, {
      isServerClientObserver: true, isMelee: false, isSelectingCards: false,
    });

    expect(strip.yBase).toBe(l.middleBarBottom - l.cardHeight - 40);
  });
});

describe("computeDeckColumnVisibility", () => {
  it("shows only the card-size buttons and the mode switch to an observer", () => {
    const visible = computeDeckColumnVisibility({
      isSelectingCards: true, isTurnCountdownNext: false, isObserver: true,
    });

    expect(visible.cardSmaller).toBe(true);
    expect(visible.cardLarger).toBe(true);
    expect(visible.start).toBe(false);
    expect(visible.randomFill).toBe(false);
    // an observer still needs a way back out of observer mode
    expect(visible.switchOpponent).toBe(true);
  });

  it("shows deck editing controls only while selecting cards", () => {
    const selecting = computeDeckColumnVisibility({
      isSelectingCards: true, isTurnCountdownNext: false, isObserver: false,
    });
    const playing = computeDeckColumnVisibility({
      isSelectingCards: false, isTurnCountdownNext: false, isObserver: false,
    });

    expect(selecting.randomFill).toBe(true);
    expect(selecting.start).toBe(true);
    expect(playing.randomFill).toBe(false);
    // the start button doubles as the stop button during a match
    expect(playing.start).toBe(true);
    expect(playing.filterByDeck).toBe(true);
  });

  it("hides the music filter during the between-turn countdown", () => {
    expect(computeDeckColumnVisibility({
      isSelectingCards: false, isTurnCountdownNext: true, isObserver: false,
    }).filterByDeck).toBe(false);
  });
});

describe("computeDeckColumnLayout", () => {
  it("advances by one button stride per visible button", () => {
    const l = layout();
    const stride = l.buttonSize + CanvasSpacing;
    const all = computeDeckColumnVisibility({
      isSelectingCards: true, isTurnCountdownNext: false, isObserver: false,
    });

    const { positions, bottomY } = computeDeckColumnLayout(l, all);
    expect(positions.cardSmaller).toBe(l.playerDeckTop);
    expect(positions.cardLarger).toBe(l.playerDeckTop + stride);
    // the music filter is hidden while selecting, so the start button reuses its slot
    expect(positions.filterByDeck).toBe(positions.start);
    expect(bottomY).toBeGreaterThan(l.playerDeckTop);
    // 9 visible buttons advance the cursor
    expect(bottomY).toBe(l.playerDeckTop + stride * 9);
  });

  it("stacks only the visible buttons, leaving no gaps", () => {
    const l = layout();
    const stride = l.buttonSize + CanvasSpacing;
    const visible = computeDeckColumnVisibility({
      isSelectingCards: false, isTurnCountdownNext: false, isObserver: false,
    });

    const { positions } = computeDeckColumnLayout(l, visible);
    // while playing: smaller, larger, filter, start, switch opponent
    expect(positions.start).toBe(l.playerDeckTop + stride * 3);
    expect(positions.switchOpponent).toBe(l.playerDeckTop + stride * 4);
  });

  it("pins the row controls to the bottom of the deck when there is room", () => {
    const l = layout({ deckRows: 5, deckColumns: 15 });
    const stride = l.buttonSize + CanvasSpacing;
    const visible = computeDeckColumnVisibility({
      isSelectingCards: true, isTurnCountdownNext: false, isObserver: false,
    });
    const pinnedY = l.playerDeckTop + l.deckHeight - l.buttonSize * 2 - CanvasSpacing;

    // 2 size + start + 3 deck buttons + switch = 7 strides before the row controls
    const { positions, bottomY } = computeDeckColumnLayout(l, visible);
    expect(positions.removeRow).toBe(pinnedY);
    expect(positions.addRow).toBe(pinnedY + stride);
    expect(bottomY).toBe(pinnedY + stride * 2);
  });

  it("ignores the pinned row for viewers who cannot edit the deck", () => {
    const l = layout({ deckRows: 5, deckColumns: 15 });
    const stride = l.buttonSize + CanvasSpacing;
    const visible = computeDeckColumnVisibility({
      isSelectingCards: false, isTurnCountdownNext: false, isObserver: true,
    });

    const { bottomY } = computeDeckColumnLayout(l, visible);
    // an observer only sees the two card-size buttons and the mode switch
    expect(bottomY).toBe(l.playerDeckTop + stride * 3);
  });
});

describe("small helpers", () => {
  it("growCanvasHeight only ever grows", () => {
    expect(growCanvasHeight(100, 50)).toBe(100);
    expect(growCanvasHeight(100, 150)).toBe(150);
  });

  it("builds a transition string covering every animated property", () => {
    const transition = getCardTransitionString("0.3s");
    expect(transition).toBe(
      "top 0.3s, left 0.3s, transform 0.3s, background-color 0.3s, width 0.3s, height 0.3s",
    );
  });

  it("splits the allowed deck width over the columns", () => {
    // 15 columns is the widest deck the controls allow, and its share stays above the minimum
    expect(maxCardWidthPercentageForDeck(1)).toBeCloseTo(MaxCardWidthTotalPercentage);
    expect(maxCardWidthPercentageForDeck(8)).toBeCloseTo(MaxCardWidthTotalPercentage / 8);
    expect(maxCardWidthPercentageForDeck(MaxDeckColumns)).toBeGreaterThan(CardWidthPercentageMin);
    expect(maxCardWidthPercentageForDeck(MaxDeckColumns) * MaxDeckColumns).toBeCloseTo(
      MaxCardWidthTotalPercentage,
    );
  });

  it("stops the larger card button at the tighter of the user ceiling and the deck's row", () => {
    // a narrow deck leaves the user ceiling in charge
    expect(cardWidthPercentageLimit(1)).toBeCloseTo(CardWidthPercentageMax);
    expect(cardWidthPercentageLimit(2)).toBeCloseTo(CardWidthPercentageMax);
    // once the deck's share drops below the ceiling it becomes the limit the button stops at
    expect(cardWidthPercentageLimit(3)).toBeCloseTo(MaxCardWidthTotalPercentage / 3);
    expect(cardWidthPercentageLimit(MaxDeckColumns)).toBeCloseTo(
      MaxCardWidthTotalPercentage / MaxDeckColumns,
    );
    expect(cardWidthPercentageLimit(3)).toBeLessThan(CardWidthPercentageMax);

    // the limit is what clamping converges to, so a card at the limit cannot be grown
    for (const columns of [1, 2, 3, 8, MaxDeckColumns]) {
      const limit = cardWidthPercentageLimit(columns);
      expect(clampCardWidthPercentage(limit, columns)).toBeCloseTo(limit);
      expect(clampCardWidthPercentage(limit + 0.01, columns)).toBeCloseTo(limit);
    }
  });

  it("keeps a card width inside both the user range and the deck's row", () => {
    // two columns leave room for the full user range, so only that range applies
    expect(clampCardWidthPercentage(0.20, 2)).toBeCloseTo(0.20);
    expect(clampCardWidthPercentage(0.60, 2)).toBeCloseTo(CardWidthPercentageMax);
    expect(clampCardWidthPercentage(0.01, 2)).toBeCloseTo(CardWidthPercentageMin);

    // wide deck: the deck's share is the tighter limit, so the row never overflows
    expect(clampCardWidthPercentage(0.20, MaxDeckColumns)).toBeCloseTo(
      MaxCardWidthTotalPercentage / MaxDeckColumns,
    );
    expect(clampCardWidthPercentage(0.30, 10) * 10).toBeCloseTo(MaxCardWidthTotalPercentage);
    expect(clampCardWidthPercentage(CardWidthPercentageMin, MaxDeckColumns))
      .toBeCloseTo(CardWidthPercentageMin);

    // re-applying it never drifts, so a repeated deck change cannot shrink the cards away
    const once = clampCardWidthPercentage(0.35, 12);
    expect(clampCardWidthPercentage(once, 12)).toBeCloseTo(once);
  });
});
