"use client";

import { useCallback, useState } from "react";

/**
 * A counter used purely to tell React that a mutable model changed.
 *
 * `GameJudge` and `GamePeer` are long-lived mutable objects: mutating them does not change any
 * identity React can compare, so a version number is bumped instead. The bump function is stable,
 * which makes it safe to capture once (for example inside the judge's own `refresh` hook).
 */
export function useVersion(): [number, () => void] {
  const [version, setVersion] = useState<number>(0);
  const bump = useCallback(() => { setVersion((current) => current + 1); }, []);
  return [version, bump];
}
