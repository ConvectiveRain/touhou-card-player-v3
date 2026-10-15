"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box, Button, Checkbox, Divider, Drawer, MenuItem, Select, Stack, ToggleButton, ToggleButtonGroup,
  Typography,
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

/** 社团多选里的「全部社团」哨兵项；它只出现在下拉里，不会进 state——空数组就代表不筛社团。 */
const AllCircles = "__all_circles__";
const AllCirclesLabel = "全部社团";
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
  /** 点角色卡 / 专辑 / 曲目之后让播放器直接开始放这一首。 */
  onPlaySelection: () => void;
  disabled?: boolean;
}

/**
 * 点过的专辑。`anchor` 是点它时切过去的那位角色：只要还在播这位角色就显示这张专辑的曲目，
 * 一旦播放走到别的角色（点了下一首 / 上一首、点了别的卡或列表行），列表自动回到跟随当前角色。
 */
type AlbumBrowse = { album: LibraryAlbum; anchor: string };

export default function LibraryPicker(props: LibraryPickerProps) {
  const [library, setLibrary] = useState<LibraryData | null>(null);
  /** 勾选的社团；空数组 = 全部社团（不筛）。 */
  const [circles, setCircles] = useState<Array<string>>([]);
  const [topPanel, setTopPanel] = useState<"characters" | "albums">("characters");
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [trackQuery, setTrackQuery] = useState("");
  const [browsedAlbum, setBrowsedAlbum] = useState<AlbumBrowse | null>(null);

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
    const list = library?.characterCircles[characterId];
    return Array.isArray(list) ? list : [];
  };

  /** 勾「全部社团」= 清空筛选；从「全部」直接勾某个社团就从它开始。 */
  const toggleCircles = (next: Array<string>) => {
    if (next.includes(AllCircles)) {
      setCircles(next.length === 1 ? [] : next.filter((name) => name !== AllCircles));
      return;
    }
    setCircles(next);
  };

  const characters = useMemo(() => {
    const list: Array<{ id: string; card: string }> = [];
    const lowered = keyword.toLowerCase();
    props.data.characterConfigs.forEach((config, characterId) => {
      if (circles.length > 0 && !circleOfCharacter(characterId).some((name) => circles.includes(name))) {
        return;
      }
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
  }, [props.data, library, circles, keyword, props.playingOrder]);

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
      if (circles.length > 0 && !circles.includes(album.circle)) { return false; }
      // 单原曲模式下把整张都出局的专辑藏起来（和本地播放器一致）
      if (props.scope === "single" && (albumTracks.get(album.id)?.length ?? 0) === 0) { return false; }
      if (!keyword) { return true; }
      return album.name.toLowerCase().includes(lowered) || album.circle.toLowerCase().includes(lowered);
    });
  }, [library, circles, keyword, albumTracks, props.scope]);

  // 点角色卡：不在队列里就加进去，然后切到它
  const pickCharacter = (characterId: string) => {
    if (!props.playingOrder.includes(characterId)) {
      props.setPlayingOrder([...props.playingOrder, characterId]);
    }
    props.setCurrentCharacterId(characterId);
    setBrowsedAlbum(null);
    props.onPlaySelection();
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
    setBrowsedAlbum({ album, anchor: first ?? "" });
    props.onPlaySelection();
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
    // 看专辑时点里面的某一首：继续看这张专辑，只是把"锚点"换成这位角色
    if (albumBrowse) { setBrowsedAlbum({ album: albumBrowse.album, anchor: characterId }); }
    props.onPlaySelection();
  };

  /**
   * 曲目列表：默认跟着当前正在播的角色走（点下一首 / 上一首就跟着换人）；
   * 点过专辑、且还没离开这张专辑的锚点角色时，改显示这张专辑的全部曲目。
   * 输入关键词时在全部曲目里搜。
   */
  const albumBrowse = browsedAlbum && browsedAlbum.anchor === props.currentCharacterId
    ? browsedAlbum
    : null;

  const shownTracks = useMemo(() => {
    const query = trackQuery.trim().toLowerCase();
    if (query) {
      return allTracks.filter((track) => track.haystack.includes(query)).slice(0, 300);
    }
    if (albumBrowse) {
      const list = [];
      for (const musicId of albumBrowse.album.music) {
        const characterId = characterOfMusic.get(musicId);
        if (!characterId) { continue; }
        const config = props.data.characterConfigs.get(characterId);
        const index = config ? config.musics.indexOf(musicId) : -1;
        if (!config || index < 0) { continue; }
        const info = parseMusicInfo(musicId);
        list.push({
          characterId, index, musicId,
          title: info.title, album: info.album,
          haystack: `${info.title} ${info.album} ${characterId}`.toLowerCase(),
        });
      }
      return list.slice(0, 300);
    }
    return allTracks.filter((track) => track.characterId === props.currentCharacterId).slice(0, 300);
  }, [allTracks, trackQuery, albumBrowse, characterOfMusic, props.data, props.currentCharacterId]);

  // 列表上面那行小字：现在看的是谁 / 哪张专辑
  const listCaption = trackQuery
    ? `${shownTracks.length} 首（最多列 300）`
    : albumBrowse
      ? `专辑：${albumBrowse.album.name}（${shownTracks.length} 首）`
      : `当前角色：${props.currentCharacterId || "—"}（${shownTracks.length} 首）`;

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
        multiple
        displayEmpty
        size="small"
        value={circles}
        disabled={props.disabled}
        onChange={(event) => { toggleCircles(event.target.value as Array<string>); }}
        // 空数组读作「全部社团」；勾了一个以上就缩写显示
        renderValue={() => (circles.length === 0
          ? AllCirclesLabel
          : (circles.length === 1 ? circles[0] : `${circles[0]} 等 ${circles.length} 个社团`))}
        sx={{ fontFamily: NoFontFamily, fontSize: "0.78em", minWidth: "8em", maxWidth: "13em" }}
      >
        <MenuItem key={AllCircles} value={AllCircles} sx={{ fontFamily: NoFontFamily, fontSize: "0.85em" }}>
          <Checkbox size="small" sx={{ padding: "2px", marginRight: "6px" }} checked={circles.length === 0} />
          {AllCirclesLabel}
        </MenuItem>
        {library.circles.map((name) => (
          <MenuItem key={name} value={name} sx={{ fontFamily: NoFontFamily, fontSize: "0.85em" }}>
            <Checkbox size="small" sx={{ padding: "2px", marginRight: "6px" }} checked={circles.includes(name)} />
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
                placeholder="搜曲名 / 专辑 / 角色；留空则显示所点角色或专辑的全部曲目"
                style={{
                  flex: 1, padding: "4px 8px", fontSize: "0.85em",
                  backgroundColor: "transparent", color: "inherit",
                  border: "1px solid rgba(255,255,255,0.25)", borderRadius: 4,
                }}
              />
              <Typography sx={smallText}>
                {listCaption}
              </Typography>
          </Stack>

          <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", order: 4 }}>
              {shownTracks.length === 0 && (
                <Typography sx={{ ...smallText, padding: "6px" }}>
                  {albumBrowse
                    ? "这张专辑在当前曲目范围里没有可播的曲目。"
                    : "没有曲目。先点一张角色卡，或换个关键词。"}
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
                // 正在看的这张专辑高亮一下
                const browsing = albumBrowse?.album.id === album.id;
                return (
                <Box
                  key={album.id}
                  onClick={() => { if (!props.disabled) { pickAlbum(album); } }}
                  sx={{
                    display: "flex", alignItems: "center", gap: 1, padding: "3px 6px",
                    cursor: props.disabled ? "default" : "pointer", borderRadius: 1,
                    backgroundColor: browsing ? "rgba(193,72,72,0.28)" : "transparent",
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
