"use client";

import { Box, Typography } from "@mui/material";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { MonospaceFontFamily } from "../Theme";

type TimerType = "countdown" | "running" | "paused" | "zero";

type TimerState = {
  type: TimerType;
  referenceTimestamp: number;
  time: number;
};

export interface GameTimerDisplayHandle {
  startCountdown: () => void;
  startRunning: () => void;
  pause: () => void;
}

export interface GameTimerDisplayProps {
  x: number;
  y: number;
  width: number;
  height: number;
  shown: boolean;
}

/**
 * Owns its own ticking interval so a running/counting-down timer does not force the whole
 * (card-heavy) board tree to re-render every 100ms.
 */
export const GameTimerDisplay = forwardRef<GameTimerDisplayHandle, GameTimerDisplayProps>(
  function GameTimerDisplay({ x, y, width, height, shown }, ref) {
    const [timerState, setTimerState] = useState<TimerState>({
      type: "zero", referenceTimestamp: 0, time: 0,
    });
    const timerStateRef = useRef<TimerState>(timerState);
    useEffect(() => { timerStateRef.current = timerState; }, [timerState]);

    useImperativeHandle(ref, () => ({
      startCountdown: () => {
        setTimerState((state) => ({ ...state, type: "countdown", referenceTimestamp: Date.now(), time: 0 }));
      },
      startRunning: () => {
        setTimerState((state) => ({ ...state, type: "running", referenceTimestamp: Date.now(), time: 0 }));
      },
      pause: () => {
        setTimerState((state) => ({ ...state, type: "paused" }));
      },
    }), []);

    useEffect(() => {
      const handle = setInterval(() => {
        const state = timerStateRef.current;
        switch (state.type) {
          case "countdown": {
            const deltaTime = Date.now() - state.referenceTimestamp;
            const newTime = 3 - Math.floor(deltaTime / 1000);
            if (newTime > 0) {
              setTimerState((current) => ({ ...current, time: newTime }));
            }
            break;
          }
          case "running": {
            const deltaTime = Date.now() - state.referenceTimestamp;
            setTimerState((current) => ({ ...current, time: deltaTime / 1000 }));
            break;
          }
        }
      }, 100);
      return () => { clearInterval(handle); };
    }, []);

    let text = "";
    switch (timerState.type) {
      case "countdown": text = timerState.time.toFixed(0); break;
      case "running": text = timerState.time.toFixed(2); break;
      case "paused": text = timerState.time.toFixed(2); break;
      case "zero": text = "0"; break;
    }

    return (
      <Box
        sx={{
          position: "absolute",
          left: `${x}px`,
          top: `${y}px`,
          width: `${width}px`,
          height: `${height}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000000ff",
          opacity: shown ? 1.0 : 0.0,
          transition: "left 0.3s ease, top 0.3s ease, width 0.3s ease, opacity 0.3s ease",
        }}
      >
        <Typography variant="h3" fontFamily={MonospaceFontFamily} sx={{
          userSelect: "none",
        }}>{text}</Typography>
      </Box>
    );
  }
);
