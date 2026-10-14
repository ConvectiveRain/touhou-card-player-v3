import { CharacterId, CharacterConfigMap, MusicSelectionMap } from "../types/Configs";
import { CardInfo } from "../types/GameTypes";

/**
 * The "which cards are not in the lineup" rule and the helpers that build its inputs.
 *
 * Shared by the board's render pass (so a card that just became unused is positioned in the same
 * frame it leaves the deck, keeping its transition) and by the hook that keeps the pile stable.
 */

export type UnusedCardsInput = {
  characterConfigs: CharacterConfigMap;
  playingOrder: Array<CharacterId>;
  musicSelection: MusicSelectionMap;
  /** True once a match has started (state !== SelectingCards). */
  isGameplay: boolean;
  cardInsideDeck: ReadonlySet<string>;
  cardInsideCollected: ReadonlySet<string>;
  characterInsideDeck: ReadonlySet<CharacterId>;
  /** The card currently being dragged, if any. */
  draggedCard: CardInfo | null;
  /** Previous result, used to keep a stable order while cards leave the pile. */
  baseline: Array<CardInfo>;
};

export function computeUnusedCardsList(input: UnusedCardsInput): Array<CardInfo> {
  const {
    characterConfigs, playingOrder, musicSelection, isGameplay,
    cardInsideDeck, cardInsideCollected, characterInsideDeck, draggedCard,
  } = input;

  const isUnused = (cardInfo: CardInfo): boolean => {
    if (cardInfo.characterId === null) { return false; }
    const characterId = cardInfo.characterId;
    const musicIndex = musicSelection.get(characterId) || 0;
    if (musicIndex === -1) {
      return true;
    }
    if (isGameplay) {
      // everything outside {deck, collected} is unused
      return !(cardInsideDeck.has(cardInfo.toKey()) || cardInsideCollected.has(cardInfo.toKey()));
    }
    if (draggedCard) {
      // the other cards of the character being dragged are already "left behind"
      if (draggedCard.characterId === characterId && draggedCard.cardIndex !== cardInfo.cardIndex) {
        return true;
      }
    }
    if (characterInsideDeck.has(characterId) && !cardInsideDeck.has(cardInfo.toKey())) {
      return true;
    }
    return false;
  };

  // During gameplay only characters taking part in the match can reach the deck/collected
  // piles, so the scan is restricted to the playing order instead of every known card.
  const relevantCharacterIds = isGameplay ? new Set(playingOrder) : null;

  const newUnused: Array<CardInfo> = [];
  characterConfigs.forEach((characterConfig, characterId) => {
    if (relevantCharacterIds !== null && !relevantCharacterIds.has(characterId)) { return; }
    characterConfig.card.forEach((_cardId, index) => {
      const cardInfo = new CardInfo(characterId, index);
      if (isUnused(cardInfo)) {
        newUnused.push(cardInfo);
      }
    });
  });

  const seenKeys = new Set<string>();
  const finalUnused: Array<CardInfo> = [];
  const pushIfRelevant = (cardInfo: CardInfo) => {
    const key = cardInfo.toKey();
    if (seenKeys.has(key)) { return; }
    const isRelevant = relevantCharacterIds === null
      || cardInfo.characterId === null
      || relevantCharacterIds.has(cardInfo.characterId);
    if (isRelevant && isUnused(cardInfo)) {
      seenKeys.add(key);
      finalUnused.push(cardInfo);
    }
  };

  input.baseline.forEach(pushIfRelevant);
  newUnused.forEach(pushIfRelevant);
  return finalUnused;
}

/** Key set of a flat list of cards, used to answer "is this card still in a pile?". */
export function collectCardKeys(cards: ReadonlyArray<CardInfo>): Set<string> {
  const keys = new Set<string>();
  cards.forEach((card) => keys.add(card.toKey()));
  return keys;
}

/** Characters that have at least one card in the given piles. */
export function collectCharacterIds(cards: ReadonlyArray<CardInfo>): Set<CharacterId> {
  const ids = new Set<CharacterId>();
  cards.forEach((card) => {
    if (card.characterId !== null) { ids.add(card.characterId); }
  });
  return ids;
}
