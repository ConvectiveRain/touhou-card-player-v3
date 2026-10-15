import { describe, expect, it } from "vitest";
import { CardInfo, GameJudge, GameJudgeState, MatchType } from "../../types/GameJudge";
import { GetLocalizedString, Localization } from "../../types/Localization";
import type { LocalizedString } from "../../types/Localization";
import { createTestOuterRef } from "../../test/fixtures";
import {
  computeNextTurnButton, computeNextTurnInstruction, computeOpponentButton,
  computeStartButton, localPlayerGives, localPlayerReceives,
} from "./gameButtonModels";

const noClick = () => {};

function newJudge(matchType: MatchType = MatchType.None) {
  const judge = new GameJudge(createTestOuterRef());
  judge.matchType = matchType;
  return judge;
}

/** Adds one card so `isGameFinished()` stays false for a single-player game. */
function fillDeck(judge: GameJudge, player = 0, characterId = "alice") {
  judge.addToDeck(player, new CardInfo(characterId, 0), 0, { send: false, except: null });
}

describe("computeStartButton", () => {
  it("keeps start disabled while the lineup is invalid", () => {
    const judge = newJudge(MatchType.CPU);
    fillDeck(judge);
    const model = computeStartButton(judge, {
      canStartGame: false, isServerClientObserver: false, isSelectingCards: true, onClick: noClick,
    });

    expect(model.text).toBe(GetLocalizedString(Localization.GameStart));
    expect(model.disabled).toBe(true);
    expect(model.contained).toBe(false);
    expect(model.isStopGame).toBe(false);
    expect(model.color).toBe("primary");
  });

  it("drops the emphasis once there is nothing left to play", () => {
    // a single-player game with an empty deck is already over, so start is not the primary action
    const model = computeStartButton(newJudge(), {
      canStartGame: true, isServerClientObserver: false, isSelectingCards: true, onClick: noClick,
    });

    expect(model.isGameFinished).toBe(true);
    expect(model.text).toBe(GetLocalizedString(Localization.GameStart));
    expect(model.color).toBe("secondary");
  });

  it("becomes the stop button once the game is running", () => {
    const judge = newJudge();
    fillDeck(judge);
    judge.state = GameJudgeState.TurnStart;

    const model = computeStartButton(judge, {
      canStartGame: false, isServerClientObserver: false, isSelectingCards: false, onClick: noClick,
    });

    expect(model.isStopGame).toBe(true);
    expect(model.text).toBe(GetLocalizedString(Localization.GameStop));
    expect(model.disabled).toBe(false);
  });

  it("shows the finish label when the deck runs out", () => {
    const judge = newJudge();
    judge.state = GameJudgeState.TurnStart;

    const model = computeStartButton(judge, {
      canStartGame: false, isServerClientObserver: false, isSelectingCards: false, onClick: noClick,
    });

    expect(model.isGameFinished).toBe(true);
    expect(model.text).toBe(GetLocalizedString(Localization.GameFinish));
    expect(model.color).toBe("secondary");
  });

  it("makes the server hold until it has confirmed its own start", () => {
    const judge = newJudge(MatchType.Server);
    judge.addPlayer("Client", true);
    judge.players[1].isObserver = false;
    fillDeck(judge);
    fillDeck(judge, 1, "marisa");
    judge.players[1].confirmation.start = true;

    const options = {
      canStartGame: true, isServerClientObserver: true, isSelectingCards: true, onClick: noClick,
    };
    const waiting = computeStartButton(judge, options);
    expect(waiting.contained).toBe(true);
    expect(waiting.color).toBe("info");
    expect(waiting.disabled).toBe(false);
    expect(waiting.text).toBe(GetLocalizedString(Localization.GameStart));

    judge.players[0].confirmation.start = true;
    const done = computeStartButton(judge, options);
    expect(done.text).toBe(GetLocalizedString(Localization.GameStartWaitingForOpponent));
    expect(done.disabled).toBe(true);
  });

  it("disables start while a client waits for the server's acknowledgement", () => {
    const judge = newJudge(MatchType.Client);
    fillDeck(judge);
    judge.clientWaitAcknowledge = true;

    const model = computeStartButton(judge, {
      canStartGame: true, isServerClientObserver: true, isSelectingCards: true, onClick: noClick,
    });

    expect(model.disabled).toBe(true);
  });
});

describe("computeOpponentButton", () => {
  it("names the current mode and flags the network modes", () => {
    const cases: Array<[MatchType, LocalizedString, boolean]> = [
      [MatchType.None, Localization.GameOpponentNoOpponent, false],
      [MatchType.CPU, Localization.GameOpponentCPUOpponent, false],
      [MatchType.Server, Localization.GameOpponentRemoteAsServer, true],
      [MatchType.Client, Localization.GameOpponentRemoteAsClient, true],
      [MatchType.Observer, Localization.GameOpponentRemoteAsObserver, true],
    ];

    for (const [matchType, expected, isServerClientObserver] of cases) {
      const model = computeOpponentButton(newJudge(matchType), noClick);
      expect(model.text).toBe(GetLocalizedString(expected));
      expect(model.matchType).toBe(matchType);
      expect(model.isServerClientObserver).toBe(isServerClientObserver);
      expect(model.onClick).toBe(noClick);
    }
  });
});

describe("localPlayerGives / localPlayerReceives", () => {
  const cases: Array<[number, MatchType, boolean, boolean, boolean]> = [
    // givesLeft, mode, isCPU, gives, receives
    [2, MatchType.Server, false, true, false],
    [2, MatchType.Client, false, false, true],
    [2, MatchType.None, true, true, false],
    [-2, MatchType.Server, false, false, true],
    [-2, MatchType.Client, false, true, false],
    [-2, MatchType.None, true, false, true],
    [0, MatchType.Server, false, false, false],
    [0, MatchType.Client, true, false, false],
  ];

  it("assigns the giving side from the sign of givesLeft and the local mode", () => {
    for (const [givesLeft, matchType, isCPU, gives, receives] of cases) {
      const judge = newJudge(matchType);
      judge.givesLeft = givesLeft;

      expect(localPlayerGives(judge, isCPU)).toBe(gives);
      expect(localPlayerReceives(judge, isCPU)).toBe(receives);
    }
  });
});

describe("computeNextTurnButton", () => {
  it("is hidden while building a lineup and for observers", () => {
    const judge = newJudge();
    const hidden = computeNextTurnButton(judge, { isCPU: false, isServerClientObserver: false });
    expect(hidden.hidden).toBe(true);

    judge.state = GameJudgeState.TurnStart;
    const shown = computeNextTurnButton(judge, { isCPU: false, isServerClientObserver: false });
    expect(shown.hidden).toBe(false);

    judge.matchType = MatchType.Observer;
    const observer = computeNextTurnButton(judge, { isCPU: false, isServerClientObserver: true });
    expect(observer.hidden).toBe(true);
  });

  it("asks the local side to hand cards over", () => {
    const judge = newJudge(MatchType.CPU);
    judge.state = GameJudgeState.TurnWinnerDetermined;
    judge.givesLeft = 2;

    const model = computeNextTurnButton(judge, { isCPU: true, isServerClientObserver: false });

    expect(model.text).toBe(GetLocalizedString(Localization.GameNextTurnGiveCards, new Map([
      ["givesLeft", "2"], ["plural", "s"],
    ])));
    expect(model.icon).toBe("shuffle");
    expect(model.disabled).toBe(false);
  });

  it("waits for the other side while receiving", () => {
    const judge = newJudge(MatchType.CPU);
    judge.state = GameJudgeState.TurnWinnerDetermined;
    judge.givesLeft = -1;

    const model = computeNextTurnButton(judge, { isCPU: true, isServerClientObserver: false });

    expect(model.text).toBe(GetLocalizedString(Localization.GameNextTurnReceiveCards, new Map([
      ["receives", "1"], ["plural", ""],
    ])));
    expect(model.icon).toBe("pending");
    // the CPU hands its cards over on its own; a human opponent does not
    expect(model.disabled).toBe(false);

    const pvp = newJudge(MatchType.Server);
    pvp.state = GameJudgeState.TurnWinnerDetermined;
    pvp.givesLeft = -1;
    expect(computeNextTurnButton(pvp, { isCPU: false, isServerClientObserver: false }).disabled).toBe(true);
  });

  it("reports a finished game and a running countdown", () => {
    const judge = newJudge();
    judge.state = GameJudgeState.TurnStart;
    const finished = computeNextTurnButton(judge, { isCPU: false, isServerClientObserver: false });
    expect(finished.text).toBe(GetLocalizedString(Localization.GameNextTurnGameFinished));
    expect(finished.icon).toBe("finished");
    expect(finished.disabled).toBe(true);

    fillDeck(judge);
    judge.state = GameJudgeState.TurnCountdownNext;
    const counting = computeNextTurnButton(judge, { isCPU: false, isServerClientObserver: false });
    expect(counting.disabled).toBe(true);
    expect(counting.icon).toBe("skip");
  });

  it("runs the confirm-opponent flow for the server", () => {
    const judge = newJudge(MatchType.Server);
    judge.addPlayer("Client", true);
    judge.players[1].isObserver = false;
    fillDeck(judge);
    fillDeck(judge, 1, "marisa");
    judge.state = GameJudgeState.TurnStart;
    const options = { isCPU: false, isServerClientObserver: true };

    expect(computeNextTurnButton(judge, options).contained).toBe(false);

    judge.players[1].confirmation.next = true;
    const waiting = computeNextTurnButton(judge, options);
    expect(waiting.contained).toBe(true);
    expect(waiting.text).toBe(GetLocalizedString(Localization.GameNextTurnOpponentWaiting));
    expect(waiting.disabled).toBe(false);

    judge.players[0].confirmation.next = true;
    const done = computeNextTurnButton(judge, options);
    expect(done.text).toBe(GetLocalizedString(Localization.GameNextTurnWaitingForOpponent));
    expect(done.disabled).toBe(true);
  });
});

describe("computeNextTurnInstruction", () => {
  it("says nothing when no cards change hands or the game is over", () => {
    const judge = newJudge(MatchType.CPU);
    expect(computeNextTurnInstruction(judge, { isCPU: true })).toBe("");

    judge.givesLeft = 2;
    expect(computeNextTurnInstruction(judge, { isCPU: true })).not.toBe("");

    // a single-player game is over as soon as its deck runs out, even mid-give
    const finished = newJudge();
    finished.givesLeft = 2;
    expect(finished.isGameFinished()).toBe(true);
    expect(computeNextTurnInstruction(finished, { isCPU: true })).toBe("");
  });

  it("tells the giving side how many cards to hand over", () => {
    const judge = newJudge(MatchType.Server);
    judge.givesLeft = 3;

    expect(computeNextTurnInstruction(judge, { isCPU: false })).toBe(
      GetLocalizedString(Localization.GameInstructionGiveCards, new Map([
        ["givesLeft", "3"], ["plural", "s"],
      ])),
    );
  });

  it("uses a different wording when the CPU is handing cards over", () => {
    const cpu = newJudge(MatchType.CPU);
    cpu.givesLeft = -1;
    expect(computeNextTurnInstruction(cpu, { isCPU: true })).toBe(
      GetLocalizedString(Localization.GameInstructionReceiveCardsCPU, new Map([
        ["receives", "1"], ["plural", ""],
      ])),
    );

    const client = newJudge(MatchType.Client);
    client.givesLeft = 1;
    expect(computeNextTurnInstruction(client, { isCPU: false })).toBe(
      GetLocalizedString(Localization.GameInstructionReceiveCards, new Map([
        ["receives", "1"], ["plural", ""],
      ])),
    );
  });

  it("names the giver and the receiver for observers", () => {
    const judge = newJudge(MatchType.Observer);
    judge.addPlayer("Bob", true);
    judge.players[0].name = "Alice";
    judge.players[1].name = "Bob";
    judge.givesLeft = -2;

    expect(computeNextTurnInstruction(judge, { isCPU: false })).toBe(
      GetLocalizedString(Localization.GameInstructionObserverGive, new Map([
        ["giver", "Bob"], ["receiver", "Alice"], ["givesLeft", "2"], ["plural", "s"],
      ])),
    );
  });
});
