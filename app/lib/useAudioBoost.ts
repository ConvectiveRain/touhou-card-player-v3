"use client";

import { RefObject, useCallback, useEffect, useRef } from "react";
import {
  AudioBoostMode, AudioBoostNodes, configureAudioBoostNodes, createAudioBoostNodes,
} from "./audioBoost";

type AudioBoostGraph = {
  ctx: AudioContext;
  nodes: AudioBoostNodes;
};

type WebkitAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

/** Routes the shared music element through the Web Audio loudness chain. */
export function useAudioBoost(
  audioRef: RefObject<HTMLAudioElement | null>,
  mode: AudioBoostMode,
): () => void {
  const graphRef = useRef<AudioBoostGraph | null>(null);
  const modeRef = useRef<AudioBoostMode>(mode);

  useEffect(() => {
    modeRef.current = mode;
    if (graphRef.current) {
      configureAudioBoostNodes(graphRef.current.nodes, mode);
    }
  }, [mode]);

  const ensureGraph = useCallback((): AudioBoostGraph | null => {
    if (graphRef.current) { return graphRef.current; }
    const audio = audioRef.current;
    const AudioContextCtor = window.AudioContext
      ?? (window as WebkitAudioWindow).webkitAudioContext;
    if (!audio || !AudioContextCtor) { return null; }
    try {
      const ctx = new AudioContextCtor({ latencyHint: "playback" });
      const source = ctx.createMediaElementSource(audio);
      const nodes = createAudioBoostNodes(ctx, modeRef.current);
      source.connect(nodes.preamp)
        .connect(nodes.limiter)
        .connect(nodes.safety)
        .connect(nodes.drive)
        .connect(nodes.clipper)
        .connect(ctx.destination);
      graphRef.current = { ctx, nodes };
      return graphRef.current;
    } catch (error) {
      console.log("Audio boost could not be initialized:", error);
      return null;
    }
  }, [audioRef]);

  const prime = useCallback(() => {
    const graph = ensureGraph();
    if (graph?.ctx.state === "suspended") {
      graph.ctx.resume().catch(() => { /* the next user gesture retries */ });
    }
  }, [ensureGraph]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) { return; }
    const onPlay = () => { prime(); };
    const onDeviceChange = () => {
      if (!audio.paused) { prime(); }
    };
    const onVisibilityChange = () => {
      if (!document.hidden && !audio.paused) { prime(); }
    };
    audio.addEventListener("play", onPlay);
    navigator.mediaDevices?.addEventListener("devicechange", onDeviceChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      audio.removeEventListener("play", onPlay);
      navigator.mediaDevices?.removeEventListener("devicechange", onDeviceChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [audioRef, prime]);

  return prime;
}
