"use client";

import { useEffect, useState } from "react";

/** Width below which the layout drops secondary tabs — including the game board. */
export const SmallScreenWidth = 600;

/** Tracks `window.innerWidth`, shared by every responsive part of the app. */
export function useWindowWidth(fallback: number = 1200): number {
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : fallback,
  );

  useEffect(() => {
    const handleResize = () => { setWindowWidth(window.innerWidth); };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => { window.removeEventListener("resize", handleResize); };
  }, []);

  return windowWidth;
}

/**
 * Whether the window is too narrow for the game board. Small screens hide the game tab
 * entirely, so anything that would send the user there has to check this first.
 */
export function useIsSmallScreen(): boolean {
  return useWindowWidth() < SmallScreenWidth;
}
