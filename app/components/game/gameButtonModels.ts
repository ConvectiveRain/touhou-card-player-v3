import { GameJudgeState, MatchType } from "../../types/GameTypes";
import type { GameJudge } from "../../types/GameJudge";
import { GetLocalizedString, Localization } from "../../types/Localization";

/**
 * The button models the board renders. They are rules-shaped ("can this be pressed, and what
 * does it say") rather than layout-shaped, so they live here as pure functions of the judge
 * instead of being spread between the session hook and the middle bar component.
 */

export type StartButtonModel = {
  text: string;
  disabled: boolean;
  /** True while the player waits for the other side to confirm. */
  contained: boolean;
  color: "primary" | "secondary" | "info";
  isStopGame: boolean;
  isGameFinished: boolean;
  onClick: () => void;
};

export type OpponentButtonModel = {
  text: string;
  matchType: MatchType;
  isServerClientObserver: boolean;
  onClick: () => void;
};

export type NextTurnIcon = "skip" | "pending" | "finished" | "shuffle";

export type NextTurnButtonModel = {
  text: string;
  disabled: boolean;
  contained: boolean;
  icon: NextTurnIcon;
  hidden: boolean;
};

export function computeStartButton(
  judge: GameJudge,
  options: {
    canStartGame: boolean;
    isServerClientObserver: boolean;
    isSelectingCards: boolean;
    onClick: () => void;
  },
): StartButtonModel {
  const { canStartGame, isServerClientObserver, isSelectingCards, onClick } = options;
  const isStopGame = !isSelectingCards;
  let disabled = (!isStopGame && !canStartGame) || (judge.isClient() && judge.clientWaitAcknowledge);
  const contained = !isStopGame && isSelectingCards && isServerClientObserver
    && judge.checkAnyStartConfirmed();
  let text = isStopGame
    ? GetLocalizedString(Localization.GameStop)
    : GetLocalizedString(Localization.GameStart);
  if (contained) {
    if (judge.players[judge.myPlayerIndex].confirmation.start) {
      text = GetLocalizedString(Localization.GameStartWaitingForOpponent);
      disabled = true;
    } else {
      text = GetLocalizedString(Localization.GameStart);
    }
  }
  const isGameFinished = judge.isGameFinished();
  if (!isSelectingCards && isGameFinished) {
    text = GetLocalizedString(Localization.GameFinish);
  }
  return {
    text,
    disabled,
    contained,
    color: !isGameFinished ? (contained ? "info" : "primary") : "secondary",
    isStopGame,
    isGameFinished,
    onClick,
  };
}

export function computeOpponentButton(judge: GameJudge, onClick: () => void): OpponentButtonModel {
  const text = (() => {
    switch (judge.matchType) {
      case MatchType.None: return GetLocalizedString(Localization.GameOpponentNoOpponent);
      case MatchType.CPU: return GetLocalizedString(Localization.GameOpponentCPUOpponent);
      case MatchType.Server: return GetLocalizedString(Localization.GameOpponentRemoteAsServer);
      case MatchType.Client: return GetLocalizedString(Localization.GameOpponentRemoteAsClient);
      default: return GetLocalizedString(Localization.GameOpponentRemoteAsObserver);
    }
  })();
  return {
    text,
    matchType: judge.matchType,
    isServerClientObserver: judge.isServerClientObserverMode(),
    onClick,
  };
}

/** True when the local side is the one handing cards over this turn. */
export function localPlayerGives(judge: GameJudge, isCPU: boolean): boolean {
  return (judge.givesLeft > 0 && (judge.isServer() || isCPU))
    || (judge.givesLeft < 0 && judge.isClient());
}

/** True when the local side is waiting to receive cards this turn. */
export function localPlayerReceives(judge: GameJudge, isCPU: boolean): boolean {
  return (judge.givesLeft < 0 && (judge.isServer() || isCPU))
    || (judge.givesLeft > 0 && judge.isClient());
}

export function computeNextTurnButton(
  judge: GameJudge,
  options: { isCPU: boolean; isServerClientObserver: boolean },
): NextTurnButtonModel {
  const { isCPU, isServerClientObserver } = options;
  const shown = judge.state !== GameJudgeState.SelectingCards;

  let disabled = false;
  const contained = isServerClientObserver && judge.checkAnyNextConfirmed();
  let icon: NextTurnIcon = "skip";
  let text = "";
  if (contained) {
    if (!judge.players[judge.myPlayerIndex].confirmation.next) {
      text = GetLocalizedString(Localization.GameNextTurnOpponentWaiting);
    } else {
      text = GetLocalizedString(Localization.GameNextTurnWaitingForOpponent);
      disabled = true;
    }
  }

  const giveCount = localPlayerGives(judge, isCPU) ? Math.abs(judge.givesLeft) : 0;
  const receiveCount = localPlayerReceives(judge, isCPU) ? Math.abs(judge.givesLeft) : 0;
  if (judge.state === GameJudgeState.TurnWinnerDetermined && giveCount > 0) {
    text = GetLocalizedString(Localization.GameNextTurnGiveCards, new Map<string, string>([
      ["givesLeft", giveCount.toString()],
      ["plural", giveCount > 1 ? "s" : ""],
    ]));
    icon = "shuffle";
  }
  if (judge.state === GameJudgeState.TurnWinnerDetermined && receiveCount > 0) {
    text = GetLocalizedString(Localization.GameNextTurnReceiveCards, new Map<string, string>([
      ["receives", receiveCount.toString()],
      ["plural", receiveCount > 1 ? "s" : ""],
    ]));
    if (!isCPU) { disabled = true; }
    icon = "pending";
  }
  if (judge.isGameFinished()) {
    disabled = true;
    text = GetLocalizedString(Localization.GameNextTurnGameFinished);
    icon = "finished";
  }
  if (judge.state === GameJudgeState.TurnCountdownNext) { disabled = true; }

  return { text, disabled, contained, icon, hidden: !shown || judge.isObserver() };
}

/** The line of instruction shown next to the next-turn button while cards change hands. */
export function computeNextTurnInstruction(
  judge: GameJudge,
  options: { isCPU: boolean },
): string {
  const { isCPU } = options;
  if (judge.givesLeft === 0 || judge.isGameFinished()) { return ""; }

  const givesLeft = Math.abs(judge.givesLeft);
  const substitutions = new Map<string, string>([
    ["givesLeft", givesLeft.toString()],
    ["receives", givesLeft.toString()],
    ["plural", givesLeft > 1 ? "s" : ""],
  ]);

  if (localPlayerGives(judge, isCPU)) {
    return GetLocalizedString(Localization.GameInstructionGiveCards, substitutions);
  }
  if (localPlayerReceives(judge, isCPU)) {
    return isCPU
      ? GetLocalizedString(Localization.GameInstructionReceiveCardsCPU, substitutions)
      : GetLocalizedString(Localization.GameInstructionReceiveCards, substitutions);
  }
  if (judge.isObserver()) {
    return GetLocalizedString(Localization.GameInstructionObserverGive, new Map<string, string>([
      ["giver", judge.givesLeft > 0 ? judge.players[0].name : judge.players[1].name],
      ["receiver", judge.givesLeft > 0 ? judge.players[1].name : judge.players[0].name],
      ["givesLeft", givesLeft.toString()],
      ["plural", givesLeft > 1 ? "s" : ""],
    ]));
  }
  return "";
}
