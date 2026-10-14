import { CharacterId } from "./Configs";
import {
  CardInfo, DeckPosition, GameJudgeState, PickEvent, Player,
} from "./GameTypes";

/**
 * The wire protocol. Every message that crosses the PeerJS data channel is one of the
 * variants of {@link Event}; `broadcastPlayerNames` and `chat` are additionally routed
 * through the outer event handler because they affect UI outside the judge.
 */

export type EventAddCard = {
  type: "addCard";
  cardInfo: CardInfo;
  deckPosition: DeckPosition;
};

export type EventRemoveCard = {
  type: "removeCard";
  deckPosition: DeckPosition;
};

export type EventAdjustDeckSize = {
  type: "adjustDeckSize";
  rows: number;
  columns: number;
};

export type EventConfirmStart = {
  type: "confirmStart";
  playerIndex: Player;
};

export type EventConfirmNext = {
  type: "confirmNext";
  playerIndex: Player;
};

export type SyncData = {
  deckRows: number;
  deckColumns: number;
  turnWinner: Player | null;
  order: Array<{
    characterId: CharacterId;
    musicSelection: number;
    temporaryDisabled: boolean;
  }>;
  pickEvents: Array<PickEvent>;
  cardStates: Array<{
    deck: Array<CardInfo>;
    collected: Array<CardInfo>;
  }>;
  currentCharacterId: CharacterId | null;
};

export type EventPickEvent = {
  type: "pickEvent";
  pickEvent: PickEvent;
};

export type EventSyncWinnerDetermined = {
  type: "syncWinnerDetermined";
  data: SyncData;
};

export type EventSyncStart = {
  type: "syncStart";
  data: SyncData;
  traditionalMode: boolean;
  randomStartPosition: boolean;
  playbackDuration: number;
  rngSeed: number;
}

export type EventChat = {
  type: "chat";
  sender: "system" | number;
  message: string;
}

export type EventRequestSyncData = {
  type: "requestSyncData";
};

export type EventSyncData = {
  type: "syncData";
  data: SyncData;
};

export type EventSyncNextTurn = {
  type: "syncNextTurn";
  data: SyncData;
  rngSeed: number;
};

export type EventStopGame = {
  type: "stopGame";
};

export type EventGive = {
  type: "give";
};

export type EventSwitchTraditionalMode = {
  type: "switchTraditionalMode";
  traditionalMode: boolean;
};

export type EventPauseMusic = {
  type: "pauseMusic";
};

export type EventResumeMusic = {
  type: "resumeMusic";
};

export type EventFilterMusicByDeck = {
  type: "filterMusicByDeck";
};

export type EventSyncSettings = {
  type: "syncSettings";
  traditionalMode: boolean;
  randomStartPosition: boolean;
  playbackDuration: number;
  deckColumns: number;
  deckRows: number;
}

export type EventNotifyName = {
  type: "notifyName";
  name: string;
  isObserver: boolean;
}

export type EventBroadcastPlayerNames = {
  type: "broadcastPlayerNames";
  settings: Array<{
    name: string;
    isObserver: boolean;
  }>;
  yourIndex: number;
  syncData: SyncData;
  state: GameJudgeState
}

export type EventClearDeck = {
  type: "clearDeck";
  player: Player;
}

export type Event = (
  EventAddCard |
  EventAdjustDeckSize |
  EventBroadcastPlayerNames |
  EventChat |
  EventClearDeck |
  EventConfirmNext |
  EventConfirmStart |
  EventFilterMusicByDeck |
  EventGive |
  EventNotifyName |
  EventPauseMusic |
  EventPickEvent |
  EventRemoveCard |
  EventRequestSyncData |
  EventResumeMusic |
  EventStopGame |
  EventSwitchTraditionalMode |
  EventSyncData |
  EventSyncNextTurn |
  EventSyncStart |
  EventSyncWinnerDetermined |
  EventSyncSettings
);

/** Every event carries a discriminant we can use for exhaustive handling. */
export type EventType = Event["type"];
