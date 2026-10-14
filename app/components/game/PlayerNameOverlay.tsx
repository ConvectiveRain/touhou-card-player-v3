"use client";

import { Typography } from "@mui/material";
import { CustomColors } from "../../types/Consts";
import { GetLocalizedString, Localization } from "../../types/Localization";
import { NoFontFamily } from "../Theme";
import type { BoardLayout } from "../../lib/geometry";

/**
 * The self/opponent name plates above the collected piles. The visibility rules differ
 * between practice, CPU, remote 1v1, melee and observer roles.
 */

export interface PlayerNameOverlayProps {
  layout: BoardLayout;
  /** Name of the local player (empty string when the plate is hidden). */
  selfName: string;
  opponentName: string;
  /** True when a remote connection is live; observers/clients hide plates without one. */
  connectedToServer: boolean;
  isObserver: boolean;
  isServer: boolean;
  isClient: boolean;
  isMelee: boolean;
  /** Number of connected players including self. */
  playerCount: number;
  /** Whether the player at index 1 is an observer. */
  secondPlayerIsObserver: boolean;
  isSelectingCards: boolean;
}

export function PlayerNameOverlay({
  layout, selfName, opponentName, connectedToServer,
  isObserver, isServer, isClient, isMelee, playerCount,
  secondPlayerIsObserver, isSelectingCards,
}: PlayerNameOverlayProps) {
  const layoutShowOpponentName = layout.showOpponentName;
  const showPlayerName = layout.showPlayerName && !(isMelee && isObserver)
    && !(isObserver && !connectedToServer);

  // The plate only exists in a 1v1: with more active players the opponent is not a single person.
  let showOpponent = layoutShowOpponentName && layout.is1v1;
  if (isClient && !connectedToServer) { showOpponent = false; }
  if (isObserver) {
    if (!connectedToServer) { showOpponent = false; }
    else if (secondPlayerIsObserver) { showOpponent = false; }
  }
  if (isServer && (playerCount < 2 || secondPlayerIsObserver)) { showOpponent = false; }

  const selfX = isSelectingCards ? layout.canvasWidth - layout.deckLeft - layout.deckWidth : layout.canvasMargin;
  const opponentX = isSelectingCards ? layout.deckLeft : layout.canvasMargin;

  return (
    <>
      <Typography
        key="player-name-text"
        variant="h6"
        sx={{
          userSelect: "none",
          position: "absolute",
          right: `${selfX}px`,
          top: `${layout.playerNameTop}px`,
          opacity: showPlayerName ? 1.0 : 0.0,
          transition: "right 0.3s ease, top 0.3s ease, opacity 0.3s ease",
          fontFamily: NoFontFamily,
          textAlign: "right",
          width: layout.deckWidth,
          color: isObserver ? CustomColors.opponentColor : CustomColors.selfColor,
        }}
      >
        {GetLocalizedString(Localization.GamePlayer)} {showPlayerName ? selfName : ""}
      </Typography>
      <Typography
        key="opponent-name-text"
        variant="h6"
        sx={{
          userSelect: "none",
          position: "absolute",
          left: `${opponentX}px`,
          top: `${layout.opponentNameTop}px`,
          opacity: showOpponent ? 1.0 : 0.0,
          transition: "left 0.3s ease, top 0.3s ease, opacity 0.3s ease",
          fontFamily: NoFontFamily,
          color: CustomColors.opponentColor,
        }}
      >
        {isObserver ? GetLocalizedString(Localization.GamePlayer) : GetLocalizedString(Localization.GameOpponent)}{" "}
        {showOpponent ? opponentName : ""}
      </Typography>
    </>
  );
}

/** Height the name plate band needs, used for the canvas extent calculation. */
export function playerNameExtent(layout: BoardLayout): number {
  return layout.playerNameTop + layout.playerNameHeight + layout.canvasMargin;
}
