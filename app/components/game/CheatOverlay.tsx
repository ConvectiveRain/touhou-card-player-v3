"use client";

import { Box } from "@mui/material";
import CheatRect from "../CheatRect";

/**
 * Draws a highlight rectangle over the deck slot holding the answer while cheat mode is
 * active. Position comes from the card layout pass.
 */
export interface CheatOverlayProps {
  x: number;
  y: number;
  cardWidth: number;
  cardHeight: number;
}

export function CheatOverlay({ x, y, cardWidth, cardHeight }: CheatOverlayProps) {
  return (
    <Box
      key="cheat-box"
      sx={{
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        pointerEvents: "none",
        width: `${cardWidth}px`,
        height: `${cardHeight}px`,
        zIndex: 2000,
      }}
    >
      <CheatRect width={cardWidth} height={cardHeight} />
    </Box>
  );
}
