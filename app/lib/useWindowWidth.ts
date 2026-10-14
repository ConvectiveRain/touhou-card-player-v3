"use client";

import { useEffect, useState } from "react";

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
