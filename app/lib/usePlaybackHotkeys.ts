"use client";

import { useEffect, useRef } from "react";
import { isTextEntryTarget, resolvePlaybackHotkey } from "./playbackActions";

export interface PlaybackHotkeyHandlers {
  onPrevious: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
}

/**
 * Binds `[` (previous), `]` (next) and space (play/pause) to the transport while `enabled`.
 *
 * The handlers are held in a ref, so the listener is attached once for as long as the hotkeys
 * are enabled instead of being re-bound on every playback tick.
 */
export function usePlaybackHotkeys(enabled: boolean, handlers: PlaybackHotkeyHandlers): void {
  const handlersRef = useRef(handlers);
  useEffect(() => { handlersRef.current = handlers; }, [handlers]);

  useEffect(() => {
    if (!enabled) { return; }
    const handleKeyDown = (event: KeyboardEvent) => {
      // a held bracket key should not skip through the whole queue
      if (event.repeat) { return; }
      if (event.target instanceof HTMLElement && isTextEntryTarget(event.target)) { return; }
      const command = resolvePlaybackHotkey(event.key, event.code, event);
      if (command === null) { return; }
      // space would otherwise scroll the page and re-activate whichever button still has focus
      event.preventDefault();
      const current = handlersRef.current;
      if (command === "previous") { current.onPrevious(); }
      else if (command === "next") { current.onNext(); }
      else { current.onTogglePlay(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => { window.removeEventListener("keydown", handleKeyDown); };
  }, [enabled]);
}
