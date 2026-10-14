import { describe, expect, it } from "vitest";
import {
  isTextEntryTarget, playbackToggleAction, resolvePlaybackHotkey,
} from "./playbackActions";
import { PlaybackState } from "../types/Configs";

describe("playbackToggleAction", () => {
  it("pauses while playing and plays otherwise", () => {
    expect(playbackToggleAction(PlaybackState.Playing)).toBe("pause");
    expect(playbackToggleAction(PlaybackState.Stopped)).toBe("play");
    expect(playbackToggleAction(PlaybackState.TimeoutPause)).toBe("play");
  });

  it("is locked while the countdown bell owns the audio", () => {
    expect(playbackToggleAction(PlaybackState.CountingDown)).toBeNull();
  });
});

describe("resolvePlaybackHotkey", () => {
  it("maps the bracket keys and space", () => {
    expect(resolvePlaybackHotkey("[")).toBe("previous");
    expect(resolvePlaybackHotkey("]")).toBe("next");
    expect(resolvePlaybackHotkey(" ")).toBe("togglePlay");
  });

  it("maps the physical key too, for layouts where `[` types something else", () => {
    expect(resolvePlaybackHotkey("「", "BracketLeft")).toBe("previous");
    expect(resolvePlaybackHotkey("」", "BracketRight")).toBe("next");
    expect(resolvePlaybackHotkey(" ", "Space")).toBe("togglePlay");
  });

  it("ignores every other key", () => {
    expect(resolvePlaybackHotkey("a", "KeyA")).toBeNull();
    expect(resolvePlaybackHotkey("Enter", "Enter")).toBeNull();
    expect(resolvePlaybackHotkey("", "")).toBeNull();
  });

  it("leaves chords with a modifier alone", () => {
    expect(resolvePlaybackHotkey("[", "BracketLeft", { ctrlKey: true })).toBeNull();
    expect(resolvePlaybackHotkey(" ", "Space", { metaKey: true })).toBeNull();
    expect(resolvePlaybackHotkey("]", "BracketRight", { altKey: true })).toBeNull();
  });
});

describe("isTextEntryTarget", () => {
  it("protects the fields the user types into", () => {
    expect(isTextEntryTarget({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isTextEntryTarget({ tagName: "input", type: "number" })).toBe(true);
    expect(isTextEntryTarget({ tagName: "input" })).toBe(true);
    expect(isTextEntryTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTextEntryTarget({ tagName: "select" })).toBe(true);
    expect(isTextEntryTarget({ isContentEditable: true })).toBe(true);
  });

  it("lets the transport controls keep their keystrokes", () => {
    expect(isTextEntryTarget({ tagName: "input", type: "range" })).toBe(false);
    expect(isTextEntryTarget({ tagName: "DIV" })).toBe(false);
    expect(isTextEntryTarget({ isContentEditable: false })).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
    expect(isTextEntryTarget(undefined)).toBe(false);
  });
});
