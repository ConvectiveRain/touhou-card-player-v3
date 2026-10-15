"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box, Button, Drawer, MenuItem, Select, Stack, Typography,
} from "@mui/material";
import Image from "next/image";
import { GlobalData, MusicSelectionMap } from "../types/Configs";
import { cardImageUrl } from "../lib/cardImages";
import { parseMusicInfo } from "../lib/music";
import { getFeatures } from "../lib/features";
import { fetchJson } from "../lib/fetchJson";
import { NoFontFamily, theme } from "./Theme";

/**
 * 顶部挑选面板：社团筛选 + 角色卡 + 专辑列表。
 *
 * 数据来自构建时按本地曲库生成的 library_local.json（专辑 -> 曲目 ID、角色 -> 社团）。
 * 角色本身仍用 GlobalData.characterConfigs，所以卡片、曲目列表与播放引擎共用同一套数据。
 */

type LibraryAlbum = {
  id: string;
  name: string;
  circle: string;
  date: string;
  cover?: boolean;
  music: string[];
};

type LibraryData = {
  circles: string[];
  albums: LibraryAlbum[];
  characterCircles: Record<string, string[]>;
};

const AllCircles = "全部";
const CardWidth = 92;
const CardHeight = Math.round(CardWidth / (703 / 1000));

export interface LibraryPickerProps {
  data: GlobalData;
  musicSelection: MusicSelectionMap;
  currentCharacterId: string;
  playingOrder: string[];
  setMusicSelection: (selection: MusicSelectionMap) => void;
  setPlayingOrder: (order: string[]) => void;
  setCurrentCharacterId: (id: string) => void;
  disabled?: boolean;
}

export default function LibraryPicker(props: LibraryPickerProps) {
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [circle, setCircle] = useState<string>(AllCircles);
  const [panel, setPanel] = useState<"characters" | "albums" | "tracks" | null>(null);
  const [keyword, setKeyword] = useState("");
  const [trackQuery, setTrackQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchJson("library_local.json")
      .then((json) => { if (!cancelled) { setLibrary(json as LibraryData); } })
      .catch(() => { if (!cancelled) { setLibrary(null); } });
    return () => { cancelled = true; };
  }, []);

  // musicId -> characterId，用来判断一张专辑里的某首曲子该由谁唱
  const characterOfMusic = useMemo(() => {
    const index = new Map<string, string>();
    props.data.characterConfigs.forEach((config, characterId) => {
      config.musics.forEach((musicId) => {
        if (!index.has(musicId)) { index.set(musicId, characterId); }
      });
    });
    return index;
  }, [props.data]);

  // 曲目索引：直接从角色配置里展开（曲目 ID 里就带着专辑和曲名）
  const allTracks = useMemo(() => {
    const list: Array<{
      characterId: string; index: number; musicId: string; title: string; album: string; haystack: string;
    }> = [];
    props.data.characterConfigs.forEach((config, characterId) => {
      config.musics.forEach((musicId, index) => {
        if (!props.data.sources.has(musicId)) { return; }
        const info = parseMusicInfo(musicId);
        list.push({
          characterId, index, musicId,
          title: info.title, album: info.album,
          haystack: `${info.title} ${info.album} ${characterId}`.toLowerCase(),
        });
      });
    });
    return list;
  }, [props.data]);

  const circleOfCharacter = (characterId: string): string[] => {
    const circles = library?.characterCircles[characterId];
    return Array.isArray(circles) ? circles : [];
  };

  const characters = useMemo(() => {
    const list: Array<{ id: string; card: string }> = [];
    const lowered = keyword.toLowerCase();
    props.data.characterConfigs.forEach((config, characterId) => {
      if (circle !== AllCircles && !circleOfCharacter(characterId).includes(circle)) { return; }
      if (keyword
        && !characterId.toLowerCase().includes(lowered)
        && !(config.searchNames || []).some((name) => name.toLowerCase().includes(lowered))) {
        return;
      }
      list.push({ id: characterId, card: config.card[0] });
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.data, library, circle, keyword]);

  const albums = useMemo(() => {
    if (!library) { return []; }
    const lowered = keyword.toLowerCase();
    return library.albums.filter((album) => {
      if (circle !== AllCircles && album.circle !== circle) { return false; }
      if (!keyword) { return true; }
      return album.name.toLowerCase().includes(lowered) || album.circle.toLowerCase().includes(lowered);
    });
  }, [library, circle, keyword]);

  // 点角色卡：不在队列里就加进去，然后切到它
  const pickCharacter = (characterId: string) => {
    if (!props.playingOrder.includes(characterId)) {
      props.setPlayingOrder([...props.playingOrder, characterId]);
    }
    props.setCurrentCharacterId(characterId);
  };

  // 点专辑：把这张专辑里的每首曲子交给它对应的角色去唱
  const pickAlbum = (album: LibraryAlbum) => {
    const selection = new Map(props.musicSelection);
    const order = [...props.playingOrder];
    let first: string | null = null;
    album.music.forEach((musicId) => {
      const characterId = characterOfMusic.get(musicId);
      if (!characterId) { return; }
      const config = props.data.characterConfigs.get(characterId);
      if (!config) { return; }
      const index = config.musics.indexOf(musicId);
      if (index < 0) { return; }
      selection.set(characterId, index);
      if (!order.includes(characterId)) { order.push(characterId); }
      if (first === null) { first = characterId; }
    });
    props.setMusicSelection(selection);
    props.setPlayingOrder(order);
    if (first !== null) { props.setCurrentCharacterId(first); }
  };

  // 点具体某一首：把该角色切到这一首，并保证它在队列里
  const playTrack = (characterId: string, index: number) => {
    const selection = new Map(props.musicSelection);
    selection.set(characterId, index);
    props.setMusicSelection(selection);
    if (!props.playingOrder.includes(characterId)) {
      props.setPlayingOrder([...props.playingOrder, characterId]);
    }
    props.setCurrentCharacterId(characterId);
  };

  // 曲目列表：不输关键词时显示「当前角色」的歌，输了就在全部曲目里搜
  const shownTracks = useMemo(() => {
    const query = trackQuery.trim().toLowerCase();
    if (!query) {
      return allTracks.filter((track) => track.characterId === props.currentCharacterId).slice(0, 300);
    }
    return allTracks.filter((track) => track.haystack.includes(query)).slice(0, 300);
  }, [allTracks, trackQuery, props.currentCharacterId]);

  if (!library) { return null; }

  const features = getFeatures();
  const toggle = (which: "characters" | "albums" | "tracks") => {
    setPanel((current) => (current === which ? null : which));
  };
  const smallText = { fontFamily: NoFontFamily, fontSize: "0.8em", color: "text.secondary" };

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
      <Select
        size="small"
        value={circle}
        disabled={props.disabled}
        onChange={(event) => { setCircle(event.target.value); }}
        sx={{ fontFamily: NoFontFamily, fontSize: "0.78em", minWidth: "6.5em" }}
      >
        {[AllCircles, ...library.circles].map((name) => (
          <MenuItem key={name} value={name} sx={{ fontFamily: NoFontFamily, fontSize: "0.85em" }}>
            {name}
          </MenuItem>
        ))}
      </Select>
      <Button
          size="small"
          variant={panel === "characters" ? "contained" : "text"}
          disabled={props.disabled}
          onClick={() => { toggle("characters"); }}
        >
          角色卡
        </Button>
        <Button
          size="small"
          variant={panel === "albums" ? "contained" : "text"}
          disabled={props.disabled}
          onClick={() => { toggle("albums"); }}
        >
          专辑
        </Button>
        <Button
          size="small"
          variant={panel === "tracks" ? "contained" : "text"}
          disabled={props.disabled}
          onClick={() => { toggle("tracks"); }}
        >
          曲目
        </Button>
      </Stack>

      <Drawer
        anchor="right"
        open={panel !== null}
        onClose={() => { setPanel(null); }}
      >
        <Box sx={{
          width: 440, maxWidth: "94vw", padding: 1.5,
          backgroundColor: theme.custom.mainTabBackground, height: "100%",
        }}>
          {panel !== "tracks" && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ marginBottom: 1 }}>
            <input
              value={keyword}
              onChange={(event) => { setKeyword(event.target.value); }}
              placeholder={panel === "characters" ? "搜角色名（中/日/罗马字）" : "搜专辑名或社团名"}
              style={{
                flex: 1, padding: "4px 8px", fontSize: "0.85em",
                backgroundColor: "transparent", color: "inherit",
                border: "1px solid rgba(255,255,255,0.25)", borderRadius: 4,
              }}
            />
            <Typography sx={smallText}>
              {panel === "characters" ? `${characters.length} 个角色` : `${albums.length} 张专辑`}
            </Typography>
          </Stack>
          )}

          {panel === "tracks" && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ marginBottom: 1 }}>
              <input
                value={trackQuery}
                onChange={(event) => { setTrackQuery(event.target.value); }}
                placeholder="搜曲名 / 专辑 / 角色；留空则显示当前角色的全部曲目"
                style={{
                  flex: 1, padding: "4px 8px", fontSize: "0.85em",
                  backgroundColor: "transparent", color: "inherit",
                  border: "1px solid rgba(255,255,255,0.25)", borderRadius: 4,
                }}
              />
              <Typography sx={smallText}>
                {trackQuery ? `${shownTracks.length} 首（最多列 300）` : `当前角色：${props.currentCharacterId || "—"}（${shownTracks.length} 首）`}
              </Typography>
            </Stack>
          )}

          {panel === "tracks" && (
            <Box sx={{ maxHeight: "42vh", overflowY: "auto" }}>
              {shownTracks.length === 0 && (
                <Typography sx={{ ...smallText, padding: "6px" }}>
                  没有曲目。先点一张角色卡，或换个关键词。
                </Typography>
              )}
              {shownTracks.map((track) => {
                const active = props.musicSelection.get(track.characterId) === track.index;
                return (
                  <Box
                    key={`${track.characterId}-${track.musicId}`}
                    onClick={() => { if (!props.disabled) { playTrack(track.characterId, track.index); } }}
                    sx={{
                      display: "flex", alignItems: "center", gap: 1, padding: "3px 6px",
                      cursor: props.disabled ? "default" : "pointer", borderRadius: 1,
                      backgroundColor: active ? "rgba(193,72,72,0.35)" : "transparent",
                      "&:hover": { backgroundColor: "rgba(255,255,255,0.08)" },
                    }}
                  >
                    <Typography sx={{
                      fontFamily: NoFontFamily, fontSize: "0.85em", flex: 1,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {track.title}
                    </Typography>
                    <Typography sx={{
                      ...smallText, fontSize: "0.72em", maxWidth: "38%",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {track.album}
                    </Typography>
                    <Typography sx={{ ...smallText, fontSize: "0.72em" }}>{track.characterId}</Typography>
                  </Box>
                );
              })}
            </Box>
          )}

          {panel === "characters" && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, maxHeight: "42vh", overflowY: "auto" }}>
              {characters.map((character) => {
                const selected = character.id === props.currentCharacterId;
                const queued = props.playingOrder.includes(character.id);
                return (
                  <Box
                    key={character.id}
                    onClick={() => { if (!props.disabled) { pickCharacter(character.id); } }}
                    title={character.id}
                    sx={{
                      width: CardWidth, cursor: props.disabled ? "default" : "pointer",
                      border: "2px solid",
                      borderColor: selected ? "primary.main" : (queued ? "success.main" : "transparent"),
                      borderRadius: 1, opacity: queued ? 1 : 0.72,
                      "&:hover": { opacity: 1 },
                    }}
                  >
                    <Image
                      src={cardImageUrl(props.data.cardCollection, character.card, features.useR2)}
                      alt={character.id}
                      width={CardWidth}
                      height={CardHeight}
                      style={{ display: "block", width: "100%", height: "auto" }}
                    />
                    <Typography sx={{
                      fontFamily: NoFontFamily, fontSize: "0.7em", textAlign: "center",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {character.id}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )}

          {panel === "albums" && (
            <Box sx={{ maxHeight: "42vh", overflowY: "auto" }}>
              {albums.map((album) => (
                <Box
                  key={album.id}
                  onClick={() => { if (!props.disabled) { pickAlbum(album); } }}
                  sx={{
                    display: "flex", alignItems: "center", gap: 1, padding: "3px 6px",
                    cursor: props.disabled ? "default" : "pointer", borderRadius: 1,
                    "&:hover": { backgroundColor: "rgba(255,255,255,0.08)" },
                  }}
                >
                  {album.cover && (
                    <Image
                      src={`covers_local/${album.id}.jpg`}
                      alt={album.name}
                      width={34}
                      height={34}
                      style={{ borderRadius: 3, display: "block", flexShrink: 0 }}
                    />
                  )}
                  <Typography sx={{
                    fontFamily: NoFontFamily, fontSize: "0.85em", flex: 1,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {album.name}
                  </Typography>
                  <Typography sx={{ ...smallText, fontSize: "0.72em" }}>{album.circle}</Typography>
                  <Typography sx={{ ...smallText, fontSize: "0.72em" }}>{album.music.length} 首</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Drawer>
    </Stack>
  );
}
