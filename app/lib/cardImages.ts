/**
 * Where a card's image comes from: the local `public/` copies or the R2 bucket, plus the
 * per-collection sub-directory.
 */

export const CardR2Prefix = "https://r2bucket-touhou.hgjertkljw.org/";
const RouterBasePath = (process.env.__NEXT_ROUTER_BASEPATH ?? "").replace(/\/+$/, "");

export function withBasePath(basePath: string, assetPath: string): string {
  const normalizedPath = assetPath.replace(/^\.?\//, "").replace(/^\/+/, "");
  const normalizedBase = basePath.replace(/\/+$/, "");
  return `${normalizedBase}/${normalizedPath}`;
}

export function localAssetUrl(assetPath: string): string {
  return withBasePath(RouterBasePath, assetPath);
}

// next/image accepts a root-relative path; include the Pages project base path when deployed
// under a subdirectory (for example `/touhou-card-player-v3/`).
export const CardLocalPrefix = withBasePath(RouterBasePath, "");

export const CardCollectionPrefix: ReadonlyMap<string, string> = new Map([
  ["dairi-sd", "cards/"],
  ["dairi", "cards-dairi/"],
  ["enbu", "cards-enbu/"],
  ["enbu-dolls", "cards-enbu-dolls/"],
  ["thbwiki-sd", "cards-thwiki/"],
  ["zun", "cards-zun/"],
]);

export const DefaultCardCollection = "dairi-sd";

export function cardCollectionPrefix(cardCollection: string): string {
  return CardCollectionPrefix.get(cardCollection)
    ?? CardCollectionPrefix.get(DefaultCardCollection)!;
}

export function cardImageUrl(
  cardCollection: string, imageSource: string, useR2: boolean,
): string {
  const prefix = useR2 ? CardR2Prefix : CardLocalPrefix;
  return prefix + cardCollectionPrefix(cardCollection) + imageSource;
}
