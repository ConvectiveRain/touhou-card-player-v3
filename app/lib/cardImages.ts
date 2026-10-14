/**
 * Where a card's image comes from: the local `public/` copies or the R2 bucket, plus the
 * per-collection sub-directory.
 */

export const CardR2Prefix = "https://r2bucket-touhou.hgjertkljw.org/";
export const CardLocalPrefix = "./";

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
