import { describe, expect, it } from "vitest";
import {
  AudioBoostLabels, AudioProxyBase, createHardClipCurve, DefaultAudioBoostMode,
  isAudioBoostMode, nextAudioBoostMode, proxiedAudioUrl,
} from "./audioBoost";

describe("audio boost settings", () => {
  it("defaults to the extreme mode selected for the site", () => {
    expect(DefaultAudioBoostMode).toBe("extreme");
    expect(AudioBoostLabels[DefaultAudioBoostMode]).toBe("极限");
  });

  it("cycles from extreme to normal to original and back", () => {
    expect(nextAudioBoostMode("extreme")).toBe("normal");
    expect(nextAudioBoostMode("normal")).toBe("off");
    expect(nextAudioBoostMode("off")).toBe("extreme");
  });

  it("rejects unknown stored values", () => {
    expect(isAudioBoostMode("normal")).toBe(true);
    expect(isAudioBoostMode("extreme")).toBe(true);
    expect(isAudioBoostMode("off")).toBe(true);
    expect(isAudioBoostMode("maximum")).toBe(false);
    expect(isAudioBoostMode(null)).toBe(false);
  });

  it("routes external audio through the CORS proxy and leaves same-origin audio alone", () => {
    const origin = "https://convectiverain.github.io";
    const external = "http://music.163.com/song/media/outer/url?id=22636680.mp3";
    expect(proxiedAudioUrl(external, origin)).toBe(
      `${AudioProxyBase}?url=${encodeURIComponent(external)}`,
    );
    expect(proxiedAudioUrl(`${origin}/audio/local.mp3`, origin)).toBe(`${origin}/audio/local.mp3`);
  });

  it("builds an identity hard-clip curve bounded to full scale", () => {
    const curve = createHardClipCurve();
    expect(curve[0]).toBe(-1);
    expect(curve[curve.length - 1]).toBe(1);
    expect(curve[Math.floor(curve.length / 2)]).toBe(0);
  });
});
