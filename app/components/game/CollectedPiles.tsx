"use client";

import { Box, Stack, Typography } from "@mui/material";
import { CustomColors } from "../../types/Consts";
import { GetLocalizedString, Localization } from "../../types/Localization";
import { NoFontFamily } from "../Theme";

/**
 * The collected-card piles: the per-player score badge, the player/opponent name labels
 * and the observer name list. Positions are computed by `useCardVisuals`; this component
 * only renders the model.
 */

export type ObserverListModel = {
  x: number;
  y: number;
  width: number;
  height: number;
  entries: Array<{ name: string; isSelf: boolean }>;
};

export type ScoreBadgeModel = {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
  score: number;
};

/** A "Opponent <name> Score: n" style label. */
export type ScoreLabelModel = {
  key: string;
  left: number;
  top: number;
  width: number;
  align: "left" | "right";
  prefix: string;
  score: number;
};

export type CollectedPilesModel = {
  observerList: ObserverListModel | null;
  scoreBadges: Array<ScoreBadgeModel>;
  scoreLabels: Array<ScoreLabelModel>;
};

export function CollectedPiles({ model }: { model: CollectedPilesModel }) {
  const { observerList, scoreBadges, scoreLabels } = model;

  return (
    <>
      {observerList && (
        <Stack
          direction="column"
          key="observer-name-list"
          sx={{
            position: "absolute",
            left: `${observerList.x}px`,
            top: `${observerList.y}px`,
            width: `${observerList.width}px`,
            height: `${observerList.height}px`,
            display: "flex",
          }}
        >
          <Typography
            variant="h6"
            sx={{
              width: `${observerList.width}px`,
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              overflow: "hidden",
              userSelect: "none",
              textAlign: "right",
            }}
            fontFamily={NoFontFamily}
          >
            {GetLocalizedString(
              Localization.GameObserversList,
              new Map([["plural", observerList.entries.length > 1 ? "s" : ""]]),
            )}
          </Typography>
          {observerList.entries.map((entry, index) => (
            <Typography
              key={`observer-name-${index}`}
              variant="body1"
              sx={{
                width: `${observerList.width}px`,
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                overflow: "hidden",
                userSelect: "none",
                textAlign: "right",
                color: entry.isSelf ? CustomColors.selfColor : CustomColors.observerColor,
              }}
              fontFamily={NoFontFamily}
              color={entry.isSelf ? "secondary" : "primary"}
            >
              {entry.name}
            </Typography>
          ))}
        </Stack>
      )}

      {scoreBadges.map((badge) => (
        <Box
          key={badge.key}
          sx={{
            position: "absolute",
            left: `${badge.left}px`,
            top: `${badge.top}px`,
            width: `${badge.width}px`,
            height: `${badge.height}px`,
            textAlign: "center",
            pointerEvents: "none",
            alignItems: "center",
            justifyContent: "center",
            display: "flex",
          }}
        >
          <Typography variant="h3" sx={{ userSelect: "none" }} fontFamily={NoFontFamily}>
            {badge.score}
          </Typography>
        </Box>
      ))}

      {scoreLabels.map((label) => (
        <Typography
          key={label.key}
          sx={{
            position: "absolute",
            left: `${label.left}px`,
            top: `${label.top}px`,
            width: `${label.width}px`,
            textAlign: label.align,
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            overflow: "hidden",
            transition: "left 0.3s ease, top 0.3s ease, width 0.3s ease, opacity 0.3s ease",
            fontFamily: NoFontFamily,
          }}
          variant="h6"
        >
          <span style={{ color: CustomColors.opponentColor }}>{label.prefix}</span>{" "}
          {GetLocalizedString(Localization.GameScore)}: {label.score}
        </Typography>
      ))}
    </>
  );
}
