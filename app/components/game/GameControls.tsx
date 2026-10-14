"use client";

import { Slider, TextField, Typography } from "@mui/material";
import {
  AddRounded, Casino, ClassRounded, ClearRounded, EastRounded, FilterList,
  PauseRounded, Pending, PlayArrowRounded, RemoveRounded, ShuffleRounded,
  SkipNextRounded, SmartToyRounded, StarRounded, StopRounded, WestRounded,
  GroupsRounded, PersonOffRounded,
  VolumeDownRounded as VolumeDown, VolumeUpRounded as VolumeUp,
} from "@mui/icons-material";
import { GameButton } from "../GameTabControls";
import { NoFontFamily } from "../Theme";
import { GetLocalizedString, Localization } from "../../types/Localization";
import { cheatSanitize } from "../../types/Cheat";
import {
  CharacterId, GlobalData, MusicSelectionMap,
  PlaybackState,
} from "../../types/Configs";
import { musicInfoFor } from "../../lib/music";
import { GameJudgeState, MatchType } from "../../types/GameTypes";
import type { GameJudge } from "../../types/GameJudge";
import type { NextTurnButtonModel } from "./gameButtonModels";
import { clamp } from "../../lib/math";
import { GameTimerDisplay } from "./GameTimerDisplay";
import type { GameTimerDisplayHandle } from "./GameTimerDisplay";
import type { BoardLayout, DeckColumnVisibility } from "../../lib/geometry";
import { CardWidthPercentageMin, computeDeckColumnLayout } from "../../lib/geometry";
import { RefObject } from "react";

/**
 * Every interactive control that floats over the board. Each sub-component is positioned
 * absolutely from the shared `BoardLayout`, so no manual y-cursor bookkeeping is needed
 * except where the original described a genuine column.
 */

const absoluteAt = (x: number, y: number, extra?: object) => ({
  position: "absolute", left: `${x}px`, top: `${y}px`, ...extra,
});

// region deck column

export type StartButtonModel = {
  text: string;
  disabled: boolean;
  contained: boolean;
  color: "primary" | "secondary" | "info";
  isStopGame: boolean;
  isGameFinished: boolean;
  onClick: () => void;
};

export type OpponentButtonModel = {
  text: string;
  matchType: MatchType;
  isServerClientObserver: boolean;
  onClick: () => void;
};

export interface DeckColumnControlsProps {
  layout: BoardLayout;
  visibility: DeckColumnVisibility;
  isMusicFilteredByDeck: boolean;
  cardWidthPercentage: number;
  /** The widest this deck allows, which is narrower than the user ceiling on a wide deck. */
  cardWidthPercentageLimit: number;
  cardCanGrow: boolean;
  deckRows: number;
  maxDeckRows: number;
  deckIsFull: boolean;
  deckIsEmpty: boolean;
  startButton: StartButtonModel;
  opponentButton: OpponentButtonModel;
  onCardSmaller: () => void;
  onCardLarger: () => void;
  onFilterByDeck: () => void;
  onRandomFill: () => void;
  onClearDeck: () => void;
  onShuffleDeck: () => void;
  onRemoveRow: () => void;
  onAddRow: () => void;
}

export function DeckColumnControls({
  layout, visibility, isMusicFilteredByDeck, cardWidthPercentage, cardWidthPercentageLimit,
  cardCanGrow, deckRows, maxDeckRows, deckIsFull, deckIsEmpty,
  startButton, opponentButton,
  onCardSmaller, onCardLarger, onFilterByDeck, onRandomFill, onClearDeck,
  onShuffleDeck, onRemoveRow, onAddRow,
}: DeckColumnControlsProps) {
  const x = layout.deckRight + layout.canvasMargin;
  const { positions } = computeDeckColumnLayout(layout, visibility);

  return (
    <>
      <GameButton
        text={GetLocalizedString(Localization.GameCardSmaller)}
        onClick={onCardSmaller}
        disabled={cardWidthPercentage <= CardWidthPercentageMin}
        sx={absoluteAt(x, positions.cardSmaller)}
      >
        <WestRounded />
      </GameButton>

      <GameButton
        text={GetLocalizedString(Localization.GameCardLarger)}
        onClick={onCardLarger}
        disabled={cardWidthPercentage >= cardWidthPercentageLimit || !cardCanGrow}
        sx={absoluteAt(x, positions.cardLarger)}
      >
        <EastRounded />
      </GameButton>

      <GameButton
        text={GetLocalizedString(Localization.GameFilterByDeck)}
        onClick={onFilterByDeck}
        disabled={isMusicFilteredByDeck}
        hidden={!visibility.filterByDeck}
        sx={absoluteAt(x, positions.filterByDeck)}
      >
        <FilterList />
      </GameButton>

      <GameButton
        text={startButton.text}
        disabled={startButton.disabled}
        hidden={!visibility.start}
        color={startButton.color}
        onClick={startButton.onClick}
        sx={absoluteAt(x, positions.start)}
        contained={startButton.contained}
      >
        {!startButton.isStopGame && (
          <PlayArrowRounded htmlColor={(startButton.contained && !startButton.disabled) ? "white" : "inherit"} />
        )}
        {startButton.isStopGame && <StopRounded />}
      </GameButton>

      <GameButton
        text={GetLocalizedString(Localization.GameRandomFill)}
        onClick={onRandomFill}
        disabled={!visibility.randomFill || deckIsFull}
        hidden={!visibility.randomFill}
        sx={absoluteAt(x, positions.randomFill)}
      >
        <Casino />
      </GameButton>

      <GameButton
        text={GetLocalizedString(Localization.GameClearDeck)}
        onClick={onClearDeck}
        disabled={!visibility.clearDeck || deckIsEmpty}
        hidden={!visibility.clearDeck}
        sx={absoluteAt(x, positions.clearDeck)}
      >
        <ClearRounded />
      </GameButton>

      <GameButton
        text={GetLocalizedString(Localization.GameShuffleDeck)}
        onClick={onShuffleDeck}
        disabled={!visibility.shuffleDeck || deckIsEmpty}
        hidden={!visibility.shuffleDeck}
        sx={absoluteAt(x, positions.shuffleDeck)}
      >
        <ShuffleRounded />
      </GameButton>

      <GameButton
        hidden={!visibility.switchOpponent}
        text={opponentButton.text}
        sx={absoluteAt(x, positions.switchOpponent)}
        onClick={opponentButton.onClick}
      >
        {opponentButton.matchType === MatchType.None && <PersonOffRounded />}
        {opponentButton.matchType === MatchType.CPU && <SmartToyRounded />}
        {opponentButton.isServerClientObserver && <GroupsRounded />}
      </GameButton>

      <GameButton
        onClick={onRemoveRow}
        disabled={!visibility.removeRow || deckRows <= 1}
        hidden={!visibility.removeRow}
        sx={absoluteAt(x, positions.removeRow)}
      >
        <RemoveRounded />
      </GameButton>

      <GameButton
        onClick={onAddRow}
        disabled={!visibility.addRow || deckRows >= maxDeckRows}
        hidden={!visibility.addRow}
        sx={absoluteAt(x, positions.addRow)}
      >
        <AddRounded />
      </GameButton>
    </>
  );
}

export function DeckSizeControls({
  layout, canEditDeck, deckColumns, maxDeckColumns,
  onAddColumn, onRemoveColumn,
}: {
  layout: BoardLayout;
  /** Column resizing is only offered while building a lineup. */
  canEditDeck: boolean;
  deckColumns: number;
  maxDeckColumns: number;
  onAddColumn: () => void;
  onRemoveColumn: () => void;
}) {
  const y = layout.playerDeckTop + layout.deckHeight + layout.canvasMargin;
  const addX = layout.deckLeft + layout.deckWidth - layout.buttonSize;
  const removeX = addX - (layout.buttonSize + layout.canvasSpacing);

  return (
    <>
      <GameButton
        onClick={onAddColumn}
        disabled={!canEditDeck || deckColumns >= maxDeckColumns}
        hidden={!canEditDeck}
        sx={absoluteAt(addX, y, { zIndex: 1000 })}
      >
        <AddRounded />
      </GameButton>
      <GameButton
        onClick={onRemoveColumn}
        disabled={!canEditDeck || deckColumns <= 1}
        hidden={!canEditDeck}
        sx={absoluteAt(removeX, y, { zIndex: 1000 })}
      >
        <RemoveRounded />
      </GameButton>
    </>
  );
}

// region volume

export function VolumeControl({
  layout, volume, setVolume,
}: {
  layout: BoardLayout;
  volume: number;
  setVolume: (volume: number) => void;
}) {
  const x = layout.deckLeft - layout.canvasMargin;
  const iconSize = 24;
  const upY = layout.playerDeckTop;
  const sliderY = upY + iconSize + layout.canvasSpacing;
  let sliderHeight = layout.cardHeight - iconSize * 2 - layout.canvasSpacing * 2;
  if (sliderHeight < 50) { sliderHeight = 50; }
  const downY = sliderY + sliderHeight + layout.canvasSpacing;

  return (
    <>
      <VolumeUp
        fontSize="small"
        key="volume-up-label"
        sx={{
          position: "absolute", left: `${x}px`, top: `${upY}px`,
          transform: "translateX(-100%)",
          transition: "left 0.3s ease, top 0.3s ease",
        }}
      />
      <Slider
        size="small"
        key="volume-slider"
        orientation="vertical"
        value={volume}
        onChange={(_event, newValue) => {
          setVolume(Array.isArray(newValue) ? newValue[0] : newValue);
        }}
        min={0} max={1} step={0.10}
        sx={{
          position: "absolute",
          left: `${x}px`,
          top: `${sliderY}px`,
          height: `${sliderHeight}px`,
          transform: "translateX(-85%)",
          transition: "left 0.3s ease, top 0.3s ease, height 0.3s ease",
          zIndex: 1000,
        }}
      />
      <VolumeDown
        fontSize="small"
        key="volume-down-label"
        sx={{
          position: "absolute", left: `${x}px`, top: `${downY}px`,
          transform: "translateX(-100%)",
          transition: "left 0.3s ease, top 0.3s ease",
        }}
      />
    </>
  );
}

// region middle bar

export interface MiddleBarProps {
  layout: BoardLayout;
  judge: GameJudge;
  data: GlobalData;
  musicSelection: MusicSelectionMap;
  currentCharacterId: CharacterId;
  playbackState: PlaybackState;
  timerRef: RefObject<GameTimerDisplayHandle | null>;
  /** Built by the rules-side models, not here: the view only renders them. */
  nextTurnButton: NextTurnButtonModel;
  instructionText: string;
  onPlayMusic: () => void;
  onPauseMusic: () => void;
  onNextTurn: () => void;
}

export function MiddleBar({
  layout, judge, data, musicSelection, currentCharacterId, playbackState,
  timerRef, nextTurnButton, instructionText, onPlayMusic, onPauseMusic, onNextTurn,
}: MiddleBarProps) {
  const shown = judge.state !== GameJudgeState.SelectingCards;
  const timerTextWidth = 150;
  const buttonSize = 47;
  const y = layout.middleBarTop;
  const buttonY = y + layout.middleBarHeight / 2 - buttonSize / 2;

  const musicInfo = musicInfoFor(data, musicSelection, currentCharacterId);
  const titleHidden = judge.state !== GameJudgeState.TurnWinnerDetermined;
  const textWidth = judge.isObserver()
    ? layout.deckWidth - (timerTextWidth + layout.canvasSpacing)
    : layout.deckWidth - (timerTextWidth + 3 * layout.canvasSpacing + buttonSize * 2);

  const isPlay = playbackState !== PlaybackState.Playing;
  let playDisabled = playbackState === PlaybackState.CountingDown;
  if (judge.state === GameJudgeState.TurnCountdownNext) { playDisabled = true; }
  const playHidden = !shown || judge.isObserver();

  const nextClickable = !nextTurnButton.disabled;
  const nextContained = nextTurnButton.contained;
  const icon = nextTurnButton.icon;
  const nextText = nextTurnButton.text;

  return (
    <>
      <GameTimerDisplay
        key="game-timer-box"
        ref={timerRef}
        x={layout.deckLeft}
        y={y}
        width={timerTextWidth}
        height={layout.middleBarHeight}
        shown={shown}
      />

      <Typography
        key="music-title-text"
        variant="h6"
        sx={{
          position: "absolute",
          left: `${layout.deckLeft + timerTextWidth + layout.canvasSpacing}px`,
          top: `${y + layout.middleBarHeight / 2}px`,
          transform: "translateY(-100%)",
          width: `${textWidth}px`,
          opacity: (!shown || titleHidden) ? 0.0 : 1.0,
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          overflow: "hidden",
          transition: "left 0.3s ease, top 0.3s ease, width 0.3s ease",
          userSelect: "none",
        }}
      >
        {cheatSanitize(currentCharacterId)} / {cheatSanitize(musicInfo?.title as string)}
      </Typography>

      <Typography
        key="music-album-text"
        variant="subtitle1"
        sx={{
          position: "absolute",
          left: `${layout.deckLeft + timerTextWidth + layout.canvasSpacing}px`,
          top: `${y + layout.middleBarHeight / 2}px`,
          textOverflow: "ellipsis",
          width: `${textWidth}px`,
          opacity: (!shown || titleHidden) ? 0.0 : 1.0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          transition: "left 0.3s ease, top 0.3s ease, width 0.3s ease",
          userSelect: "none",
        }}
      >
        {cheatSanitize(musicInfo?.album as string)}
      </Typography>

      <GameButton
        key="play-pause-button"
        disabled={playDisabled}
        hidden={playHidden}
        sx={absoluteAt(layout.deckRight - buttonSize * 2 - layout.canvasSpacing, buttonY, {
          opacity: playHidden ? 0.0 : 1.0,
          transition: "left 0.3s ease, top 0.3s ease, opacity 0.3s ease",
        })}
        onClick={isPlay ? onPlayMusic : onPauseMusic}
      >
        {isPlay && <PlayArrowRounded fontSize="large" />}
        {!isPlay && <PauseRounded fontSize="large" />}
      </GameButton>

      <GameButton
        key="next-turn-button"
        disabled={!nextClickable}
        hidden={nextTurnButton.hidden}
        text={nextText}
        sx={absoluteAt(layout.deckRight - buttonSize, buttonY, {
          opacity: nextTurnButton.hidden ? 0.0 : 1.0,
          transition: "left 0.3s ease, top 0.3s ease, opacity 0.3s ease",
        })}
        onClick={onNextTurn}
        contained={nextContained}
        color={nextContained ? "info" : "primary"}
      >
        {icon === "skip" && (
          <SkipNextRounded fontSize="large" htmlColor={(nextContained && nextClickable) ? "white" : "inherit"} />
        )}
        {icon === "pending" && (
          <Pending fontSize="large" htmlColor={(nextContained && nextClickable) ? "white" : "inherit"} />
        )}
        {icon === "finished" && (
          <StopRounded fontSize="large" htmlColor={(nextContained && nextClickable) ? "white" : "inherit"} />
        )}
        {icon === "shuffle" && (
          <ShuffleRounded fontSize="large" htmlColor={(nextContained && nextClickable) ? "white" : "inherit"} />
        )}
      </GameButton>

      {instructionText !== "" && (
        <Typography
          key="next-turn-instruction"
          variant="body1"
          sx={{
            userSelect: "none",
            position: "absolute",
            left: `${layout.deckLeft}px`,
            top: `${layout.playerDeckBottom + layout.canvasMargin}px`,
            width: `${layout.deckWidth}px`,
            fontFamily: NoFontFamily,
          }}
        >
          {instructionText}
        </Typography>
      )}
    </>
  );
}

// region opponent deck

export interface OpponentDeckControlsProps {
  layout: BoardLayout;
  judge: GameJudge;
  isMelee: boolean;
  isCPU: boolean;
  is1v1: boolean;
  isSelectingCards: boolean;
  cpuOpponentSetting: CPUOpponentSetting;
  onCpuOpponentSettingChange: (setting: CPUOpponentSetting) => void;
  onToggleTraditionalMode: () => void;
  onShuffleOpponentDeck: () => void;
  onClearOpponentDeck: () => void;
  onRandomFillOpponentDeck: () => void;
}

export function OpponentDeckControls({
  layout, judge, isMelee, isCPU, is1v1, isSelectingCards, cpuOpponentSetting,
  onCpuOpponentSettingChange, onToggleTraditionalMode, onShuffleOpponentDeck,
  onClearOpponentDeck, onRandomFillOpponentDeck,
}: OpponentDeckControlsProps) {
  const rightX = layout.deckRight + layout.canvasMargin;
  const leftX = layout.deckLeft - layout.canvasMargin;
  const stride = layout.buttonSize + layout.canvasSpacing;

  // region right column, built bottom-up from the opponent deck
  let rightY = layout.opponentDeckBottom - layout.buttonSize;
  const traditionalY = rightY;
  rightY -= stride;
  const shuffleY = rightY;
  rightY -= stride;
  const clearY = rightY;
  rightY -= stride;
  const fillY = rightY;

  const traditionalHidden = !isSelectingCards || judge.matchType === MatchType.None || isMelee;
  const explanationHidden = !is1v1 || !isSelectingCards;
  const traditionalExplanation = judge.traditionalMode
    ? GetLocalizedString(Localization.GameModeTraditionalDescription)
    : GetLocalizedString(Localization.GameModeNonTraditionalDescription);
  const cpuDeckActionsHidden = !isSelectingCards || !isCPU;
  const cpuDeckActionsDisabled = cpuDeckActionsHidden || judge.players.length < 2;

  // region left column: CPU tuning, only meaningful while selecting cards versus the CPU
  const settingsShown = isSelectingCards && judge.matchType === MatchType.CPU;
  const settingsHidden = !settingsShown;
  let leftY = layout.opponentDeckTop;
  const settingsTitleY = leftY;
  leftY += 24 + layout.canvasSpacing;
  const reactionLabelY = leftY;
  leftY += 24 + layout.canvasSpacing;
  const reactionInputY = leftY;
  leftY += 44 + layout.canvasSpacing;
  const reactionStdDevInputY = leftY;
  leftY += 36 + layout.canvasSpacing;
  const mistakeLabelY = leftY;
  leftY += 24 + layout.canvasSpacing;
  const mistakeInputY = leftY;

  const leftTextSx = {
    userSelect: "none",
    position: "absolute" as const,
    transform: "translateX(-100%)",
    opacity: settingsHidden ? 0.0 : 1.0,
    transition: "opacity 0.3s ease, left 0.3s ease, top 0.3s ease",
    fontFamily: NoFontFamily,
  };
  const leftInputSx = {
    width: "160px",
    userSelect: "none",
    position: "absolute" as const,
    transform: "translateX(-100%)",
    opacity: settingsHidden ? 0.0 : 1.0,
    transition: "opacity 0.3s ease, left 0.3s ease, top 0.3s ease",
  };

  return (
    <>
      <GameButton
        key="opponent-traditional-mode-button"
        hidden={traditionalHidden}
        disabled={judge.isObserver()}
        text={judge.traditionalMode
          ? GetLocalizedString(Localization.GameModeTraditional)
          : GetLocalizedString(Localization.GameModeNonTraditional)}
        onClick={onToggleTraditionalMode}
        sx={absoluteAt(rightX, traditionalY)}
      >
        {judge.traditionalMode ? <ClassRounded /> : <StarRounded />}
      </GameButton>

      <Typography
        key="opponent-traditional-mode-explanation"
        variant="body1"
        sx={{
          userSelect: "none",
          position: "absolute",
          left: `${layout.deckLeft}px`,
          top: `${layout.playerDeckBottom + layout.canvasMargin}px`,
          width: `${layout.deckWidth - layout.buttonSize * 2 - layout.canvasMargin}px`,
          opacity: explanationHidden ? 0.0 : 1.0,
          transition: "opacity 0.3s ease, left 0.3s ease, top 0.3s ease",
          fontFamily: NoFontFamily,
        }}
      >
        {traditionalExplanation.split("\n").map((line, index) => (
          <span key={index}>
            {line}
            <br />
          </span>
        ))}
      </Typography>

      <GameButton
        key="shuffle-opponent-deck-button"
        disabled={cpuDeckActionsDisabled || judge.isDeckEmpty(1)}
        hidden={cpuDeckActionsHidden}
        text={GetLocalizedString(Localization.GameShuffleDeck)}
        onClick={onShuffleOpponentDeck}
        sx={absoluteAt(rightX, shuffleY)}
      >
        <ShuffleRounded />
      </GameButton>

      <GameButton
        key="clear-opponent-deck-button"
        disabled={cpuDeckActionsDisabled || judge.isDeckEmpty(1)}
        hidden={cpuDeckActionsHidden}
        text={GetLocalizedString(Localization.GameClearDeck)}
        onClick={onClearOpponentDeck}
        sx={absoluteAt(rightX, clearY)}
      >
        <ClearRounded />
      </GameButton>

      <GameButton
        key="random-fill-opponent-deck-button"
        disabled={cpuDeckActionsDisabled || judge.isDeckFull(1)}
        hidden={cpuDeckActionsHidden}
        text={GetLocalizedString(Localization.GameRandomFill)}
        onClick={onRandomFillOpponentDeck}
        sx={absoluteAt(rightX, fillY)}
      >
        <Casino />
      </GameButton>

      <Typography key="opponent-deck-label" variant="h6" sx={{ ...leftTextSx, left: `${leftX}px`, top: `${settingsTitleY}px` }}>
        {GetLocalizedString(Localization.GameOpponentSettingTitle)}
      </Typography>
      <Typography key="opponent-deck-instruction" variant="body1" sx={{ ...leftTextSx, left: `${leftX}px`, top: `${reactionLabelY}px` }}>
        {GetLocalizedString(Localization.GameOpponentSettingReactionTime)}
      </Typography>
      <TextField
        key="opponent-reaction-time-input"
        type="number"
        size="small"
        value={cpuOpponentSetting.reactionTimeMean}
        label={GetLocalizedString(Localization.GameOpponentSettingReactionTimeMean)}
        disabled={settingsHidden}
        onChange={(event) => {
          const value = parseFloat(event.target.value);
          onCpuOpponentSettingChange({
            ...cpuOpponentSetting,
            reactionTimeMean: clamp(Number.isNaN(value) ? 1.0 : value, 0.5, 10),
          });
        }}
        slotProps={{
          htmlInput: { min: 0.5, max: 10, step: 0.5 },
          inputLabel: { style: { fontFamily: NoFontFamily } },
        }}
        sx={{ ...leftInputSx, left: `${leftX}px`, top: `${reactionInputY}px` }}
      />
      <TextField
        key="opponent-reaction-time-stddev-input"
        type="number"
        size="small"
        value={cpuOpponentSetting.reactionTimeStdDev}
        label={GetLocalizedString(Localization.GameOpponentSettingReactionTimeStdDev)}
        disabled={settingsHidden}
        onChange={(event) => {
          const value = parseFloat(event.target.value);
          onCpuOpponentSettingChange({
            ...cpuOpponentSetting,
            reactionTimeStdDev: clamp(Number.isNaN(value) ? 0.1 : value, 0, 5),
          });
        }}
        slotProps={{
          htmlInput: { min: 0.0, max: 5, step: 0.1 },
          inputLabel: { style: { fontFamily: NoFontFamily } },
        }}
        sx={{ ...leftInputSx, left: `${leftX}px`, top: `${reactionStdDevInputY}px` }}
      />
      <Typography
        key="opponent-mistake-rate-label"
        variant="body1"
        sx={{ ...leftTextSx, left: `${leftX}px`, top: `${mistakeLabelY}px` }}
      >
        {GetLocalizedString(Localization.GameOpponentSettingMistakeRate)}
      </Typography>
      <TextField
        key="opponent-mistake-rate-input"
        type="number"
        size="small"
        value={cpuOpponentSetting.mistakeRate * 100.0}
        label={GetLocalizedString(Localization.GameOpponentSettingMistakeRate)}
        disabled={settingsHidden}
        onChange={(event) => {
          const value = parseFloat(event.target.value);
          onCpuOpponentSettingChange({
            ...cpuOpponentSetting,
            mistakeRate: clamp(Number.isNaN(value) ? 0 : value, 0, 100) / 100,
          });
        }}
        slotProps={{
          htmlInput: { min: 0.0, max: 100.0, step: 1.0 },
          inputLabel: { style: { fontFamily: NoFontFamily } },
        }}
        sx={{ ...leftInputSx, left: `${leftX}px`, top: `${mistakeInputY}px` }}
      />
    </>
  );
}

export type CPUOpponentSetting = {
  reactionTimeMean: number;
  reactionTimeStdDev: number;
  mistakeRate: number;
};
