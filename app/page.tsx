"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PlayerTab from "./components/PlayerTab";
import { CharacterId, MusicSelectionMap } from "./types/Configs";
import { Box, Button, CssBaseline, Divider, Paper, Stack } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { NoFontFamily, theme } from "./components/Theme";
import CustomTabs from "./components/CustomTabs";
import ListTab from "./components/ListTab";
import GameTab from "./components/GameTab";
import ConfigTab from "./components/ConfigTab";
import LibraryPicker from "./components/LibraryPicker";
import PlaylistManager from "./components/PlaylistManager";
import { GetLocalizedString, Localization } from "./types/Localization";
import { PagePRNG } from "./types/PagePrng";
import { useIsSmallScreen } from "./lib/useWindowWidth";
import { useGameData } from "./lib/useGameData";
import { useMusicPlayer } from "./lib/useMusicPlayer";
import { playbackToggleAction } from "./lib/playbackActions";
import { usePlaybackHotkeys } from "./lib/usePlaybackHotkeys";
import { getFeatures } from "./lib/features";
import { resolveJoinLink } from "./lib/joinLink";
import {
  buildPlaylistGameSelection, loadPlaylistStore, MusicPlaylist,
  savePlaylistStore,
} from "./lib/playlists";

// The tab order used by both the header buttons and the tab container.
const PlayerTabIndex = 0;
const ListTabIndex = 1;
const ConfigTabIndex = 2;
/** The game board tab; its header button is labelled `TabNameAbout` ("Match"). */
const GameTabIndex = 3;

/**
 * A header button. Tabs pass `onClick` that selects them; the extra buttons (Alice, Source code)
 * just run their own action.
 */
function TabButton({
  label, selected, disabled, color, contained, underlinedText, minWidth, onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  color?: "primary" | "secondary" | "success" | "error" | "info" | "warning";
  contained?: boolean;
  underlinedText?: boolean;
  minWidth?: string;
  onClick?: () => void;
}) {
  return (
    <Button
      variant={contained !== undefined ? (contained ? "contained" : "text") : (selected ? "contained" : "text")}
      onClick={onClick}
      disabled={disabled}
      color={color || "primary"}
      size="small"
      sx={{
        fontFamily: NoFontFamily,
        padding: 0.5,
        minWidth: minWidth ?? "4em",
        textDecoration: underlinedText ? "underline" : "none",
      }}
    >
      {label}
    </Button>
  );
}

function TabContainer({
  children
}: {
  children: React.ReactNode;
}) {
  return <Box
    sx={{ width: "100%", paddingLeft: 2, paddingRight: 2 }}
  >
    <Paper
      sx={{
        padding: 2, width: "100%", overflow: "hidden",
        backgroundColor: theme.custom.mainTabBackground
      }}
    >
      {children}
    </Paper>
  </Box>
}

const AliceTabLabels = [
  "Alice is the best!",
  "We need more Alice!",
  "All hail Alice!",
  "Alice is right!",
  "Alice fumofumo~",
];
const AliceCharacterId = "アリス・マーガトロイド";

export default function Home() {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Array<MusicPlaylist>>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string>("");
  const playlistSnapshotRef = useRef<{
    musicSelection: MusicSelectionMap;
    playingOrder: Array<CharacterId>;
    currentCharacterId: CharacterId;
  } | null>(null);

  const gameData = useGameData();
  const {
    globalData, ready,
    musicSelection, setMusicSelection,
    playingOrder, setPlayingOrder,
    characterTemporaryDisabled, setCharacterTemporaryDisabled,
    currentCharacterId, setCurrentCharacterId,
  } = gameData;

  const player = useMusicPlayer({
    globalData,
    musicSelection,
    playingOrder,
    characterTemporaryDisabled,
    currentCharacterId,
    setCurrentCharacterId,
    setPlayingOrder,
    setCharacterTemporaryDisabled,
    ready,
  });

  useEffect(() => {
    setPlaylists(loadPlaylistStore().playlists);
  }, []);

  const updatePlaylists = useCallback((next: Array<MusicPlaylist>) => {
    setPlaylists(next);
    savePlaylistStore(next);
  }, []);

  const restorePlaylistSnapshot = useCallback(() => {
    const snapshot = playlistSnapshotRef.current;
    if (!snapshot) { return; }
    setMusicSelection(snapshot.musicSelection);
    setPlayingOrder(snapshot.playingOrder);
    setCurrentCharacterId(snapshot.currentCharacterId);
    playlistSnapshotRef.current = null;
  }, [setCurrentCharacterId, setMusicSelection, setPlayingOrder]);

  const chooseGamePlaylist = useCallback((playlistId: string) => {
    if (playlistId === "") {
      restorePlaylistSnapshot();
      setActivePlaylistId("");
      return;
    }
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist) { return; }
    if (!playlistSnapshotRef.current) {
      playlistSnapshotRef.current = {
        musicSelection: new Map(musicSelection),
        playingOrder: playingOrder.slice(),
        currentCharacterId,
      };
    }
    setActivePlaylistId(playlistId);
  }, [
    currentCharacterId, musicSelection, playingOrder, playlists, restorePlaylistSnapshot,
  ]);

  useEffect(() => {
    if (!ready || !activePlaylistId || player.inGame) { return; }
    const playlist = playlists.find((item) => item.id === activePlaylistId);
    if (!playlist) {
      restorePlaylistSnapshot();
      setActivePlaylistId("");
      return;
    }
    const game = buildPlaylistGameSelection(playlist, globalData);
    setMusicSelection(game.selection);
    setPlayingOrder(game.order);
    setCurrentCharacterId(game.order[0] ?? "");
    // The playlist is the source of truth while it is selected; user edits are applied here.
  }, [
    ready, activePlaylistId, playlists, globalData, player.inGame,
    restorePlaylistSnapshot, setCurrentCharacterId, setMusicSelection, setPlayingOrder,
  ]);

  const isOnSmallerScreen = useIsSmallScreen();
  const activeGamePlaylist = playlists.find(
    (playlist) => playlist.id === activePlaylistId,
  ) ?? null;

  // `[` / `]` / space drive the transport, but only where the transport is on screen: the
  // Player and List tabs, and never while a match owns the music.
  const playbackHotkeysEnabled = !player.inGame
    && (activeTab === PlayerTabIndex || activeTab === ListTabIndex);
  const togglePlay = () => {
    const action = playbackToggleAction(player.playbackState);
    if (action === "play") { player.play(); }
    else if (action === "pause") { player.pause(); }
  };
  usePlaybackHotkeys(playbackHotkeysEnabled, {
    onPrevious: player.previous,
    onNext: player.next,
    onTogglePlay: togglePlay,
  });

  // The game board owns the music while it is open, so the out-of-game countdown is suspended
  // there and restored when the user leaves. Driving it from the active tab keeps the setting
  // untouched by navigation itself.
  useEffect(() => {
    if (activeTab === GameTabIndex) {
      player.suspendOutOfGameCountdown();
    } else {
      player.restoreOutOfGameCountdown();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // A PvP join link (`?code=…&role=client|observer`) opens the game board so the recipient lands
  // on the join panel. Applied after mount, not in the initial state, to keep the server-rendered
  // markup identical to the first client render. Small screens have no game mode at all, so the
  // link is ignored there rather than revealing a tab the header deliberately hides.
  useEffect(() => {
    if (isOnSmallerScreen) { return; }
    if (resolveJoinLink(getFeatures().code, getFeatures().role) !== null) {
      setActiveTab(GameTabIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectAliceIfQueued = () => {
    if (!playingOrder.includes(AliceCharacterId)) { return; }
    setCurrentCharacterId(AliceCharacterId);
    if (characterTemporaryDisabled.get(AliceCharacterId)) {
      const nextDisabled = new Map(characterTemporaryDisabled);
      nextDisabled.set(AliceCharacterId, false);
      setCharacterTemporaryDisabled(nextDisabled);
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ display: "none" }}>
        <audio
          id="audio-element"
          ref={player.audioRef}
          onLoadedData={player.audioElementProps.onLoadedData}
          onLoadedMetadata={player.audioElementProps.onLoadedMetadata}
        ></audio>
        <audio
          id="countdown-audio-element"
          ref={player.countdownAudioRef}
          src="Bell3.mp3"
          onEnded={player.countdownElementProps.onEnded}
        ></audio>
      </div>
      <div><main><Box>
        <Stack direction="column" spacing={1} sx={{
          width: "100%", alignItems: "center", paddingTop: 2,
        }}>
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            sx={{
              maxWidth: "100%", flexWrap: "nowrap",
              overflowX: "auto", paddingLeft: 1, paddingRight: 1,
            }}
          >
            <LibraryPicker
              data={globalData}
              musicSelection={musicSelection}
              currentCharacterId={currentCharacterId as CharacterId}
              playingOrder={playingOrder}
              scope={gameData.musicScope}
              setScope={gameData.setMusicScope}
              setMusicSelection={setMusicSelection}
              setPlayingOrder={setPlayingOrder}
              setCurrentCharacterId={setCurrentCharacterId}
              onPlaySelection={player.playSelection}
              onPlayMusicQueue={player.playMusicQueue}
              activeMusicId={player.activeMusicId}
              disabled={player.inGame}
            />
            <Button
              size="small"
              disabled={player.inGame}
              onClick={() => { setPlaylistOpen(true); }}
            >
              我的歌单
            </Button>
            <Divider orientation="vertical" flexItem />
            <TabButton
              label={GetLocalizedString(Localization.TabNamePlayer)}
              selected={activeTab === PlayerTabIndex}
              disabled={player.inGame}
              onClick={() => { setActiveTab(PlayerTabIndex); }}
            />
            <Divider orientation="vertical" flexItem />
            <TabButton
              label={GetLocalizedString(Localization.TabNameList)}
              selected={activeTab === ListTabIndex}
              disabled={player.inGame}
              onClick={() => { setActiveTab(ListTabIndex); }}
            />
            <Divider orientation="vertical" flexItem />
            <TabButton
              label={!isOnSmallerScreen
                ? AliceTabLabels[PagePRNG.hash("Alice") % AliceTabLabels.length]
                : "Alice!"}
              selected={false}
              disabled={player.inGame}
              color="success"
              contained={false}
              minWidth={isOnSmallerScreen ? "4em" : undefined}
              onClick={() => {
                setActiveTab(PlayerTabIndex);
                selectAliceIfQueued();
              }}
            />
            <Divider orientation="vertical" flexItem />
            <TabButton
              label={GetLocalizedString(Localization.TabNameConfigs)}
              selected={activeTab === ConfigTabIndex}
              disabled={player.inGame}
              onClick={() => { setActiveTab(ConfigTabIndex); }}
            />
            {!isOnSmallerScreen && <Divider orientation="vertical" flexItem />}
            {!isOnSmallerScreen && (
              <TabButton
                label={GetLocalizedString(Localization.TabNameAbout)}
                selected={activeTab === GameTabIndex}
                onClick={() => { setActiveTab(GameTabIndex); }}
              />
            )}
            <Divider orientation="vertical" flexItem />
            <TabButton
              label={GetLocalizedString(Localization.TabNameSourceCode)}
              selected={false}
              contained={false}
              underlinedText
              onClick={() => {
                window.open("https://github.com/lightbulb128/touhou-card-player-v3", "_blank");
              }}
            />
          </Stack>
          <CustomTabs activeTab={activeTab} onChange={setActiveTab} innerTabs={[
            <TabContainer key="player-tab">
              <PlayerTab
                data={globalData}
                playingOrder={playingOrder}
                musicSelection={musicSelection}
                characterTemporaryDisabled={characterTemporaryDisabled}
                currentCharacterId={currentCharacterId as CharacterId}
                audioRef={player.audioRef}
                duration={player.duration}
                playbackSetting={player.playbackSetting}
                playbackState={player.playbackState}
                volume={player.volume}
                setCharacterTemporaryDisabled={setCharacterTemporaryDisabled}
                setPlayingOrder={setPlayingOrder}
                setCurrentCharacterId={setCurrentCharacterId}
                onPlaySelection={player.playSelection}
                currentMusicInfo={player.currentMusicInfo}
                setPlaybackSetting={player.setPlaybackSetting}
                setPlaybackTime={player.setPlaybackTime}
                setVolume={player.setVolume}
                onPreviousMusic={player.previous}
                onNextMusic={player.next}
                onPlay={player.play}
                onPause={player.pause}
              ></PlayerTab>
            </TabContainer>,
            <TabContainer key="list-tab">
              <ListTab
                data={globalData}
                musicSelection={musicSelection}
                characterTemporaryDisabled={characterTemporaryDisabled}
                currentCharacterId={currentCharacterId as CharacterId}
                playingOrder={playingOrder}
                setCurrentCharacterId={setCurrentCharacterId}
                setCharacterTemporaryDisabled={setCharacterTemporaryDisabled}
                audioRef={player.audioRef}
                duration={player.duration}
                playbackState={player.playbackState}
                volume={player.volume}
                onPlaySelection={player.playSelection}
                currentMusicInfo={player.currentMusicInfo}
                setPlaybackTime={player.setPlaybackTime}
                setVolume={player.setVolume}
                onNextMusic={player.next}
                onPreviousMusic={player.previous}
                onPlay={player.play}
                onPause={player.pause}
              ></ListTab>
            </TabContainer>,
            <TabContainer key="config-tab">
              <ConfigTab
                data={globalData}
                musicSelection={musicSelection}
                playingOrder={playingOrder}
                currentCharacterId={currentCharacterId}
                setCardCollection={gameData.setCardCollection}
                setMusicSource={gameData.setMusicSource}
                onPreviewStart={player.pause}
                setMusicSelection={setMusicSelection}
                setPlayingOrder={setPlayingOrder}
                setCurrentCharacterId={setCurrentCharacterId}
              ></ConfigTab>
            </TabContainer>,
            <TabContainer key="game-tab">
              <GameTab
                data={globalData}
                musicSelection={musicSelection}
                characterTemporaryDisabled={characterTemporaryDisabled}
                currentCharacterId={currentCharacterId}
                playingOrder={playingOrder}
                playlists={playlists}
                activePlaylistId={activePlaylistId}
                activeGamePlaylist={activeGamePlaylist}
                onChooseGamePlaylist={chooseGamePlaylist}
                notifyPauseMusic={player.pauseForGame}
                notifyPlayMusic={player.play}
                playbackState={player.playbackState}
                playbackSetting={player.playbackSetting}
                volume={player.volume}
                musicStartTimestamp={player.musicStartTimestamp}
                notifyGameStart={player.startGame}
                notifyGameEnd={player.endGame}
                notifyPlayCountdownAudio={player.playCountdownAudio}
                setNextSongPRNGSeed={player.setNextSongPRNGSeed}
                setCurrentCharacterId={setCurrentCharacterId}
                setPlayingOrder={setPlayingOrder}
                setCharacterTemporaryDisabled={setCharacterTemporaryDisabled}
                setMusicSelection={setMusicSelection}
                setPlaybackSetting={player.setPlaybackSetting}
                setVolume={player.setVolume}
              ></GameTab>
            </TabContainer>
          ]}>
          </CustomTabs>
        </Stack>
      </Box></main></div>
      <PlaylistManager
        open={playlistOpen}
        onClose={() => { setPlaylistOpen(false); }}
        data={globalData}
        disabled={player.inGame}
        playlists={playlists}
        onPlaylistsChange={updatePlaylists}
        onPlayMusicQueue={player.playMusicQueue}
      />
    </ThemeProvider>
  );
}
