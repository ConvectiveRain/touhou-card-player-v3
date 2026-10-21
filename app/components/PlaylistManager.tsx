"use client";

import { useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Divider, Drawer, Stack, TextField, Typography,
} from "@mui/material";
import { GlobalData } from "../types/Configs";
import { parseMusicInfo } from "../lib/music";
import {
  addUniqueTracks, createPlaylist, MusicPlaylist, normalizePlaylistStore, PlaylistTrack,
} from "../lib/playlists";
import { NoFontFamily, theme } from "./Theme";
import PlaylistTrackActions from "./PlaylistTrackActions";

type IndexedTrack = {
  musicId: string;
  characterId: string;
  index: number;
  title: string;
  album: string;
  haystack: string;
};

export interface PlaylistManagerProps {
  open: boolean;
  onClose: () => void;
  data: GlobalData;
  disabled?: boolean;
  playlists: Array<MusicPlaylist>;
  activePlaylistId: string;
  onPlaylistsChange: (playlists: Array<MusicPlaylist>) => void;
  onSelectPlaylist: (playlistId: string) => void;
  onPlayPlaylist: (playlistId: string) => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeTrack(track: IndexedTrack): PlaylistTrack {
  return {
    musicId: track.musicId,
    characterId: track.characterId,
    title: track.title,
    album: track.album,
    addedAt: nowIso(),
  };
}

export default function PlaylistManager(props: PlaylistManagerProps) {
  const [requestedPlaylistId, setRequestedPlaylistId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState("");
  const importRef = useRef<HTMLInputElement | null>(null);

  const activePlaylistId = props.playlists.some(
    (playlist) => playlist.id === props.activePlaylistId,
  ) ? props.activePlaylistId : "";
  const selectedPlaylistId = activePlaylistId || (
    props.playlists.some((playlist) => playlist.id === requestedPlaylistId)
      ? requestedPlaylistId
      : (props.playlists[0]?.id ?? "")
  );
  const selectedPlaylist = props.playlists.find(
    (playlist) => playlist.id === selectedPlaylistId,
  ) ?? null;

  const allTracks = useMemo(() => {
    const seen = new Set<string>();
    const tracks: Array<IndexedTrack> = [];
    props.data.characterConfigs.forEach((config, characterId) => {
      config.musics.forEach((musicId, index) => {
        if (seen.has(musicId) || !props.data.sources.has(musicId)) { return; }
        seen.add(musicId);
        const info = parseMusicInfo(musicId);
        tracks.push({
          musicId, characterId, index,
          title: info.title, album: info.album,
          haystack: `${info.title} ${info.album} ${characterId}`.toLowerCase(),
        });
      });
    });
    return tracks;
  }, [props.data]);

  const shownTracks = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    if (!lowered) { return allTracks.slice(0, 300); }
    return allTracks
      .filter((track) => track.haystack.includes(lowered))
      .slice(0, 300);
  }, [allTracks, query]);

  const commit = (next: Array<MusicPlaylist>) => {
    props.onPlaylistsChange(next);
  };

  const updatePlaylist = (nextPlaylist: MusicPlaylist) => {
    commit(props.playlists.map((playlist) => (
      playlist.id === nextPlaylist.id ? nextPlaylist : playlist
    )));
  };

  const createNew = () => {
    const name = newName.trim();
    if (!name) { setStatus("请先输入歌单名称。"); return; }
    const playlist = createPlaylist(name);
    commit([...props.playlists, playlist]);
    setRequestedPlaylistId(playlist.id);
    props.onSelectPlaylist(playlist.id);
    setNewName("");
    setStatus(`已新建《${playlist.name}》。`);
  };

  const addPickedTracks = () => {
    if (!selectedPlaylist) {
      setStatus("请先新建或选择一份歌单。");
      return;
    }
    const incoming = shownTracks
      .filter((track) => picked.has(track.musicId))
      .map(makeTrack);
    const tracks = addUniqueTracks(selectedPlaylist.tracks, incoming);
    const added = tracks.length - selectedPlaylist.tracks.length;
    updatePlaylist({ ...selectedPlaylist, tracks, updatedAt: nowIso() });
    setPicked(new Set());
    setStatus(added > 0 ? `已加入 ${added} 首。` : "这些曲目已经在歌单中。");
  };

  const playPlaylist = () => {
    if (!selectedPlaylist || selectedPlaylist.tracks.length === 0) {
      setStatus("这份歌单还没有曲目。");
      return;
    }
    props.onPlayPlaylist(selectedPlaylist.id);
    setStatus(`开始播放《${selectedPlaylist.name}》。`);
  };

  const exportPlaylists = () => {
    const content = JSON.stringify({
      version: 1,
      exportedAt: nowIso(),
      playlists: props.playlists,
    }, null, 2);
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    link.download = `touhou-cards-playlists-${nowIso().slice(0, 10)}.json`;
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const importPlaylists = async (file: File | null) => {
    if (!file) { return; }
    try {
      const parsed = normalizePlaylistStore(JSON.parse(await file.text()));
      if (!window.confirm(
        `导入会替换当前浏览器里的 ${props.playlists.length} 份歌单，是否继续？`,
      )) { return; }
      commit(parsed.playlists);
      setRequestedPlaylistId(parsed.playlists[0]?.id ?? "");
      setPicked(new Set());
      setStatus(`已导入 ${parsed.playlists.length} 份歌单。`);
    } catch (error) {
      console.error("[playlists] import failed", error);
      setStatus("导入失败：文件不是有效的歌单 JSON。");
    }
  };

  const smallText = {
    fontFamily: NoFontFamily,
    fontSize: "0.78em",
    color: "text.secondary",
  };

  return (
    <Drawer
      anchor="right"
      open={props.open}
      onClose={props.onClose}
      sx={{
        "& .MuiDrawer-paper": {
          width: { xs: "100%", md: 560 },
          maxWidth: "100%",
          backgroundColor: theme.custom.mainTabBackground,
        },
      }}
    >
      <Box sx={{ padding: 2, height: "100%", display: "flex", flexDirection: "column", gap: 1.25 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography sx={{ fontSize: "1.2em", fontWeight: 700, flex: 1 }}>
            我的歌单
          </Typography>
          <Button size="small" onClick={() => { importRef.current?.click(); }}>导入</Button>
          <Button size="small" onClick={exportPlaylists}>导出</Button>
          <Button size="small" onClick={props.onClose}>关闭</Button>
        </Stack>

        <Stack direction="row" spacing={0.75}>
          <TextField
            size="small"
            value={newName}
            onChange={(event) => { setNewName(event.target.value); }}
            placeholder="新歌单名称"
            inputProps={{ maxLength: 120 }}
            sx={{ flex: 1, "& input": { fontFamily: NoFontFamily, fontSize: "0.82em" } }}
          />
          <Button size="small" variant="contained" onClick={createNew}>新建</Button>
        </Stack>

        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          <Button
            data-testid="playlist-free-mode"
            size="small"
            variant={activePlaylistId ? "outlined" : "contained"}
            onClick={() => {
              props.onSelectPlaylist("");
              setRequestedPlaylistId("");
              setPicked(new Set());
              setStatus("已取消歌单限制，恢复自由播放。");
            }}
            sx={{ fontFamily: NoFontFamily, fontSize: "0.76em", textTransform: "none" }}
          >
            自由播放（不限制）
          </Button>
          {props.playlists.map((playlist) => (
            <Button
              key={playlist.id}
              size="small"
              variant={playlist.id === activePlaylistId ? "contained" : "outlined"}
              onClick={() => {
                setRequestedPlaylistId(playlist.id);
                props.onSelectPlaylist(playlist.id);
                setPicked(new Set());
                setStatus("");
              }}
              sx={{ fontFamily: NoFontFamily, fontSize: "0.76em", textTransform: "none" }}
            >
              {playlist.name}（{playlist.tracks.length}）
            </Button>
          ))}
        </Stack>

        {selectedPlaylist && (
          <>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Button size="small" variant="contained" onClick={playPlaylist}>播放歌单</Button>
              <Button
                size="small"
                onClick={() => {
                  const name = window.prompt("歌单名称：", selectedPlaylist.name);
                  if (!name || !name.trim()) { return; }
                  updatePlaylist({
                    ...selectedPlaylist,
                    name: name.trim().slice(0, 120),
                    updatedAt: nowIso(),
                  });
                }}
              >
                改名
              </Button>
              <Button
                size="small"
                color="error"
                onClick={() => {
                  if (!window.confirm(`删除歌单《${selectedPlaylist.name}》？`)) { return; }
                  commit(props.playlists.filter((playlist) => playlist.id !== selectedPlaylist.id));
                  if (props.activePlaylistId === selectedPlaylist.id) {
                    props.onSelectPlaylist("");
                  }
                  setRequestedPlaylistId("");
                  setStatus("歌单已删除。");
                }}
              >
                删除
              </Button>
              <Typography sx={{ ...smallText, marginLeft: "auto" }}>
                {selectedPlaylist.tracks.length} 首
              </Typography>
            </Stack>

            <Box sx={{ maxHeight: "30vh", overflowY: "auto", border: "1px solid", borderColor: "divider" }}>
              {selectedPlaylist.tracks.map((track, index) => (
                <Stack
                  key={track.musicId}
                  data-testid="playlist-track"
                  direction="row"
                  alignItems="center"
                  spacing={0.5}
                  sx={{ padding: "4px 6px", "&:not(:last-of-type)": { borderBottom: "1px solid", borderColor: "divider" } }}
                >
                  <Typography sx={{ ...smallText, width: "2em" }}>{index + 1}</Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{
                      fontFamily: NoFontFamily, fontSize: "0.82em",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {track.title || parseMusicInfo(track.musicId).title}
                    </Typography>
                    <Typography sx={{
                      ...smallText, fontSize: "0.68em",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {track.characterId} · {track.album || parseMusicInfo(track.musicId).album}
                    </Typography>
                  </Box>
                  <PlaylistTrackActions
                    track={track}
                    playlists={props.playlists}
                    onPlaylistsChange={props.onPlaylistsChange}
                    preferredPlaylistId={selectedPlaylistId}
                    disabled={props.disabled}
                    onStatus={setStatus}
                    onAfterAdd={setRequestedPlaylistId}
                  />
                  <Button
                    size="small"
                    disabled={index === 0}
                    onClick={() => {
                      const tracks = selectedPlaylist.tracks.slice();
                      [tracks[index - 1], tracks[index]] = [tracks[index], tracks[index - 1]];
                      updatePlaylist({ ...selectedPlaylist, tracks, updatedAt: nowIso() });
                    }}
                  >↑</Button>
                  <Button
                    size="small"
                    disabled={index === selectedPlaylist.tracks.length - 1}
                    onClick={() => {
                      const tracks = selectedPlaylist.tracks.slice();
                      [tracks[index + 1], tracks[index]] = [tracks[index], tracks[index + 1]];
                      updatePlaylist({ ...selectedPlaylist, tracks, updatedAt: nowIso() });
                    }}
                  >↓</Button>
                  <Button
                    size="small"
                    onClick={() => {
                      updatePlaylist({
                        ...selectedPlaylist,
                        tracks: selectedPlaylist.tracks.filter((item) => item.musicId !== track.musicId),
                        updatedAt: nowIso(),
                      });
                    }}
                  >移除</Button>
                </Stack>
              ))}
              {selectedPlaylist.tracks.length === 0 && (
                <Typography sx={{ ...smallText, padding: 1.5 }}>还没有曲目，从下方勾选加入。</Typography>
              )}
            </Box>
          </>
        )}

        <Divider />

        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            value={query}
            onChange={(event) => { setQuery(event.target.value); }}
            placeholder="搜索曲名 / 专辑 / 角色"
            sx={{ flex: 1, "& input": { fontFamily: NoFontFamily, fontSize: "0.82em" } }}
          />
          <Button
            size="small"
            variant="contained"
            disabled={picked.size === 0 || !selectedPlaylist || props.disabled}
            onClick={addPickedTracks}
          >
            加入所选（{picked.size}）
          </Button>
        </Stack>

        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", border: "1px solid", borderColor: "divider" }}>
          {shownTracks.map((track) => {
            const checked = picked.has(track.musicId);
            const already = selectedPlaylist?.tracks.some((item) => item.musicId === track.musicId);
            return (
              <Stack
                key={track.musicId}
                data-testid="playlist-source-track"
                direction="row"
                alignItems="center"
                spacing={0.5}
                onClick={() => {
                  if (props.disabled) { return; }
                  setPicked((current) => {
                    const next = new Set(current);
                    if (next.has(track.musicId)) { next.delete(track.musicId); }
                    else { next.add(track.musicId); }
                    return next;
                  });
                }}
                sx={{
                  padding: "4px 6px", cursor: props.disabled ? "default" : "pointer",
                  opacity: already ? 0.55 : 1,
                  "&:hover": { backgroundColor: "rgba(255,255,255,0.07)" },
                  "&:not(:last-of-type)": { borderBottom: "1px solid", borderColor: "divider" },
                }}
              >
                <Checkbox size="small" checked={checked} sx={{ padding: "1px" }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{
                    fontFamily: NoFontFamily, fontSize: "0.82em",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {track.title}
                  </Typography>
                  <Typography sx={{
                    ...smallText, fontSize: "0.68em",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {track.album} · {track.characterId}
                  </Typography>
                </Box>
                <PlaylistTrackActions
                  track={makeTrack(track)}
                  playlists={props.playlists}
                  onPlaylistsChange={props.onPlaylistsChange}
                  preferredPlaylistId={selectedPlaylistId}
                  disabled={props.disabled}
                  onStatus={setStatus}
                  onAfterAdd={setRequestedPlaylistId}
                />
                {already && <Typography sx={smallText}>已在歌单</Typography>}
              </Stack>
            );
          })}
          {shownTracks.length === 0 && (
            <Typography sx={{ ...smallText, padding: 1.5 }}>没有匹配的曲目。</Typography>
          )}
        </Box>
        {status && <Alert severity="info" onClose={() => { setStatus(""); }}>{status}</Alert>}
      </Box>
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = "";
          void importPlaylists(file);
        }}
      />
    </Drawer>
  );
}
