export const AudioBoostModes = ["off", "normal", "extreme"] as const;

export type AudioBoostMode = typeof AudioBoostModes[number];

export const DefaultAudioBoostMode: AudioBoostMode = "extreme";

export const AudioBoostLabels: Record<AudioBoostMode, string> = {
  off: "原声",
  normal: "增强",
  extreme: "极限",
};

export const AudioBoostGain = 8;
export const AudioSafetyGain = 0.84;
export const AudioExtremeDrive = 2;
export const AudioProxyBase = "https://reliable-praline-07c51e.netlify.app/audio";
const AudioBoostStorageKey = "audioBoostMode";

export function isAudioBoostMode(value: unknown): value is AudioBoostMode {
  return typeof value === "string" && (AudioBoostModes as ReadonlyArray<string>).includes(value);
}

export function loadAudioBoostMode(): AudioBoostMode {
  if (typeof window === "undefined") { return DefaultAudioBoostMode; }
  try {
    const stored = JSON.parse(window.localStorage.getItem(AudioBoostStorageKey) ?? "null");
    return isAudioBoostMode(stored) ? stored : DefaultAudioBoostMode;
  } catch {
    return DefaultAudioBoostMode;
  }
}

export function saveAudioBoostMode(mode: AudioBoostMode): void {
  if (typeof window === "undefined") { return; }
  window.localStorage.setItem(AudioBoostStorageKey, JSON.stringify(mode));
}

/** 顶栏按钮每次点击依次切到下一档，极限档之后回到原声。 */
export function nextAudioBoostMode(mode: AudioBoostMode): AudioBoostMode {
  if (mode === "extreme") { return "normal"; }
  if (mode === "normal") { return "off"; }
  return "extreme";
}

/** Same-origin audio can use Web Audio directly; external sources need the CORS proxy. */
export function proxiedAudioUrl(sourceUrl: string, pageOrigin: string): string {
  try {
    const source = new URL(sourceUrl, pageOrigin);
    if (source.origin === pageOrigin) { return source.href; }
    return `${AudioProxyBase}?url=${encodeURIComponent(source.href)}`;
  } catch {
    return sourceUrl;
  }
}

export type AudioBoostNodes = {
  preamp: GainNode;
  limiter: DynamicsCompressorNode;
  safety: GainNode;
  drive: GainNode;
  clipper: WaveShaperNode;
};

export function createHardClipCurve(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(4097 * Float32Array.BYTES_PER_ELEMENT));
  for (let i = 0; i < curve.length; i++) {
    curve[i] = (i / (curve.length - 1)) * 2 - 1;
  }
  return curve;
}

export function createAudioBoostNodes(ctx: BaseAudioContext, mode: AudioBoostMode): AudioBoostNodes {
  const preamp = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  const safety = ctx.createGain();
  const drive = ctx.createGain();
  const clipper = ctx.createWaveShaper();
  clipper.curve = createHardClipCurve();
  clipper.oversample = "none";
  const nodes = { preamp, limiter, safety, drive, clipper };
  configureAudioBoostNodes(nodes, mode);
  return nodes;
}

export function configureAudioBoostNodes(nodes: AudioBoostNodes, mode: AudioBoostMode): void {
  const boosted = mode !== "off";
  const set = (param: AudioParam, value: number) => { param.value = value; };

  set(nodes.preamp.gain, boosted ? AudioBoostGain : 1);
  set(nodes.safety.gain, boosted ? AudioSafetyGain : 1);
  set(nodes.drive.gain, mode === "extreme" ? AudioExtremeDrive : 1);
  nodes.limiter.threshold.value = 0;
  nodes.limiter.knee.value = boosted ? 1 : 0;
  nodes.limiter.ratio.value = boosted ? 20 : 1;
  nodes.limiter.attack.value = 0.002;
  nodes.limiter.release.value = 0.12;
}
