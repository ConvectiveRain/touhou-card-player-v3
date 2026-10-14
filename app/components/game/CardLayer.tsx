"use client";

import { Typography } from "@mui/material";
import { CardBackgroundState, CharacterCard } from "../CharacterCard";
import { NoFontFamily } from "../Theme";
import { GetLocalizedString, Localization } from "../../types/Localization";
import { getCardTransitionString } from "../../lib/geometry";

/**
 * Everything that sits absolutely positioned on the board: the visible cards, the dashed
 * placeholder slots and the "unused cards" caption.
 */

export type CardVisual = {
  cardInfoKey: string;
  visible: boolean;
  x: number;
  y: number;
  zIndex: number;
  transform?: string;
  width: string;
  source: string;
  backgroundState: CardBackgroundState;
  upsideDown: boolean;
  transition?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

export type CardPlaceholderVisual = {
  x: number;
  y: number;
  hidden: boolean;
};

export interface CardLayerProps {
  cardCollection: string;
  cardWidth: number;
  cards: Map<string, CardVisual>;
  placeholders: Array<CardPlaceholderVisual>;
  /** Top offset of the unused-cards caption; hidden when the count is zero. */
  unusedCardsCaptionTop: number;
  unusedCardsCaptionLeft: number;
  unusedCardCount: number;
}

export function CardLayer({
  cardCollection, cardWidth, cards, placeholders,
  unusedCardsCaptionTop, unusedCardsCaptionLeft, unusedCardCount,
}: CardLayerProps) {
  return (
    <>
      {Array.from(cards.values()).filter((card) => card.visible).map((card) => (
        <CharacterCard
          key={card.cardInfoKey}
          cardCollection={cardCollection}
          paperVariant="elevation"
          imageSource={card.source}
          width={card.width}
          backgroundState={card.backgroundState}
          upsideDown={card.upsideDown}
          sx={{
            position: "absolute",
            left: card.x,
            top: card.y,
            zIndex: card.zIndex,
            transition: card.transition ?? getCardTransitionString("0.3s"),
          }}
          onMouseEnter={card.onMouseEnter}
          onMouseLeave={card.onMouseLeave}
          onClick={card.onClick}
        />
      ))}
      {placeholders.map((placeholder, index) => (
        <CharacterCard
          key={`placeholder-${index}`}
          cardCollection={cardCollection}
          paperVariant="outlined"
          imageSource={""}
          width={`${cardWidth}px`}
          backgroundState={CardBackgroundState.Placeholder}
          sx={{
            position: "absolute",
            left: placeholder.x,
            top: placeholder.y,
            opacity: placeholder.hidden ? 0.0 : 1.0,
            transition: "opacity 0.3s ease, top 0.3s ease, left 0.3s ease, width 0.3s ease",
          }}
        />
      ))}
      <Typography
        sx={{
          position: "absolute",
          left: `${unusedCardsCaptionLeft}px`,
          top: `${unusedCardsCaptionTop}px`,
          transition: "opacity 0.3s ease, left 0.3s ease, top 0.3s ease",
          opacity: unusedCardCount > 0 ? 1.0 : 0.0,
          fontFamily: NoFontFamily,
          userSelect: "none",
        }}
      >
        {GetLocalizedString(Localization.GameUnusedCards)}
      </Typography>
    </>
  );
}
