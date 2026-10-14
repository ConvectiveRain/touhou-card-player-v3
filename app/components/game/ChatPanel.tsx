"use client";

import { Box } from "@mui/material";
import ChatBox, { ChatMessage } from "../ChatBox";
import type { BoardLayout } from "../../lib/geometry";

/**
 * Chat panel docked to the left of the player deck. Only shown for remote matches.
 */
export interface ChatPanelProps {
  layout: BoardLayout;
  shown: boolean;
  messages: Array<ChatMessage>;
  onSendMessage: (message: string) => void;
}

export function ChatPanel({ layout, shown, messages, onSendMessage }: ChatPanelProps) {
  const width = layout.deckLeft - layout.canvasMargin * 2 - 40;

  return (
    <Box
      key="chat-messages-box"
      sx={{
        position: "absolute",
        left: `${layout.canvasMargin}px`,
        top: `${layout.playerDeckTop}px`,
        width: `${width}px`,
        height: `${layout.deckHeight}px`,
        transition: "left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease, opacity 0.3s ease",
        opacity: shown ? 1.0 : 0.0,
        alignItems: "flex-end",
        display: "flex",
        overflow: "hidden",
      }}
    >
      <ChatBox messages={messages} onSendMessage={onSendMessage} />
    </Box>
  );
}
