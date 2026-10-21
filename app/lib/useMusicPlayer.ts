"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CharacterId, createPlayingOrder, GlobalData, MusicSelectionMap,
  MusicInfo, MusicUniqueId, PlaybackSetting, PlaybackState,
} from "../types/Configs";
import {
  characterIdForMusic, musicIdFor, musicSourceFor, parseMusicInfo, stepMusicQueueIndex,
} from "./music";
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
  setMusicSelection: (selection: MusicSelectionMap) => void;
  setPlayingOrder: (order: Array<CharacterId>) => void;
  setCharacterTemporaryDisabled: (map: Map<CharacterId, boolean>) => void;
  /** False until the dataset has loaded; the player stays idle until then. */
  ready: boolean;
  /** When set, every playable queue is restricted to these music ids. */
  allowedMusicIds?: ReadonlySet<MusicUniqueId> | null;
  /** Playlist choices for the active playlist, grouped by character. */
  playlistTracksByCharacter?: ReadonlyMap<CharacterId, Array<MusicUniqueId>> | null;
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
  /** 点卡片 / 列表行：换到这一首并立刻开始播放（不改变曲目选择本身）。 */
  playSelection: () => void;
  /** 播放一张专辑中的某一首；上一首 / 下一首沿这张专辑走。 */
  playMusicQueue: (musicIds: Array<MusicUniqueId>, musicId: MusicUniqueId) => void;
  clearMusicQueue: () => void;
  /** 当前真正加载的曲目（可能来自角色队列，也可能来自专辑队列）。 */
  activeMusicId: MusicUniqueId | null;
  currentMusicInfo: MusicInfo | null;
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
    currentCharacterId, setCurrentCharacterId, setMusicSelection, setPlayingOrder,
    setCharacterTemporaryDisabled, ready, allowedMusicIds = null,
    playlistTracksByCharacter = null,
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
    countdown: false, randomStartPosition: false, playbackDuration: 0, pauseOnSwitch: false,
  });
  const [volume, setVolumeState] = useState<number>(() => loadVolume());
  const [musicStartTimestamp, setMusicStartTimestamp] = useState<number>(0);
  const [inGame, setInGame] = useState<boolean>(false);
  const [directQueue, setDirectQueue] = useState<{
    musicIds: Array<MusicUniqueId>;
    index: number;
  } | null>(null);
  const musicAllowed = useCallback((musicId: MusicUniqueId): boolean => (
    allowedMusicIds === null || allowedMusicIds.has(musicId)
  ), [allowedMusicIds]);
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
    if (directQueue) {
      const musicId = directQueue.musicIds[directQueue.index];
      return musicId && musicAllowed(musicId) ? globalData.sources.get(musicId) || null : null;
    }
    const musicId = musicIdFor(globalData, musicSelection, character);
    if (!musicId || !musicAllowed(musicId)) { return null; }
    return musicSourceFor(globalData, musicSelection, character);
  }, [directQueue, globalData, musicAllowed, musicSelection]);

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

  /**
   * 点卡片 / 列表行时的「换到这首并开始播」。
   *
   * 曲目换了以后由加载完成后的 loadeddata 负责真正出声（倒计时、随机位置这些设置照旧生效），
   * 所以这里只把状态置为播放；点的正好是已经加载好的这一首（src 不会变、也就不会再发
   * loadeddata）时，直接调 play()。点击处理器里读到的 currentCharacterId 还是切换前的值，
   * 正好用来判断"要不要等新曲目加载"。
   */
  const playSelection = useCallback(() => {
    setDirectQueue(null);
    const musicId = currentCharacterId === ""
      ? null
      : musicIdFor(globalData, musicSelection, currentCharacterId);
    if (!musicId || !musicAllowed(musicId)) { return; }
    const sourceUrl = globalData.sources.get(musicId) ?? null;
    if (!sourceUrl) { return; }
    setPlaybackState(PlaybackState.Playing);
    const audio = audioRef.current;
    if (audio && sourceUrl !== null && audio.getAttribute("src") === sourceUrl) {
      audio.play().catch((error: unknown) => {
        // 点卡片时若同时换了曲目，这一次 play() 会被新的加载请求打断（AbortError），属预期；
        // 新曲目会在 loadeddata 时开始，这里只报真正的失败原因（例如浏览器拦截自动播放）。
        if ((error as DOMException | null)?.name !== "AbortError") {
          console.log("Playback was blocked:", error);
        }
      });
    }
  }, [currentCharacterId, globalData, musicAllowed, musicSelection]);

  /**
   * Keep the card display and the playing order in sync with a track that came from an
   * album queue. Without this, the audio switches tracks while the large character card
   * remains on the character selected before entering the album.
   */
  const syncCharacterForMusic = useCallback((musicId: MusicUniqueId) => {
    if (!musicAllowed(musicId)) { return; }
    const characterId = characterIdForMusic(globalData, musicId);
    if (characterId === null) { return; }
    setCurrentCharacterId(characterId);
    if (!playingOrder.includes(characterId)) {
      setPlayingOrder([...playingOrder, characterId]);
    }
  }, [globalData, musicAllowed, playingOrder, setCurrentCharacterId, setPlayingOrder]);

  const choosePlaylistTrackForCharacter = useCallback((characterId: CharacterId): number | null => {
    const choices = playlistTracksByCharacter?.get(characterId);
    if (!choices || choices.length === 0) { return null; }
    const musicId = choices[Math.floor(Math.random() * choices.length)];
    const config = globalData.characterConfigs.get(characterId);
    const index = config ? config.musics.indexOf(musicId) : -1;
    if (index < 0) { return null; }
    const nextSelection = new Map(musicSelection);
    nextSelection.set(characterId, index);
    setMusicSelection(nextSelection);
    return index;
  }, [
    globalData, musicSelection, playlistTracksByCharacter, setMusicSelection,
  ]);

  const clearMusicQueue = useCallback(() => {
    setDirectQueue(null);
  }, []);

  const playMusicQueue = useCallback((musicIds: Array<MusicUniqueId>, musicId: MusicUniqueId) => {
    const playable = musicIds.filter((id) => globalData.sources.has(id) && musicAllowed(id));
    const index = playable.indexOf(musicId);
    if (index < 0) { return; }
    syncCharacterForMusic(musicId);
    setDirectQueue({ musicIds: playable, index });
    setPlaybackState(PlaybackState.Playing);
    const audio = audioRef.current;
    const sourceUrl = globalData.sources.get(musicId);
    if (audio && sourceUrl && audio.getAttribute("src") === sourceUrl) {
      audio.play().catch((error: unknown) => {
        if ((error as DOMException | null)?.name !== "AbortError") {
          console.log("Playback was blocked:", error);
        }
      });
    }
  }, [globalData, musicAllowed, syncCharacterForMusic]);

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
    if (directQueue) {
      const nextIndex = stepMusicQueueIndex(
        directQueue.index, directQueue.musicIds.length, direction,
      );
      const nextMusicId = directQueue.musicIds[nextIndex];
      setDirectQueue({ ...directQueue, index: nextIndex });
      if (nextMusicId) { syncCharacterForMusic(nextMusicId); }
      if (stateRef.current.playbackSetting.pauseOnSwitch) {
        pause();
      }
      return;
    }
    const total = playingOrder.length;
    if (total === 0) { return; }
    const currentIndex = playingOrder.indexOf(currentCharacterId);
    for (let offset = 1; offset <= total; offset++) {
      const index = (currentIndex + direction * offset + total * total) % total;
      const characterId = playingOrder[index];
      const selection = musicSelection.get(characterId);
      const isDisabled = characterTemporaryDisabled.get(characterId);
      if (isDisabled) { continue; }
      const randomizedIndex = playlistTracksByCharacter
        ? choosePlaylistTrackForCharacter(characterId)
        : null;
      const nextSelection = randomizedIndex ?? selection;
      const musicId = nextSelection !== undefined && nextSelection !== -1
        ? globalData.characterConfigs.get(characterId)?.musics[nextSelection]
        : null;
      if (nextSelection !== undefined && nextSelection !== -1
        && musicId && musicAllowed(musicId)) {
        setCurrentCharacterId(characterId);
        // 「切歌不播放」：换到新曲目后停在暂停状态，等用户自己按播放键
        if (stateRef.current.playbackSetting.pauseOnSwitch) {
          pause();
        }
        return;
      }
    }
  }, [
    directQueue, playingOrder, currentCharacterId, musicSelection, characterTemporaryDisabled,
    globalData, musicAllowed, playlistTracksByCharacter, choosePlaylistTrackForCharacter,
    setCurrentCharacterId, syncCharacterForMusic, pause,
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
    setDirectQueue(null);
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

  const activeMusicId = directQueue
    ? directQueue.musicIds[directQueue.index] ?? null
    : (currentCharacterId ? musicIdFor(globalData, musicSelection, currentCharacterId) : null);
  const currentMusicInfo: MusicInfo | null = activeMusicId
    ? { characterId: currentCharacterId, ...parseMusicInfo(activeMusicId) }
    : null;

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
    if (!ready || (currentCharacterId === "" && !directQueue)) { return; }
    const audio = audioRef.current;
    if (!audio) { return; }
    const sourceUrl = getMusicSourceUrl(currentCharacterId);
    // 同一首曲子不要重新加载：load() 会打断正在播的声音，而同一地址不会再补发 loadeddata，
    // 于是「点一下当前这首让它播」就会变成静默。地址真的换了才交给 <audio> 重新加载。
    if (sourceUrl === audio.getAttribute("src")) { return; }
    if (sourceUrl) {
      audio.src = sourceUrl;
      audio.load();
    } else {
      audio.src = "";
    }
  }, [ready, currentCharacterId, directQueue, getMusicSourceUrl]);

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
    playSelection,
    playMusicQueue,
    clearMusicQueue,
    activeMusicId,
    currentMusicInfo,
    previous,
    next,
    setPlaybackTime,
    playCountdownAudio,
    pauseForGame,
    startGame,
    endGame,
  };
}
