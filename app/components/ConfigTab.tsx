import { Box, Button, Collapse, Divider, FormControl, Grid, IconButton, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { AddRounded, RemoveRounded, Shuffle } from "@mui/icons-material";
import { CharacterId, GlobalData, MusicSelectionMap } from "../types/Configs";
import { useEffect, useMemo, useState } from "react";
import { CardCollections, DefaultMusicSource, MusicSources } from "../types/Consts";
import { CharacterCard } from "./CharacterCard";
import { PagePRNG } from "../types/PagePrng";
import { 
  CheckBoxOutlineBlank as NoneIcon, 
  IndeterminateCheckBox as PartialIcon, 
  CheckBox as FullIcon,
  Search
} from "@mui/icons-material";
import { NoFontFamily } from "./Theme";
import { GetLocalizedString, Localization } from "../types/Localization";
import Link from "next/link";
import { cheatSanitize, isCheat } from "../types/Cheat";
import { loadMusicSourceKey, saveMusicSourceKey } from "../lib/persistence";
import { parseMusicInfo } from "../lib/music";

interface ConfigDrawerProps {
  title: string;
  children?: React.ReactNode;
}

function ConfigDrawer({...props}: ConfigDrawerProps) {
  const [open, setOpen] = useState(false);
  return (
    <Paper
      variant="outlined"
      sx={{
        width: "100%",
        padding: 0,
        paddingLeft: 2,
        paddingRight: 1,
      }}
    >
      <Stack
        direction="column"
        spacing={0}
        sx={{
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
          onClick={() => setOpen(!open)}
        >
          <Typography variant="body1" fontFamily={NoFontFamily}>
            {props.title}
          </Typography>
          <Button
            onClick={() => setOpen(!open)}
            size="small"
          >
            {open ? <RemoveRounded /> : <AddRounded />}
          </Button>
        </Box>
        <Collapse
          in={open}
        >
          <Stack direction="column" spacing={1} width="100%" paddingBottom={1}>
            <Divider />
            <Box width="100%" paddingLeft={2}>
              {props.children}
            </Box>
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
}

export interface ConfigTabProps {
  
  data: GlobalData,
  musicSelection: MusicSelectionMap,
  playingOrder: Array<CharacterId>,
  currentCharacterId: CharacterId,
  
  setCardCollection: (cardCollection: string) => void,
  setMusicSource: (url: string) => void,
  /** Called when the local preview starts, so it does not talk over the main player. */
  onPreviewStart: () => void,
  setMusicSelection: (selection: MusicSelectionMap) => void,
  setPlayingOrder: (order: Array<CharacterId>) => void,
  setCurrentCharacterId: (charId: CharacterId) => void,

}

export default function ConfigTab(props: ConfigTabProps) {
  const [musicSourceKey, setMusicSourceKey] = useState(DefaultMusicSource.key);
  const [focusedPreset, setFocusedPreset] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>("");
  const [randomSeed, setRandomSeed] = useState<number>(1);

  // Every preset the drawer can apply: the all-enabled default, the saved ones, and one
  // "disable everything tagged X" entry per tag.
  const presets: Map<string, MusicSelectionMap> = useMemo(() => {
    const result: Map<string, MusicSelectionMap> = new Map();

    const defaultSelection: MusicSelectionMap = new Map();
    props.data.characterConfigs.forEach((_config, characterId) => {
      defaultSelection.set(characterId, 0);
    });
    result.set(GetLocalizedString(Localization.ConfigTabPresetDefault), defaultSelection);

    props.data.presets.forEach((selectionMap, name) => {
      result.set(name, selectionMap);
    });

    const tags = new Set<string>();
    props.data.characterConfigs.forEach((config) => {
      config.tags.forEach((tag) => tags.add(tag));
    });
    tags.forEach((tag) => {
      const selectionMap: MusicSelectionMap = new Map();
      props.data.characterConfigs.forEach((config, characterId) => {
        if (config.tags.includes(tag)) {
          selectionMap.set(characterId, -1);
        }
      });
      result.set(GetLocalizedString(Localization.ConfigTabPresetDisable) + tag, selectionMap);
    });

    return result;
  }, [props.data]);

  // The preview cards and example track are expensive to pick and used to change on every
  // unrelated re-render. They now only change when the dataset or the shuffle seed does.
  const examples = useMemo(() => {
    const prng = new PagePRNG();
    for (let i = 0; i < randomSeed % 1000; i++) { prng.next(); }

    const cardPool: Array<string> = [];
    props.data.characterConfigs.forEach((config) => {
      config.card.forEach((card) => cardPool.push(card));
    });
    const characterIds = Array.from(props.data.characterConfigs.keys());

    const cardExamples = cardPool.length > 0
      ? Array.from({ length: 3 }, () => cardPool[prng.next() % cardPool.length])
      : [];

    if (characterIds.length === 0) {
      return { cardExamples, characterId: "", musicSource: "", musicInfo: null, musicSrc: "" };
    }
    const characterId = characterIds[prng.next() % characterIds.length];
    const config = props.data.characterConfigs.get(characterId)!;
    const musicSource = config.musics[prng.next() % config.musics.length];
    return {
      cardExamples,
      characterId,
      musicSource,
      musicInfo: parseMusicInfo(musicSource),
      musicSrc: props.data.sources.get(musicSource) || "",
    };
  }, [props.data, randomSeed]);


  const applyMusicSelectionPreset = (selectionMap: MusicSelectionMap) => {
    const newMusicSelection: MusicSelectionMap = new Map(props.musicSelection);
    selectionMap.forEach((musicId, charId) => {
      newMusicSelection.set(charId, musicId);
    });

    // update playingorder if something is set to -1
    let changed = false;
    const newPlayingOrder = props.playingOrder.filter((charId) => {
      if (newMusicSelection.has(charId) && newMusicSelection.get(charId) === -1) {
        changed = true;
        return false;
      }
      return true;
    });
    // if something is not -1 but not in playing order, add to the end
    selectionMap.forEach((musicId, charId) => {
      if (musicId !== -1 && !newPlayingOrder.includes(charId)) {
        newPlayingOrder.push(charId);
        changed = true;
      }
    });
    props.setMusicSelection(newMusicSelection);
    if (changed) {
      props.setPlayingOrder(newPlayingOrder);
    }
    // if currentPlayingCharacter is disabled, set to ""
    if (newMusicSelection.has(props.currentCharacterId) && newMusicSelection.get(props.currentCharacterId) === -1) {
      props.setCurrentCharacterId("");
    }
  }

  const filteredCharacters = useMemo(() => {
    const entries = Array.from(props.data.characterConfigs);
    if (searchText === "") { return entries; }
    const needle = searchText.toLowerCase();
    return entries.filter(([charId, config]) => {
      const searchNames = config.searchNames ?? [charId];
      return searchNames.some((name) => name.toLowerCase().includes(needle));
    });
  }, [props.data, searchText]);

  useEffect(() => {
    // restore the last music source the user picked
    const storedMusicSourceKey = loadMusicSourceKey();
    if (storedMusicSourceKey) {
      const source = MusicSources.find((candidate) => candidate.key === storedMusicSourceKey);
      if (source) {
        setMusicSourceKey(storedMusicSourceKey);
      }
    }
  }, []);

  return (
    <Box
      sx={{width: "100%", display: "flex", justifyContent: "center"}}
    >
      <Stack 
        direction="column" spacing={1}
        sx={{
          width: "100%",
          maxWidth: "800px",
          alignItems: "center",
          justifyContent: "center",
          alignContent: "center",
        }}
      >
        <ConfigDrawer title={GetLocalizedString(Localization.ConfigTabCardCollection)}>
          <Stack direction="column" spacing={1}
            sx={{width: "100%"}}
          >
            {CardCollections.map((collection, index) => {
              const [key, element] = collection;
              return (
                <Stack direction="column" width="100%" key={key} spacing={1}>
                  {index !== 0 && <Divider />}
                  <Grid container spacing={1} width="100%">
                    <Grid size={8} sx={{display: "flex", alignItems: "center"}}>
                      <Typography variant="body2">
                        {cheatSanitize(key)}
                      </Typography>
                    </Grid>
                    <Grid size={4} sx={{display: "flex", justifyContent: "flex-end", alignItems: "center"}}>
                      <Button
                        variant={props.data.cardCollection === key ? "contained" : "outlined"}
                        onClick={() => { props.setCardCollection(key); }}
                        sx={{
                          height: "2em"
                        }}
                        disabled={props.data.cardCollection === key}
                      >
                        {props.data.cardCollection === key 
                          ? GetLocalizedString(Localization.ConfigTabSelected) 
                          : GetLocalizedString(Localization.ConfigTabSelect)
                        }
                      </Button>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="body2" color="textSecondary">
                        {!isCheat() ? element : cheatSanitize("Whatever")}
                      </Typography>
                    </Grid>
                    <Grid size={6}>
                      <Stack direction="row" spacing={1} justifyContent="space-between" padding={1}>
                        {examples.cardExamples.map((source, idx) => (
                          <CharacterCard
                            key={idx}
                            cardCollection={key}
                            width="30%"
                            imageSource={source}
                          />
                        ))}
                      </Stack>
                    </Grid>
                  </Grid>
                </Stack>
              );
            })}
          </Stack>
        </ConfigDrawer>

        <ConfigDrawer title={GetLocalizedString(Localization.ConfigTabMusicSource)}>
          <Stack direction="column" spacing={1}
            sx={{width: "100%"}}
          >
            {MusicSources.map((source, index) => {
              const {key, url, description} = source;
              // grid: (1-row) title, button (2-row): description
              return (
                <Stack direction="column" width="100%" key={key} spacing={1} paddingBottom={1}>
                  {index !== 0 && <Divider />}
                  <Grid container spacing={1} width="100%">
                    <Grid size={8} sx={{display: "flex", alignItems: "center"}}>
                      <Typography variant="body1">
                        {cheatSanitize(key)}
                      </Typography>
                    </Grid>
                    <Grid size={4} sx={{display: "flex", justifyContent: "flex-end", alignItems: "center"}}>
                      <Button
                        variant={musicSourceKey === key ? "contained" : "outlined"}
                        onClick={() => {
                          setMusicSourceKey(key);
                          saveMusicSourceKey(key);
                          props.setMusicSource(url);
                        }}
                        sx={{
                          height: "2em",
                          fontFamily: NoFontFamily,
                        }}
                        disabled={musicSourceKey === key}
                      >
                        {musicSourceKey === key 
                          ? GetLocalizedString(Localization.ConfigTabSelected) 
                          : GetLocalizedString(Localization.ConfigTabSelect)
                        }
                      </Button>
                    </Grid>
                    <Grid size={12}>
                      <Typography variant="body2" color="textSecondary">
                        {cheatSanitize(description)}
                      </Typography>
                    </Grid>
                    {musicSourceKey === key &&
                      <Grid size={12}>
                        <Stack direction="row" spacing={1} sx={{ 
                          height: "2.5em",
                          alignItems: "center",
                          display: "flex",
                        }}>
                          <IconButton
                            onClick={() => {
                              // a fresh, well spread seed so the preview really changes
                              setRandomSeed(Math.floor(Math.random() * 1000000) + 1);
                            }}
                            sx={{
                              width: "40px", height: "40px",
                              flexShrink: 0,
                            }}
                          >
                            <Shuffle fontSize="small" />
                          </IconButton>
                          <Stack direction="column">
                            <Typography variant="body1" color="primary" sx={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}>
                              {cheatSanitize(GetLocalizedString(Localization.ConfigTabMusicSourceExample))}
                            </Typography>
                            <Link href={examples.musicSrc} target="_blank" rel="noopener noreferrer">
                              <Typography variant="body2" color="textSecondary" fontSize="small" sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                "&:hover": { textDecoration: "underline" }
                              }}>
                                {cheatSanitize(examples.characterId)} / {cheatSanitize(examples.musicInfo?.title)} ({cheatSanitize(examples.musicInfo?.album)})
                              </Typography>
                            </Link>
                          </Stack>
                        </Stack>
                      </Grid>
                    }
                    {
                      musicSourceKey === key &&
                      <Grid size={12}>
                        <Box width="100%">
                          <audio 
                            controls 
                            style={{
                              width: "100%",
                            }}
                            src={examples.musicSrc === "" ? undefined : examples.musicSrc}
                            autoPlay={false}
                            onPlay={() => { props.onPreviewStart(); }}
                          >
                            Your browser does not support the audio element.
                          </audio>
                        </Box>
                      </Grid>
                    }
                  </Grid>
                </Stack>
              );
            })}
          </Stack>
        </ConfigDrawer>

        <ConfigDrawer title={GetLocalizedString(Localization.ConfigTabMusicSelectionPresets)}>
          <Stack direction="column" spacing={1}
            sx={{width: "100%"}}
          >
            {Array.from(presets).map(([name, selectionMap], _index) => {
              let fullyApplied = true;
              let partiallyApplied = false;
              for (const [charId, musicId] of Array.from(selectionMap)) {
                if (props.musicSelection.get(charId) !== musicId) {
                  fullyApplied = false;
                } else {
                  partiallyApplied = true;
                }
              }
              const icon = fullyApplied ? <FullIcon fontSize="small"/> : (partiallyApplied ? <PartialIcon fontSize="small"/> : <NoneIcon fontSize="small"/>);
              const setFocused = () => {
                if (focusedPreset === name) {
                  setFocusedPreset(null);
                } else {
                  setFocusedPreset(name);
                }
              }
              return (
                <Stack direction="column" width="100%" key={name} spacing={0} onClick={setFocused}>
                  <Grid container width="100%" >
                    <Grid size={8} sx={{display: "flex", alignItems: "center"}}>
                      <Typography variant="body2" sx={{display: "flex", alignItems: "center", gap: 0.5}} fontFamily={NoFontFamily}>
                        {icon}
                        {cheatSanitize(name)}
                      </Typography>
                    </Grid>
                    <Grid size={4} sx={{display: "flex", justifyContent: "flex-end", alignItems: "center"}}>
                      <Button
                        size="small"
                        disabled={fullyApplied}
                        variant={"outlined"}
                        onClick={() => {
                          applyMusicSelectionPreset(selectionMap);
                        }}
                        sx={{
                          height: "2em"
                        }}
                      >
                        {fullyApplied 
                          ? GetLocalizedString(Localization.ConfigTabApplied) 
                          : GetLocalizedString(Localization.ConfigTabApply)}
                      </Button>
                    </Grid>
                  </Grid>
                  <Collapse in={focusedPreset === name}>
                    <Stack direction="column" spacing={0} paddingLeft={3}>
                      {Array.from(selectionMap).map(([charId, musicId]) => {
                        const applied = props.musicSelection.get(charId) === musicId;
                        const icon = applied ? <FullIcon fontSize="small"/> : <NoneIcon fontSize="small"/>;
                        let musicName = GetLocalizedString(Localization.ConfigTabPresetDisable);
                        if (musicId != -1) {
                          const nameId = props.data.characterConfigs.get(charId)?.musics[musicId];
                          if (nameId) {
                            const musicInfo = parseMusicInfo(nameId);
                            if (musicInfo) {
                              musicName = musicInfo.title;
                            }
                          }
                        }
                        return (
                          <Stack direction="row" spacing={1} key={name + charId} alignItems="center">
                            <Typography variant="body2" color="textSecondary" fontSize="small">
                              {icon}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              {cheatSanitize(charId)} {"⇒"} {cheatSanitize(musicName)}
                            </Typography>
                          </Stack>
                        );
                      })}
                    </Stack>
                  </Collapse>
                </Stack>
              );
            })}
          </Stack>
        </ConfigDrawer>
        <ConfigDrawer title={GetLocalizedString(Localization.ConfigTabMusicSelectionSingle)}>
          <Stack direction="column" spacing={1}
            sx={{width: "100%"}}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Search fontSize="small" />
              <TextField fullWidth variant="filled" size="small" 
                label={GetLocalizedString(Localization.ConfigTabSearchCharacter)}
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                }}
                slotProps={{ 
                  input: { 
                    style: { 
                      fontFamily: NoFontFamily 
                    }
                  },
                  inputLabel: { style: { fontFamily: NoFontFamily } 
                }}}
              />
            </Stack>
            <Divider />
            {filteredCharacters.map(([charId, config]) => {
              const selectedMusicId = props.musicSelection.get(charId) ?? 0;
              return (
                <Stack direction="row" spacing={1} key={charId} alignItems="center" justifyContent="space-between">
                  <Typography variant="body2" width="30%" noWrap textAlign="right">
                    {charId}
                  </Typography>
                  <FormControl size="small" sx={{width: "70%"}}>
                    <Select
                      size="small"
                      value={selectedMusicId}
                      onChange={(e) => {
                        const newMusicId = e.target.value as number;
                        const change = new Map<CharacterId, number>();
                        change.set(charId, newMusicId);
                        applyMusicSelectionPreset(change);
                      }}
                    >
                      <MenuItem value={-1}>
                        <Typography variant="body2">{GetLocalizedString(Localization.ConfigTabPresetDisable)}</Typography>
                      </MenuItem>
                      {config.musics.map((musicNameId, index) => {
                        const musicInfo = parseMusicInfo(musicNameId);
                        let displayTitle = musicNameId;
                        if (musicInfo) {
                          displayTitle = musicInfo.title;
                        }
                        return (
                          <MenuItem value={index} key={musicNameId}>
                            <Typography variant="body2">{displayTitle} ({musicInfo.album})</Typography>
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                </Stack>
              );
            })}
            {searchText !== "" && filteredCharacters.length === 0 && (
              <Typography variant="body2" color="textSecondary">
                No character matched the search.
              </Typography>
            )}
          </Stack>
        </ConfigDrawer>
      </Stack>
    </Box>
  );
}
