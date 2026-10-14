"use client";

import { RefObject, useEffect, useState } from "react";

/** The slider and the clock readout do not need more than a few updates per second. */
const ClockIntervalMs = 250;

/**
 * Follows an `<audio>` element's playback position locally.
 *
 * The position changes several times a second; keeping it in a store owned by the page made
 * every mounted tab (including the whole card board) re-render while music played. Subscribing
 * where the position is displayed keeps those renders out of the rest of the tree.
 */
export function useAudioClock(audioRef: RefObject<HTMLAudioElement | null>): number {
  const [currentTime, setCurrentTime] = useState<number>(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) { return; }

    let lastUpdate = 0;
    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastUpdate < ClockIntervalMs) { return; }
      lastUpdate = now;
      setCurrentTime(audio.currentTime);
    };
    // Seeking (slider drag, random start, new track) must be reflected without the throttle.
    const handleSeek = () => {
      lastUpdate = 0;
      setCurrentTime(audio.currentTime);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("seeked", handleSeek);
    audio.addEventListener("loadedmetadata", handleSeek);
    audio.addEventListener("emptied", handleSeek);
    setCurrentTime(audio.currentTime);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("seeked", handleSeek);
      audio.removeEventListener("loadedmetadata", handleSeek);
      audio.removeEventListener("emptied", handleSeek);
    };
  }, [audioRef]);

  return currentTime;
}
