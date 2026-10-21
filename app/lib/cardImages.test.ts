import { describe, expect, it } from "vitest";
import { CardBackgroundState } from "./cardState";
import {
  cardCollectionPrefix, cardImageUrl, withBasePath,
} from "./cardImages";

describe("card image urls", () => {
  it("maps a collection to its prefix and falls back to the default", () => {
    expect(cardCollectionPrefix("enbu")).toBe("cards-enbu/");
    expect(cardCollectionPrefix("nope")).toBe("cards/");
  });

  it("builds local and R2 urls", () => {
    expect(cardImageUrl("dairi-sd", "alice.png", false)).toBe("/cards/alice.png");
    expect(cardImageUrl("thbwiki-sd", "alice.png", true)).toBe(
      "https://r2bucket-touhou.hgjertkljw.org/cards-thwiki/alice.png",
    );
  });

  it("keeps local assets under the deployment base path", () => {
    expect(withBasePath("/touhou-card-player-v3/", "/cards/alice.png")).toBe(
      "/touhou-card-player-v3/cards/alice.png",
    );
    expect(withBasePath("", "./covers_local/a.jpg")).toBe("/covers_local/a.jpg");
  });

  it("exposes a placeholder background state for outline cards", () => {
    expect(CardBackgroundState.Placeholder).not.toBe(CardBackgroundState.Normal);
  });
});
