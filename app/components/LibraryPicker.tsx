"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box, Button, Divider, Drawer, MenuItem, Select, Stack, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import Image from "next/image";
import { GlobalData, MusicSelectionMap } from "../types/Configs";
import { cardImageUrl } from "../lib/cardImages";
import { parseMusicInfo } from "../lib/music";
import { getFeatures } from "../lib/features";
import { fetchJson } from "../lib/fetchJson";
import { MusicScope } from "../lib/originalScope";
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
/** 面板宽度；宽屏时页面内容整体左移这么多，面板就不会盖住任何东西 */
const DrawerWidth = 400;

export interface LibraryPickerProps {
  data: GlobalData;
  musicSelection: MusicSelectionMap;
  currentCharacterId: string;
  playingOrder: string[];
  /** 全部曲目 / 仅单原曲；曲目范围由上层过滤数据集决定，这里只管开关。 */
  scope: MusicScope;
  setScope: (scope: MusicScope) => void;
  setMusicSelection: (selection: MusicSelectionMap) => void;
  setPlayingOrder: (order: string[]) => void;
  setCurrentCharacterId: (id: string) => void;
  disabled?: boolean;
}

export default function LibraryPicker(props: LibraryPickerProps) {
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [circle, setCircle] = useState<string>(AllCircles);
  const [topPanel, setTopPanel] = useState<"characters" | "albums">("characters");
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [trackQuery, setTrackQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchJson("library_local.json")
      .then((json) => { if (!cancelled) { setLibrary(json as LibraryData); } })
      .catch(() => { if (!cancelled) { setLibrary(null); } });
    return () => { cancelled = true; };
  }, []);

  // 宽屏打开面板时给 body 留出右边距，让面板与内容并排而不是压在内容上
  useEffect(() => {
    const wide = typeof window !== "undefined" && window.innerWidth >= 900;
    const previous = document.body.style.paddingRight;
    if (open && wide) {
      document.body.style.paddingRight = `${DrawerWidth}px`;
    }
    return () => { document.body.style.paddingRight = previous; };
  }, [open]);

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
    // 已在队列里的角色按抽选顺序排在前面，其余保持原顺序
    const rank = new Map(props.playingOrder.map((id, i) => [id, i] as const));
    return list.sort((a, b) => {
      const ra = rank.has(a.id) ? (rank.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
      const rb = rank.has(b.id) ? (rank.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.data, library, circle, keyword, props.playingOrder]);

  // 每张专辑在当前模式下真正能播的曲目：多归属曲目在「仅单原曲」里已被摘掉，
  // 上游数据里没人认领的曲目（没有原曲信息）本来也点不动，一并排除。
  const albumTracks = useMemo(() => {
    const map = new Map<string, string[]>();
    (library?.albums ?? []).forEach((album) => {
      map.set(album.id, album.music.filter((musicId) => characterOfMusic.has(musicId)));
    });
    return map;
  }, [library, characterOfMusic]);

  const albums = useMemo(() => {
    if (!library) { return []; }
    const lowered = keyword.toLowerCase();
    return library.albums.filter((album) => {
      if (circle !== AllCircles && album.circle !== circle) { return false; }
      // 单原曲模式下把整张都出局的专辑藏起来（和本地播放器一致）
      if (props.scope === "single" && (albumTracks.get(album.id)?.length ?? 0) === 0) { return false; }
      if (!keyword) { return true; }
      return album.name.toLowerCase().includes(lowered) || album.circle.toLowerCase().includes(lowered);
    });
  }, [library, circle, keyword, albumTracks, props.scope]);

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
  // 再点一次同一个按钮就收起面板
  const openSection = (which: "characters" | "albums") => {
    if (open && topPanel === which) { setOpen(false); return; }
    setTopPanel(which);
    setOpen(true);
  };
  const smallText = { fontFamily: NoFontFamily, fontSize: "0.8em", color: "text.secondary" };

  return (
    <>
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={props.scope}
        disabled={props.disabled}
        onChange={(_event, next: MusicScope | null) => { if (next) { props.setScope(next); } }}
        sx={{
          "& .MuiToggleButton-root": {
            fontFamily: NoFontFamily, fontSize: "0.78em", padding: "2px 8px", textTransform: "none",
          },
        }}
      >
        <ToggleButton value="all" title="全部曲目：一首曲子改编了多首原曲时，会同时算到涉及的每位角色名下">
          全部曲目
        </ToggleButton>
        <ToggleButton value="single" title="仅单原曲（默认）：只保留角色归属唯一的曲子——角色曲恰好一首，或多首角色曲全指向同一位角色">
          仅单原曲
        </ToggleButton>
      </ToggleButtonGroup>
      <Divider orientation="vertical" flexItem />
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
          variant={open && topPanel === "characters" ? "contained" : "text"}
          disabled={props.disabled}
          onClick={() => { openSection("characters"); }}
        >
          角色卡
        </Button>
        <Button
          size="small"
          variant={open && topPanel === "albums" ? "contained" : "text"}
          disabled={props.disabled}
          onClick={() => { openSection("albums"); }}
        >
          专辑
        </Button>
        <Button
          size="small"
          variant={open ? "outlined" : "text"}
          disabled={props.disabled}
          onClick={() => { setOpen((current) => !current); }}
        >
          曲目
        </Button>
      </Stack>

      <Drawer
        anchor="right"
        variant="persistent"
        open={open}
        onClose={() => { setOpen(false); }}
        sx={{
          "& .MuiDrawer-paper": {
            top: "64px",
            height: "calc(100% - 64px)",
            width: { xs: "100%", md: DrawerWidth },
            maxWidth: "100%",
            backgroundColor: theme.custom.mainTabBackground,
            borderLeft: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        <Box sx={{
          width: "100%", padding: 1.5, height: "100%",
          display: "flex", flexDirection: "column", gap: 1,
        }}>
          {(
          <Stack direction="row" spacing={1} alignItems="center">
            <input
              value={keyword}
              onChange={(event) => { setKeyword(event.target.value); }}
              placeholder={topPanel === "characters" ? "搜角色名（中/日/罗马字）" : "搜专辑名或社团名"}
              style={{
                flex: 1, padding: "4px 8px", fontSize: "0.85em",
                backgroundColor: "transparent", color: "inherit",
                border: "1px solid rgba(255,255,255,0.25)", borderRadius: 4,
              }}
            />
            <Typography sx={smallText}>
              {topPanel === "characters" ? `${characters.length} 个角色` : `${albums.length} 张专辑`}
            </Typography>
          </Stack>
          )}

          <Divider sx={{ order: 2 }} />

          <Stack direction="row" spacing={1} alignItems="center" sx={{ order: 3 }}>
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

          <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", order: 4 }}>
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

          {topPanel === "characters" && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, maxHeight: "34vh", overflowY: "auto", order: 1 }}>
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

          {topPanel === "albums" && (
            <Box sx={{ maxHeight: "34vh", overflowY: "auto", order: 1 }}>
              {albums.map((album) => {
                // 单原曲模式下这里显示的是切过去真能排进队列的首数；全部曲目保持原来的数字
                const tracks = props.scope === "single"
                  ? (albumTracks.get(album.id) ?? [])
                  : album.music;
                return (
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
                  <Typography sx={{ ...smallText, fontSize: "0.72em" }}>{tracks.length} 首</Typography>
                </Box>
                );
              })}
              {albums.length === 0 && (
                <Typography sx={{ ...smallText, padding: "6px" }}>
                  没有专辑。换个社团 / 关键词，或切到「全部曲目」。
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Drawer>
    </>
  );
}
