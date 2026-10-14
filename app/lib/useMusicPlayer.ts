"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CharacterId, createPlayingOrder, GlobalData, MusicSelectionMap,
  PlaybackSetting, PlaybackState,
} from "../types/Configs";
import { musicSourceFor } from "./music";
import { loadVolume, saveVolume } from "./persistence";

/**
 * The audio engine: one <audio> for the soundtrack plus one for the countdown bell, the
 * transport controls the Player/List tabs drive, and the hooks GameTab calls when a match
 * starts or ends. Extracted from the page component so it no longer mixes with routing.
 */

const PRNG_MAX = 2147483647;

export type MusicPlayerOptions = {
  globalData: GlobalData;
  musicSelection: MusicSelectionMap;
  playingOrder: Array<CharacterId>;
  characterTemporaryDisabled: Map<CharacterId, boolean>;
  currentCharacterId: CharacterId;
  setCurrentCharacterId: (characterId: CharacterId) => void;
  setPlayingOrder: (order: Array<CharacterId>) => void;
  setCharacterTemporaryDisabled: (map: Map<CharacterId, boolean>) => void;
  /** False until the dataset has loaded; the player stays idle until then. */
  ready: boolean;
};

export type MusicPlayerStore = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  countdownAudioRef: React.RefObject<HTMLAudioElement | null>;
  audioElementProps: {
    onLoadedData: () => void;
    onLoadedMetadata: () => void;
  };
  countdownElementProps: {
    onEnded: () => void;
  };
  /** Duration of the loaded track. The live position lives in `useAudioClock`. */
  duration: number;
  playbackState: PlaybackState;
  setPlaybackState: (state: PlaybackState) => void;
  playbackSetting: PlaybackSetting;
  setPlaybackSetting: (setting: PlaybackSetting) => void;
  volume: number;
  setVolume: (volume: number) => void;
  musicStartTimestamp: number;
  setNextSongPRNGSeed: (seed: number) => void;
  inGame: boolean;
  /** Turns the out-of-game countdown off and remembers it (the About tab previews music). */
  suspendOutOfGameCountdown: () => void;
  /** Puts the out-of-game countdown back exactly as it was. */
  restoreOutOfGameCountdown: () => void;
  play: () => void;
  pause: () => void;
  previous: () => void;
  next: () => void;
  setPlaybackTime: (time: number) => void;
  playCountdownAudio: () => void;
  pauseForGame: () => void;
  /** Called by GameTab when a match begins; returns the order actually played. */
  startGame: (order: Array<CharacterId> | null) => Array<CharacterId>;
  endGame: () => void;
};

export function useMusicPlayer(options: MusicPlayerOptions): MusicPlayerStore {
  const {
    globalData, musicSelection, playingOrder, characterTemporaryDisabled,
    currentCharacterId, setCurrentCharacterId, setPlayingOrder,
    setCharacterTemporaryDisabled, ready,
  } = options;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const countdownAudioRef = useRef<HTMLAudioElement | null>(null);
  // null until first needed, so no randomness is produced during render
  const nextSongPRNGSeedRef = useRef<number | null>(null);
  // Handles are refs, not state: they are never rendered, and putting them in state turned
  // every pause/resume into an extra re-render of the whole page.
  const pauseTimeoutHandleRef = useRef<NodeJS.Timeout | null>(null);

  const [duration, setDuration] = useState<number>(0);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(PlaybackState.Stopped);
  const [playbackSetting, setPlaybackSetting] = useState<PlaybackSetting>({
    countdown: false, randomStartPosition: false, playbackDuration: 0,
  });
  const [volume, setVolumeState] = useState<number>(() => loadVolume());
  const [musicStartTimestamp, setMusicStartTimestamp] = useState<number>(0);
  const [inGame, setInGame] = useState<boolean>(false);
  // True while something (the About tab) asked for the countdown to stay off temporarily.
  const countdownSuspendedRef = useRef<boolean>(false);

  // Keep the latest values available to <audio> event handlers without re-binding them.
  const stateRef = useRef({ playbackSetting, playbackState });
  useEffect(() => {
    stateRef.current = { playbackSetting, playbackState };
  }, [playbackSetting, playbackState]);

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    saveVolume(newVolume);
  }, []);

  const setNextSongPRNGSeed = useCallback((seed: number) => {
    nextSongPRNGSeedRef.current = seed;
  }, []);

  /** Draws a fresh seed the first time one is needed. */
  const takeNextSongPRNGSeed = useCallback((): number => {
    if (nextSongPRNGSeedRef.current === null) {
      nextSongPRNGSeedRef.current = Math.floor(Math.random() * PRNG_MAX);
    }
    return nextSongPRNGSeedRef.current;
  }, []);

  // region music lookup

  const getMusicSourceUrl = useCallback((character: CharacterId): string | null => {
    return musicSourceFor(globalData, musicSelection, character);
  }, [globalData, musicSelection]);

  // region transport

  const clearPauseTimeout = useCallback(() => {
    if (pauseTimeoutHandleRef.current) {
      clearTimeout(pauseTimeoutHandleRef.current);
      pauseTimeoutHandleRef.current = null;
    }
  }, []);

  const resetPauseTimeout = useCallback(() => {
    if (pauseTimeoutHandleRef.current) {
      clearTimeout(pauseTimeoutHandleRef.current);
      pauseTimeoutHandleRef.current = null;
    }
    const { playbackDuration } = stateRef.current.playbackSetting;
    if (playbackDuration > 0) {
      pauseTimeoutHandleRef.current = setTimeout(() => {
        audioRef.current?.pause();
        setPlaybackState(PlaybackState.TimeoutPause);
        pauseTimeoutHandleRef.current = null;
      }, playbackDuration * 1000);
    }
  }, []);

  const setRandomPlaybackPosition = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !stateRef.current.playbackSetting.randomStartPosition) { return; }
    const trackDuration = audio.duration;
    if (isNaN(trackDuration) || trackDuration <= 0) {
      console.log("Audio duration is not available yet.");
      return;
    }
    const random01 = takeNextSongPRNGSeed() / PRNG_MAX;
    const randomPosition = trackDuration < 10 ? 0 : random01 * (trackDuration - 10);
    // The element owns the position now; the clock follows the resulting seek.
    audio.currentTime = randomPosition;
  }, [takeNextSongPRNGSeed]);

  const setPlaybackTime = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const play = useCallback(() => {
    audioRef.current?.play();
    setPlaybackState(PlaybackState.Playing);
  }, []);

  const pause = useCallback(() => {
    clearPauseTimeout();
    if (countdownAudioRef.current) {
      countdownAudioRef.current.pause();
      countdownAudioRef.current.currentTime = 0;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      setPlaybackState(PlaybackState.Stopped);
    }
  }, [clearPauseTimeout]);

  /** Pauses without marking the track stopped, so a later play resumes where it left off. */
  const pauseForGame = useCallback(() => {
    clearPauseTimeout();
    countdownAudioRef.current?.pause();
    if (audioRef.current) {
      audioRef.current.pause();
      setPlaybackState(PlaybackState.TimeoutPause);
    }
  }, [clearPauseTimeout]);

  const playCountdownAudio = useCallback(() => {
    audioRef.current?.pause();
    if (countdownAudioRef.current) {
      countdownAudioRef.current.currentTime = 0;
      countdownAudioRef.current.play();
    }
  }, []);

  const stepCharacter = useCallback((direction: 1 | -1) => {
    const total = playingOrder.length;
    if (total === 0) { return; }
    const currentIndex = playingOrder.indexOf(currentCharacterId);
    for (let offset = 1; offset <= total; offset++) {
      const index = (currentIndex + direction * offset + total * total) % total;
      const characterId = playingOrder[index];
      const selection = musicSelection.get(characterId);
      const isDisabled = characterTemporaryDisabled.get(characterId);
      if (selection !== undefined && selection !== -1 && !isDisabled) {
        setCurrentCharacterId(characterId);
        return;
      }
    }
  }, [
    playingOrder, currentCharacterId, musicSelection, characterTemporaryDisabled,
    setCurrentCharacterId,
  ]);

  const next = useCallback(() => { stepCharacter(1); }, [stepCharacter]);
  const previous = useCallback(() => { stepCharacter(-1); }, [stepCharacter]);

  const handleCountdownEnded = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) { return; }
    if (stateRef.current.playbackSetting.randomStartPosition) {
      setRandomPlaybackPosition();
    }
    let playedDuration = 0;
    const ranges = audio.played;
    for (let i = 0; i < ranges.length; i++) {
      playedDuration += ranges.end(i) - ranges.start(i);
    }
    audio.play().then(() => {
      if (playedDuration < 0.02) {
        console.log("CountdownEnd: Music started at ", Date.now());
        setMusicStartTimestamp(Date.now());
      }
    });
    resetPauseTimeout();
    setPlaybackState(PlaybackState.Playing);
  }, [resetPauseTimeout, setRandomPlaybackPosition]);

  const handleAudioLoadedData = useCallback(() => {
    const { playbackState: state, playbackSetting: setting } = stateRef.current;
    if (state !== PlaybackState.Playing && state !== PlaybackState.TimeoutPause) { return; }
    const audio = audioRef.current;
    if (!audio) { return; }
    if (setting.countdown) {
      // ring the bell first; the track itself starts when the bell ends
      if (countdownAudioRef.current) {
        countdownAudioRef.current.currentTime = 0;
        countdownAudioRef.current.play();
      }
      setPlaybackState(PlaybackState.CountingDown);
      return;
    }
    if (setting.randomStartPosition) {
      setRandomPlaybackPosition();
    }
    audio.play().then(() => {
      console.log("Audio loaded: Music started at ", Date.now());
      setMusicStartTimestamp(Date.now());
    });
    resetPauseTimeout();
    setPlaybackState(PlaybackState.Playing);
  }, [resetPauseTimeout, setRandomPlaybackPosition]);

  const handleAudioLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  // region game integration

  const startGame = useCallback((order: Array<CharacterId> | null): Array<CharacterId> => {
    const newTemporaryDisabled = new Map<CharacterId, boolean>();
    const newOrder = order ?? createPlayingOrder(
      globalData, musicSelection, newTemporaryDisabled, true,
    );
    setCharacterTemporaryDisabled(newTemporaryDisabled);
    setPlayingOrder(newOrder);
    setCurrentCharacterId(newOrder.length > 0 ? newOrder[newOrder.length - 1] : "");
    audioRef.current?.pause();
    setPlaybackState(PlaybackState.Stopped);
    setInGame(true);
    return newOrder;
  }, [
    globalData, musicSelection, setCharacterTemporaryDisabled, setPlayingOrder,
    setCurrentCharacterId,
  ]);

  const endGame = useCallback(() => {
    setInGame(false);
    audioRef.current?.pause();
    setPlaybackState(PlaybackState.Stopped);
    clearPauseTimeout();
    if (countdownAudioRef.current) {
      countdownAudioRef.current.pause();
      countdownAudioRef.current.currentTime = 0;
    }
  }, [clearPauseTimeout]);

  /** Turns the countdown off while a tab (the About tab) previews music without it. */
  const suspendOutOfGameCountdown = useCallback(() => {
    if (!stateRef.current.playbackSetting.countdown) { return; }
    countdownSuspendedRef.current = true;
    setPlaybackSetting((current) => ({ ...current, countdown: false }));
  }, []);

  /** Puts the countdown back after the user leaves that tab. */
  const restoreOutOfGameCountdown = useCallback(() => {
    if (!countdownSuspendedRef.current) { return; }
    countdownSuspendedRef.current = false;
    setPlaybackSetting((current) => ({ ...current, countdown: true }));
  }, []);

  // region effects

  useEffect(() => {
    if (audioRef.current) { audioRef.current.volume = volume; }
    if (countdownAudioRef.current) { countdownAudioRef.current.volume = volume; }
  }, [volume]);

  useEffect(() => {
    if (!ready || currentCharacterId === "") { return; }
    const audio = audioRef.current;
    if (!audio) { return; }
    const sourceUrl = getMusicSourceUrl(currentCharacterId);
    if (sourceUrl) {
      audio.src = sourceUrl;
      audio.load();
    } else {
      audio.src = "";
    }
  }, [ready, currentCharacterId, getMusicSourceUrl]);

  return {
    audioRef,
    countdownAudioRef,
    audioElementProps: {
      onLoadedData: handleAudioLoadedData,
      onLoadedMetadata: handleAudioLoadedMetadata,
    },
    countdownElementProps: { onEnded: handleCountdownEnded },
    duration,
    playbackState,
    setPlaybackState,
    playbackSetting,
    setPlaybackSetting,
    volume,
    setVolume,
    musicStartTimestamp,
    setNextSongPRNGSeed,
    inGame,
    suspendOutOfGameCountdown,
    restoreOutOfGameCountdown,
    play,
    pause,
    previous,
    next,
    setPlaybackTime,
    playCountdownAudio,
    pauseForGame,
    startGame,
    endGame,
  };
}
