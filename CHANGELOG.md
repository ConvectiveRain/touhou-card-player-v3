## 2026-04-17
* Update super deform card image of Narishiko and Nina in th20.

## 2026-10-14
* Restructured the project into smaller components and utility files.
* Added a "Hide Display" toggle, to allow 1v1 offline game without a judge.
* Added Th06 New Classic music support, with a new idpreset.
* Bugfix: remove "魔法少女達の百年祭" from "フランドール・スカーレット".

## 2026-10-15
* Added "霊長新益京　～ Artificial Utopia in Ruins." songs.
* Updated card of "ニナ" and "馴子".
* Adjust CPU match settings to be more realisitic.
* Added Japanese locale (`?locale=ja`, or auto-detected from the browser language).
* Added PvP join links: the server can copy a client/observer link (`?code=...&role=...`) that opens the game board with the role and share code prefilled.

## 2026-10-21
* Added personal playlists with bulk track selection, reordering, removal, playback and JSON import/export.
* Added a per-match playlist selector. When selected, the match uses only music and characters from that playlist.
* Playlists persist in browser localStorage and survive page reloads, browser restarts and computer restarts on the same browser profile.
* Bugfix: the time-seeded Alice tab label caused an SSR/client hydration mismatch; stable hashing now keeps the first render identical.
* Bugfix: local card and album image paths now start with `/`, fixing Next 16 `Failed to construct 'URL': Invalid URL` errors from `next/image`.
* Music data: added 822 album-matched tracks whose NetEase titles contain Chinese/Japanese spelling variants or appended original-song notes; direct audio URLs were re-probed before insertion.

## 2026-10-24
* Music data: added 23 requested circles, 849 albums and 8,416 tracks verified against NetEase album metadata and direct audio playback.
* Music data: fixed `森羅万象 - ノンフィク陰謀論` from one track to its complete seven-track album.
* Bugfix: "Random Start" reused the same game-sync seed for every track, so tracks always started at the same relative position. Seeds are now consumed once and regenerated.
* Bugfix: rapid track changes no longer surface an unhandled `AbortError` when the previous `play()` request is interrupted.

## TODO
