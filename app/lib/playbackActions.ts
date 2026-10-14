import { PlaybackState } from "../types/Configs";

/**
 * The transport rules shared by the on-screen buttons and the keyboard shortcuts, so the two
 * cannot drift apart (a hotkey must respect the same lock the button does).
 */

export type PlaybackToggleAction = "play" | "pause";

/**
 * What a play/pause press does in the given state, or null while the transport is locked:
 * the countdown bell owns the audio until it ends.
 */
export function playbackToggleAction(state: PlaybackState): PlaybackToggleAction | null {
  if (state === PlaybackState.CountingDown) { return null; }
  return state === PlaybackState.Playing ? "pause" : "play";
}

export type PlaybackHotkeyCommand = "previous" | "next" | "togglePlay";

/** The keys the Player and List tabs bind. */
export const PreviousHotkey = "[";
export const NextHotkey = "]";
export const TogglePlayHotkey = " ";

/** Physical positions, matched too so the hotkeys survive layouts where `[` is not `[`. */
const PreviousHotkeyCode = "BracketLeft";
const NextHotkeyCode = "BracketRight";
const TogglePlayHotkeyCode = "Space";

/**
 * Maps a `keydown` to a transport command, or null when the keystroke is not ours.
 *
 * `code` is the layout-independent physical key; either identifier alone is enough to match, so
 * the hotkeys work on a US keyboard, a Japanese one (where `[` types `「`) and on shifted forms.
 */
export function resolvePlaybackHotkey(
  key: string,
  code: string = "",
  modifiers: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean } = {},
): PlaybackHotkeyCommand | null {
  // leave browser/OS chords (reload, tab switching, …) entirely alone
  if (modifiers.ctrlKey || modifiers.metaKey || modifiers.altKey) { return null; }
  if (key === PreviousHotkey || code === PreviousHotkeyCode) { return "previous"; }
  if (key === NextHotkey || code === NextHotkeyCode) { return "next"; }
  if (key === TogglePlayHotkey || code === TogglePlayHotkeyCode) { return "togglePlay"; }
  return null;
}

/** The parts of an element the text-entry check reads, so tests can pass a plain object. */
export type KeyTargetLike = {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
};

/** Input types that are not typed into, so the hotkeys may keep their keystrokes. */
const NonTextInputTypes = new Set([
  "range", "checkbox", "radio", "button", "submit", "reset", "file", "color", "image",
]);

/**
 * True when the keystroke belongs to a field the user is typing into: the playback duration box,
 * the config search box, the chat box. Those keep their own space bar and brackets.
 */
export function isTextEntryTarget(target: KeyTargetLike | null | undefined): boolean {
  if (!target) { return false; }
  const tagName = target.tagName?.toLowerCase();
  if (tagName === "textarea" || tagName === "select") { return true; }
  if (tagName === "input") {
    const type = (target.type || "text").toLowerCase();
    return !NonTextInputTypes.has(type);
  }
  return target.isContentEditable === true;
}
