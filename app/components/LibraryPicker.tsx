"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, Button, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import Image from "next/image";
import { GlobalData, MusicSelectionMap } from "../types/Configs";
import { cardImageUrl } from "../lib/cardImages";
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
  const [panel, setPanel] = useState<"characters" | "albums" | null>(null);
  const [keyword, setKeyword] = useState("");

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

  if (!library) { return null; }

  const features = getFeatures();
  const toggle = (which: "characters" | "albums") => {
    setPanel((current) => (current === which ? null : which));
  };
  const smallText = { fontFamily: NoFontFamily, fontSize: "0.8em", color: "text.secondary" };

  return (
    <Paper sx={{
      width: "100%", padding: 1, backgroundColor: theme.custom.mainTabBackground,
      border: "1px solid", borderColor: "divider",
    }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography sx={{ fontFamily: NoFontFamily, fontSize: "0.85em", color: "text.secondary" }}>
          社团
        </Typography>
        {[AllCircles, ...library.circles].map((name) => (
          <Chip
            key={name}
            label={name}
            size="small"
            color={circle === name ? "primary" : "default"}
            variant={circle === name ? "filled" : "outlined"}
            disabled={props.disabled}
            onClick={() => { setCircle(name); }}
          />
        ))}
        <Divider orientation="vertical" flexItem />
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
      </Stack>

      {panel !== null && (
        <Box sx={{ marginTop: 1 }}>
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
      )}
    </Paper>
  );
}
