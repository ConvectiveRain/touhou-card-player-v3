"use client";

import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton,
  Radio, RadioGroup, Stack, TextField, Typography,
} from "@mui/material";
import {
  addTrackToDefaultPlaylist, addTrackToPlaylist, createPlaylist, DefaultPlaylistName,
  MusicPlaylist, PlaylistTrack,
} from "../lib/playlists";
import { NoFontFamily } from "./Theme";

export interface PlaylistTrackActionsProps {
  track: PlaylistTrack;
  playlists: Array<MusicPlaylist>;
  onPlaylistsChange: (playlists: Array<MusicPlaylist>) => void;
  preferredPlaylistId?: string;
  disabled?: boolean;
  onStatus?: (message: string) => void;
  onAfterAdd?: (playlistId: string) => void;
}

export default function PlaylistTrackActions(props: PlaylistTrackActionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPlaylistId, setPickerPlaylistId] = useState("");
  const [pickerNewName, setPickerNewName] = useState("");

  const addToDefault = (event: React.MouseEvent) => {
    event.stopPropagation();
    const result = addTrackToDefaultPlaylist(props.playlists, props.track);
    props.onPlaylistsChange(result.playlists);
    props.onAfterAdd?.(result.playlistId);
    props.onStatus?.(result.added > 0
      ? `已把《${props.track.title}》加入《${DefaultPlaylistName}》。`
      : `《${props.track.title}》已经在《${DefaultPlaylistName}》中。`);
  };

  const openPicker = (event: React.MouseEvent) => {
    event.stopPropagation();
    const preferred = props.preferredPlaylistId
      && props.playlists.some((playlist) => playlist.id === props.preferredPlaylistId)
      ? props.preferredPlaylistId
      : (props.playlists[0]?.id ?? "");
    setPickerPlaylistId(preferred);
    setPickerNewName("");
    setPickerOpen(true);
  };

  const closePicker = () => {
    setPickerOpen(false);
    setPickerNewName("");
  };

  const addToSelectedPlaylist = () => {
    const newName = pickerNewName.trim();
    let nextPlaylists = props.playlists;
    let targetId = pickerPlaylistId;
    if (newName) {
      const playlist = createPlaylist(newName);
      nextPlaylists = [...nextPlaylists, playlist];
      targetId = playlist.id;
    }
    if (!targetId) { return; }

    const result = addTrackToPlaylist(nextPlaylists, targetId, props.track);
    if (result.playlists === nextPlaylists && result.added === 0
      && !nextPlaylists.some((playlist) => playlist.id === targetId)) {
      props.onStatus?.("目标歌单已经不存在，请重新选择。");
      return;
    }
    const target = nextPlaylists.find((playlist) => playlist.id === targetId);
    props.onPlaylistsChange(result.playlists);
    props.onAfterAdd?.(targetId);
    props.onStatus?.(result.added > 0
      ? `已把《${props.track.title}》加入《${target?.name ?? "歌单"}》。`
      : `《${props.track.title}》已经在《${target?.name ?? "歌单"}》中。`);
    setPickerOpen(false);
    setPickerNewName("");
  };

  return (
    <>
      <Stack
        data-testid="track-playlist-actions"
        direction="row"
        spacing={0.25}
        alignItems="center"
      >
        <IconButton
          size="small"
          title={`加入默认歌单《${DefaultPlaylistName}》`}
          aria-label="加入默认歌单"
          disabled={props.disabled}
          onClick={addToDefault}
        >
          <AddIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          title="选择要加入的歌单"
          aria-label="选择歌单"
          disabled={props.disabled}
          onClick={openPicker}
        >
          <CreateNewFolderIcon fontSize="small" />
        </IconButton>
      </Stack>
      {pickerOpen && (
        <Dialog open onClose={closePicker} fullWidth maxWidth="xs">
          <DialogTitle
            data-testid="playlist-picker-title"
            sx={{ fontFamily: NoFontFamily, fontSize: "1.05em" }}
          >
            把《{props.track.title}》加入歌单
          </DialogTitle>
          <DialogContent data-testid="playlist-picker-content">
            <Typography sx={{
              fontFamily: NoFontFamily, fontSize: "0.8em", color: "text.secondary",
              marginBottom: 1,
            }}>
              选择一份歌单，或直接输入新歌单名称。
            </Typography>
            <RadioGroup
              value={pickerPlaylistId}
              onChange={(event) => {
                setPickerPlaylistId(event.target.value);
                setPickerNewName("");
              }}
            >
              {props.playlists.map((playlist) => (
                <FormControlLabel
                  key={playlist.id}
                  value={playlist.id}
                  control={<Radio size="small" />}
                  label={`${playlist.name}（${playlist.tracks.length} 首）`}
                  sx={{
                    "& .MuiFormControlLabel-label": {
                      fontFamily: NoFontFamily,
                      fontSize: "0.86em",
                    },
                  }}
                />
              ))}
            </RadioGroup>
            <TextField
              size="small"
              fullWidth
              value={pickerNewName}
              onChange={(event) => {
                setPickerNewName(event.target.value);
                if (event.target.value.trim()) { setPickerPlaylistId(""); }
              }}
              placeholder="或者新建歌单"
              inputProps={{ maxLength: 120 }}
              sx={{
                marginTop: 1,
                "& input": { fontFamily: NoFontFamily, fontSize: "0.82em" },
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closePicker}>取消</Button>
            <Button
              data-testid="playlist-picker-add"
              variant="contained"
              disabled={!pickerPlaylistId && !pickerNewName.trim()}
              onClick={addToSelectedPlaylist}
            >
              加入
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
