import { RefObject } from "react";
import { PlaybackState } from "../types/Configs";
import { IconButton, Slider, Stack, Typography } from "@mui/material";
import {
  SkipNextRounded as RightIcon,
  SkipPreviousRounded as LeftIcon,
  PauseRounded as PauseIcon,
  PlayArrowRounded as PlayIcon,
  VolumeDownRounded as VolumeDown, VolumeUpRounded as VolumeUp
} from "@mui/icons-material";
import { MonospaceFontFamily } from "./Theme";
import { cheatSanitize } from "../types/Cheat";
import { formatClock } from "../lib/format";
import { useAudioClock } from "../lib/useAudioClock";
import { playbackToggleAction } from "../lib/playbackActions";

export interface PlayerControlProps {
  showSlider?: boolean;
  /** Hides the elapsed/total clock; the track length can hint which song is playing. */
  hideTimes?: boolean;
  /** The shared <audio> element; the live position is read from it. */
  audioRef: RefObject<HTMLAudioElement | null>;
  duration: number;
  playbackState: PlaybackState;
  volume: number;
  setPlaybackTime?: (time: number) => void;
  setVolume: (volume: number) => void;
  onNextMusic: () => void;
  onPreviousMusic: () => void;
  onPlay(): void;
  onPause(): void;
};

function PlaybackIconButton(props: React.ComponentProps<typeof IconButton>) {
  const { disabled = false, children, ...rest } = props;
  return (
    <IconButton {...rest} disabled={disabled} size="large" color="primary">
      {children}
    </IconButton>
  );
}

function formatTime(seconds: number): string {
  return formatClock(seconds);
}

export default function PlayerControl({
  showSlider,
  hideTimes,
  audioRef,
  duration,
  playbackState,
  onNextMusic, onPreviousMusic, onPlay, onPause,
  setPlaybackTime,
  volume, setVolume,
}: PlayerControlProps) {
  // The position ticks several times a second, so it is subscribed to here instead of being
  // kept in a store that every mounted tab would re-render for.
  const currentTime = useAudioClock(audioRef);
  const toggleAction = playbackToggleAction(playbackState);

  const buttons = (
    <Stack direction="row" spacing={4} alignItems="center">
      <PlaybackIconButton 
        aria-label="上一首"
        onClick={onPreviousMusic} 
      >
        <LeftIcon fontSize="large"/>
      </PlaybackIconButton>
      <PlaybackIconButton 
        aria-label={toggleAction === "play" ? "播放" : "暂停"}
        disabled={toggleAction === null}
        onClick={toggleAction === "play" ? onPlay : onPause}
      >
        {playbackState !== PlaybackState.Playing ? <PlayIcon fontSize="large"/> : <PauseIcon fontSize="large"/>}
      </PlaybackIconButton>
      <PlaybackIconButton aria-label="下一首" onClick={onNextMusic} >
        <RightIcon fontSize="large"/>
      </PlaybackIconButton>
    </Stack>
  );
  if (!showSlider) {
    return buttons;
  }
  return <Stack direction="column" spacing={1} alignItems="center" width="100%" justifyContent="center">
    <Stack direction="row" spacing={3} alignItems="center" width="100%" justifyContent="center">
      {!hideTimes && <Typography fontFamily={MonospaceFontFamily}>{cheatSanitize(formatTime(currentTime))}</Typography>}
      <Slider value={currentTime} 
        min={0} max={duration} 
        sx={{ width: "clamp(0px, 40%, 300px)" }}
        onChange={(_, value) => {
          const newTime = Array.isArray(value) ? value[0] : value;
          if (setPlaybackTime) {
            setPlaybackTime(newTime);
          }
        }}
      />
      {!hideTimes && <Typography fontFamily={MonospaceFontFamily}>{cheatSanitize(formatTime(duration))}</Typography>}
    </Stack>
    <Stack direction="row" spacing={3} alignItems="center" width="100%" justifyContent="center">
      <VolumeDown></VolumeDown>
      <Slider value={volume} 
        min={0} max={1} step={0.10}
        sx={{ width: "clamp(0px, 40%, 300px)" }}
        onChange={(_, value) => {
          const newVolume = Array.isArray(value) ? value[0] : value;
          setVolume(newVolume);
        }}
      />
      <VolumeUp></VolumeUp>
    </Stack>
    {buttons}
  </Stack>;
}
