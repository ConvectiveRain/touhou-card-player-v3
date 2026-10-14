import { Event, EventType } from "./GameEvents";

/**
 * Single place where the wire format is defined. Everything that crosses the PeerJS data
 * channel is a JSON-encoded {@link Event}, so encoding and decoding live together here
 * instead of being spread across the transport and the rules engine.
 */

export const KNOWN_EVENT_TYPES: ReadonlySet<EventType> = new Set<EventType>([
  "addCard",
  "adjustDeckSize",
  "broadcastPlayerNames",
  "chat",
  "clearDeck",
  "confirmNext",
  "confirmStart",
  "filterMusicByDeck",
  "give",
  "notifyName",
  "pauseMusic",
  "pickEvent",
  "removeCard",
  "requestSyncData",
  "resumeMusic",
  "stopGame",
  "switchTraditionalMode",
  "syncData",
  "syncNextTurn",
  "syncStart",
  "syncWinnerDetermined",
  "syncSettings",
]);

export function encodeEvent(event: Event): string {
  return JSON.stringify(event);
}

/**
 * Parses an incoming payload. Returns null for anything that is not a JSON object
 * carrying a string discriminant, so a malformed or truncated frame cannot crash the
 * game loop. Unknown-but-well-formed event types are passed through untouched.
 */
export function decodeEvent(data: unknown): Event | null {
  let parsed: unknown = data;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const type = (parsed as { type?: unknown }).type;
  if (typeof type !== "string") {
    return null;
  }
  return parsed as Event;
}

export function isKnownEventType(type: string): type is EventType {
  return KNOWN_EVENT_TYPES.has(type as EventType);
}
