import { describe, expect, it } from "vitest";
import { Event } from "./GameEvents";
import { CardInfo } from "./GameTypes";
import { decodeEvent, encodeEvent, isKnownEventType } from "./syncCodec";

describe("encodeEvent / decodeEvent", () => {
  it("round-trips an event", () => {
    const event: Event = { type: "give" };
    expect(decodeEvent(encodeEvent(event))).toEqual(event);
  });

  it("round-trips an event carrying card instances", () => {
    const event: Event = {
      type: "addCard",
      cardInfo: new CardInfo("alice", 2),
      deckPosition: { deckIndex: 1, cardIndex: 4 },
    };

    const decoded = decodeEvent(encodeEvent(event));

    expect(decoded).toEqual({
      type: "addCard",
      cardInfo: { characterId: "alice", cardIndex: 2 },
      deckPosition: { deckIndex: 1, cardIndex: 4 },
    });
  });

  it("accepts an already-parsed object", () => {
    expect(decodeEvent({ type: "stopGame" })).toEqual({ type: "stopGame" });
  });

  it("rejects malformed payloads instead of throwing", () => {
    expect(decodeEvent("not json at all")).toBeNull();
    expect(decodeEvent("{ truncated")).toBeNull();
    expect(decodeEvent(null)).toBeNull();
    expect(decodeEvent(undefined)).toBeNull();
    expect(decodeEvent(42)).toBeNull();
    expect(decodeEvent("[]")).toBeNull();
    expect(decodeEvent(JSON.stringify({ noType: true }))).toBeNull();
    expect(decodeEvent(JSON.stringify({ type: 5 }))).toBeNull();
  });

  it("forwards unknown but well-formed event types", () => {
    const decoded = decodeEvent(JSON.stringify({ type: "somethingNew" }));
    expect(decoded).not.toBeNull();
    expect(isKnownEventType("somethingNew")).toBe(false);
  });

  it("recognises every shipped event type", () => {
    for (const type of ["addCard", "pickEvent", "syncStart", "broadcastPlayerNames", "chat"]) {
      expect(isKnownEventType(type)).toBe(true);
    }
  });
});
