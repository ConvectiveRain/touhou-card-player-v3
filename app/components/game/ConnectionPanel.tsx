"use client";

import { Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { GetLocalizedString, Localization } from "../../types/Localization";
import { NoFontFamily } from "../Theme";
import type { BoardLayout } from "../../lib/geometry";

/**
 * The black panel that replaces the opponent deck while there is nobody to play against:
 * display name, share/join code, and the buttons that create or join a session.
 */
export interface ConnectionPanelProps {
  layout: BoardLayout;
  shown: boolean;
  myName: string;
  onMyNameChange: (name: string) => void;
  isServer: boolean;
  /** The server's own peer id, or null while it is still being generated. */
  sharedCode: string | null;
  joinCode: string;
  onJoinCodeChange: (code: string) => void;
  onConnect: () => void;
  isClient: boolean;
  onToggleClientObserver: () => void;
  onRegenerateCode: () => void;
  onCopyCode: () => void;
  onCopyClientJoinUrl: () => void;
  onCopyObserverJoinUrl: () => void;
}

export function ConnectionPanel({
  layout, shown, myName, onMyNameChange, isServer, sharedCode, joinCode,
  onJoinCodeChange, onConnect, isClient, onToggleClientObserver,
  onRegenerateCode, onCopyCode, onCopyClientJoinUrl, onCopyObserverJoinUrl,
}: ConnectionPanelProps) {
  if (!shown) { return null; }

  const codeIsGenerating = sharedCode === null;

  return (
    <Paper
      key="opponent-connection-paper"
      sx={{
        position: "absolute",
        left: `${layout.deckLeft - 5}px`,
        top: `${layout.opponentDeckTop - 5}px`,
        width: `${layout.deckWidth + 10}px`,
        height: `${layout.deckHeight + 5}px`,
        backgroundColor: "#000000ff",
        zIndex: 1500,
        alignItems: "center",
        justifyContent: "center",
        display: "flex",
      }}
    >
      <Stack
        key="opponent-connection-box"
        direction="column"
        spacing={1}
        padding={1}
        sx={{
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          key="player-name-text"
          variant="body1"
          sx={{
            userSelect: "none",
            textAlign: "left",
            width: "100%",
            paddingLeft: "4px",
            fontFamily: NoFontFamily,
          }}
        >
          {GetLocalizedString(Localization.GameConnectionMyName)}
        </Typography>
        <TextField
          size="small"
          sx={{ width: "100%" }}
          slotProps={{ input: { style: { fontFamily: NoFontFamily } } }}
          value={myName}
          onChange={(event) => { onMyNameChange(event.target.value); }}
        />
        <Typography
          variant="body1"
          sx={{
            userSelect: "none",
            textAlign: "left",
            width: "100%",
            paddingLeft: "4px",
            fontFamily: NoFontFamily,
          }}
        >
          {isServer
            ? GetLocalizedString(Localization.GameConnectShareCodeInstruction)
            : GetLocalizedString(Localization.GameConnectEnterCodeInstruction)}
        </Typography>
        <TextField
          size="small"
          multiline
          sx={{ width: "100%" }}
          slotProps={{ input: { style: { fontFamily: NoFontFamily } } }}
          value={isServer
            ? (sharedCode ?? GetLocalizedString(Localization.GameConnectionGeneratingId))
            : joinCode}
          onChange={(event) => { onJoinCodeChange(event.target.value); }}
        />
        {!isServer && (
          <Stack direction="row" spacing={1}>
            <Button
              onClick={onConnect}
              sx={{ fontFamily: NoFontFamily }}
              variant="outlined"
              color="success"
            >
              {GetLocalizedString(Localization.GameConnectionConnect)}
            </Button>
            <Button
              onClick={onToggleClientObserver}
              sx={{ fontFamily: NoFontFamily }}
              variant="outlined"
            >
              {isClient
                ? GetLocalizedString(Localization.GameConnectAsObserver)
                : GetLocalizedString(Localization.GameConnectAsClient)}
            </Button>
          </Stack>
        )}
        {isServer && (
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: "wrap", justifyContent: "center" }}
          >
            <Button
              onClick={onRegenerateCode}
              variant="outlined"
              color="secondary"
              sx={{ fontFamily: NoFontFamily }}
            >
              {codeIsGenerating
                ? GetLocalizedString(Localization.GameConnectionRetryGeneration)
                : GetLocalizedString(Localization.GameConnectionRegenerate)}
            </Button>
            <Button
              onClick={onCopyCode}
              sx={{ fontFamily: NoFontFamily }}
              disabled={codeIsGenerating}
              variant="outlined"
            >
              {GetLocalizedString(Localization.GameConnectionCopyToClipboard)}
            </Button>
            <Button
              onClick={onCopyClientJoinUrl}
              sx={{ fontFamily: NoFontFamily }}
              disabled={codeIsGenerating}
              variant="outlined"
            >
              {GetLocalizedString(Localization.GameConnectionCopyClientLink)}
            </Button>
            <Button
              onClick={onCopyObserverJoinUrl}
              sx={{ fontFamily: NoFontFamily }}
              disabled={codeIsGenerating}
              variant="outlined"
            >
              {GetLocalizedString(Localization.GameConnectionCopyObserverLink)}
            </Button>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
