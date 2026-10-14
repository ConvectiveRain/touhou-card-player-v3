import { CharacterId } from "./Configs";

/**
 * Shared value types for the game domain. Kept separate from GameJudge so transport
 * (GamePeer) and rules (GameJudge) can depend on them without depending on each other.
 */

// 0 is always the server; >0 is any client or the CPU opponent.
export type Player = number;

export enum GameJudgeState {
  SelectingCards,
  TurnStart,
  TurnWinnerDetermined,
  TurnCountdownNext,
  GameFinished,
}

export enum MatchType {
  None,
  CPU,
  Server,
  Client,
  Observer,
}

export class CardInfo {
  characterId: CharacterId | null;
  cardIndex: number;
  constructor(characterId: CharacterId | null, cardIndex: number) {
    this.characterId = characterId;
    this.cardIndex = cardIndex;
  }
  equals(other: CardInfo): boolean {
    return this.characterId === other.characterId && this.cardIndex === other.cardIndex;
  }
  toKey(): string {
    return `${this.characterId}-${this.cardIndex}`;
  }
}

/** Which of the two deck areas a card sits in: 0 is the near side, 1 the far side. */
export type DeckPosition = { deckIndex: 0 | 1, cardIndex: number };

export class PickEvent {
  timestamp: number;
  player: Player;
  cardInfo: CardInfo;
  deckPosition: DeckPosition;

  constructor(
    timestamp: number, player: Player, cardInfo: CardInfo, deckPosition: DeckPosition
  ) {
    this.timestamp = timestamp;
    this.player = player;
    this.cardInfo = cardInfo;
    this.deckPosition = deckPosition;
  }

  characterId(): CharacterId { return this.cardInfo.characterId!; }
}

export type SendOption = {
  send: boolean;
  except: number | null;
}

export const DontSend = <SendOption>{ send: false, except: null };
export const SendToAll = <SendOption>{ send: true, except: null };

export type PlayerInfo = {
  name: string;
  isObserver: boolean;
  confirmation: {
    start: boolean;
    next: boolean;
  };
  deck: Array<CardInfo>;
  collected: Array<CardInfo>;
}
