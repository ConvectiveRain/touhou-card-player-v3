import fs from "node:fs";

const base = process.env.TEST_BASE;
const debugBase = process.env.TEST_DEBUG;
const managerScreenshot = process.env.TEST_SCREENSHOT_MANAGER;
const gameScreenshot = process.env.TEST_SCREENSHOT_GAME;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pollJson(url, timeout = 30000) {
  const end = Date.now() + timeout;
  let lastError;
  while (Date.now() < end) {
    try {
      const response = await fetch(url);
      if (response.ok) { return await response.json(); }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(200);
  }
  throw lastError || new Error(`timeout: ${url}`);
}

const pages = await pollJson(`${debugBase}/json/list`);
const page = pages.find((item) => item.type === "page");
if (!page) { throw new Error("no Edge page target"); }

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const exceptions = [];
const consoleErrors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const waiter = pending.get(message.id);
    if (!waiter) { return; }
    pending.delete(message.id);
    if (message.error) { waiter.reject(new Error(JSON.stringify(message.error))); }
    else { waiter.resolve(message.result); }
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    const details = message.params.exceptionDetails;
    exceptions.push(details.exception?.description || details.text || "runtime exception");
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    consoleErrors.push(message.params.args.map((arg) => (
      arg.description || arg.value || arg.unserializableValue || arg.type
    )).join(" "));
  }
});

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function waitFor(expression, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await evaluate(expression)) { return; }
    await sleep(120);
  }
  throw new Error(`timeout waiting for: ${expression}`);
}

async function screenshot(path) {
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path, Buffer.from(shot.data, "base64"));
}

async function openPlaylistManager() {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    const ready = await evaluate(`[...document.querySelectorAll("input")].some(
      (item) => item.placeholder === "新歌单名称",
    )`);
    if (ready) { return; }
    await evaluate(`(() => {
      const button = [...document.querySelectorAll("button")].find(
        (item) => item.textContent?.trim() === "我的歌单",
      );
      button?.click();
    })()`);
    await sleep(250);
  }
  throw new Error("playlist manager did not open");
}

await send("Runtime.enable");
await send("Page.enable");
await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", {
  width: 1600,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.navigate", { url: `${base}/?locale=zh&playlist-e2e=${Date.now()}` });
await waitFor(`document.readyState === "complete" && document.body.innerText.includes("我的歌单")`);
await evaluate(`localStorage.clear()`);
await send("Page.reload", { ignoreCache: true });
await waitFor(`document.readyState === "complete" && document.body.innerText.includes("我的歌单")`);

const playlistName = `网站歌单 ${Date.now()}`;
await openPlaylistManager();
await evaluate(`(() => {
  const input = [...document.querySelectorAll("input")].find((item) => item.placeholder === "新歌单名称");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(input, ${JSON.stringify(playlistName)});
  input.dispatchEvent(new Event("input", { bubbles: true }));
})()`);
await waitFor(`[...document.querySelectorAll("input")].some((item) => item.value === ${JSON.stringify(playlistName)})`);
await evaluate(`(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === "新建");
  button.click();
})()`);
await waitFor(`document.body.innerText.includes(${JSON.stringify(playlistName)})`);

await evaluate(`(() => {
  const boxes = [...document.querySelectorAll('.MuiDrawer-paper input[type="checkbox"]')];
  boxes[0].click();
  boxes[1].click();
})()`);
await waitFor(`[...document.querySelectorAll("button")].some((item) => item.textContent?.includes("加入所选（2）"))`);
await evaluate(`(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("加入所选（2）"));
  button.click();
})()`);
await waitFor(`document.body.innerText.includes("已加入 2 首")`);

const storedAfterAdd = await evaluate(`JSON.parse(localStorage.getItem("card-player-playlists-v1"))`);
if (storedAfterAdd.playlists.length !== 1 || storedAfterAdd.playlists[0].tracks.length !== 2) {
  throw new Error(`playlist was not saved: ${JSON.stringify(storedAfterAdd)}`);
}

const quickTitles = await evaluate(`(() => {
  const rows = [...document.querySelectorAll('[data-testid="playlist-source-track"]')];
  if (rows.length < 4) { throw new Error("not enough source rows for quick-add E2E"); }
  const defaultRow = rows[2];
  const pickerRow = rows[3];
  const defaultTitle = defaultRow.querySelector("p")?.textContent ?? "";
  const pickerTitle = pickerRow.querySelector("p")?.textContent ?? "";
  defaultRow.querySelector('button[aria-label="加入默认歌单"]').click();
  return { defaultTitle, pickerTitle };
})()`);
await waitFor(`(() => {
  const store = JSON.parse(localStorage.getItem("card-player-playlists-v1"));
  const playlist = store.playlists.find((item) => item.name === "默认歌单");
  return !!playlist && playlist.tracks.length === 1;
})()`);

const defaultQuickState = await evaluate(`(() => {
  const store = JSON.parse(localStorage.getItem("card-player-playlists-v1"));
  return {
    playlists: store.playlists.length,
    defaultTracks: store.playlists.find((item) => item.name === "默认歌单")?.tracks.length,
    selectionButton: [...document.querySelectorAll("button")].find(
      (item) => item.textContent?.includes("加入所选"),
    )?.textContent,
  };
})()`);
if (defaultQuickState.playlists !== 2 || defaultQuickState.defaultTracks !== 1) {
  throw new Error(`default quick add did not create the playlist: ${JSON.stringify(defaultQuickState)}`);
}
if (!defaultQuickState.selectionButton?.includes("（0）")) {
  throw new Error(`default quick add leaked into checkbox selection: ${JSON.stringify(defaultQuickState)}`);
}

await evaluate(`(() => {
  const rows = [...document.querySelectorAll('[data-testid="playlist-source-track"]')];
  rows[3].querySelector('button[aria-label="选择歌单"]').click();
})()`);
await waitFor(`(() => {
  const title = document.querySelector('[data-testid="playlist-picker-title"]');
  return !!title && title.innerText.includes(${JSON.stringify(quickTitles.pickerTitle)})
    && !!document.querySelector('[data-testid="playlist-picker-content"]');
})()`);
await evaluate(`(() => {
  const dialog = document.querySelector('[data-testid="playlist-picker-content"]');
  const option = [...dialog.querySelectorAll('input[type="radio"]')].find(
    (item) => item.closest("label")?.textContent?.includes(${JSON.stringify(playlistName)}),
  );
  if (!option) {
    throw new Error("target playlist option missing: " + dialog.innerText);
  }
  option.click();
  const button = document.querySelector('[data-testid="playlist-picker-add"]');
  if (!button) { throw new Error("playlist picker add button missing"); }
  button.click();
})()`);
await waitFor(`(() => {
  const store = JSON.parse(localStorage.getItem("card-player-playlists-v1"));
  const playlist = store.playlists.find((item) => item.name === ${JSON.stringify(playlistName)});
  return !!playlist && playlist.tracks.length === 3
    && !document.querySelector('[data-testid="playlist-picker-content"]');
})()`);

const quickActionState = await evaluate(`(() => {
  const playlistRows = [...document.querySelectorAll('[data-testid="playlist-track"]')];
  const sourceRows = [...document.querySelectorAll('[data-testid="playlist-source-track"]')];
  return {
    playlistRows: playlistRows.length,
    playlistRowsWithTwoButtons: playlistRows.filter(
      (row) => row.querySelectorAll('button[aria-label="加入默认歌单"], button[aria-label="选择歌单"]').length === 2,
    ).length,
    sourceRows: sourceRows.length,
    sourceRowsWithTwoButtons: sourceRows.filter(
      (row) => row.querySelectorAll('button[aria-label="加入默认歌单"], button[aria-label="选择歌单"]').length === 2,
    ).length,
  };
})()`);
if (quickActionState.playlistRows !== 3
  || quickActionState.playlistRowsWithTwoButtons !== quickActionState.playlistRows
  || quickActionState.sourceRows === 0
  || quickActionState.sourceRowsWithTwoButtons !== quickActionState.sourceRows) {
  throw new Error(`quick playlist buttons are missing from track rows: ${JSON.stringify(quickActionState)}`);
}
await screenshot(managerScreenshot);

await send("Page.reload", { ignoreCache: true });
await waitFor(`document.readyState === "complete" && document.body.innerText.includes("我的歌单")`);
const storedAfterReload = await evaluate(`JSON.parse(localStorage.getItem("card-player-playlists-v1"))`);
if (storedAfterReload.playlists[0].name !== playlistName) {
  throw new Error("playlist did not survive reload");
}

await evaluate(`(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === "游戏");
  button.click();
})()`);
await waitFor(`document.body.innerText.includes("本局歌单")`);
await evaluate(`(() => {
  const select = document.querySelector('[data-testid="game-playlist-control"] .MuiSelect-select');
  select.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
})()`);
await waitFor(`[...document.querySelectorAll('[role="option"]')].some(
  (item) => item.textContent?.includes(${JSON.stringify(playlistName)}),
)`);
await evaluate(`(() => {
  const option = [...document.querySelectorAll('[role="option"]')].find(
    (item) => item.textContent?.includes(${JSON.stringify(playlistName)}),
  );
  option.click();
})()`);
await waitFor(`document.body.innerText.includes("对局音频只会来自这份歌单")`);
await sleep(500);
await screenshot(gameScreenshot);

await evaluate(`(() => {
  const label = [...document.querySelectorAll("p")].find(
    (item) => item.textContent?.trim() === "随机补满",
  );
  label.parentElement.querySelector("button").click();
})()`);
await waitFor(`(() => {
  const label = [...document.querySelectorAll("p")].find(
    (item) => item.textContent?.trim() === "开始游戏",
  );
  return label && !label.parentElement.querySelector("button").disabled;
})()`, 10000);
await evaluate(`(() => {
  const label = [...document.querySelectorAll("p")].find(
    (item) => item.textContent?.trim() === "开始游戏",
  );
  label.parentElement.querySelector("button").click();
})()`);
await waitFor(`document.querySelector("[data-game-state]")?.getAttribute("data-game-state") !== "0"`, 15000);

const playlist = storedAfterReload.playlists[0];
const playlistMusic = new Set(playlist.tracks.map((track) => track.musicId));
const playlistCharacters = new Set(playlist.tracks.map((track) => track.characterId));
const selection = await evaluate(`JSON.parse(localStorage.getItem("musicSelection"))`);
const playingOrder = await evaluate(`JSON.parse(localStorage.getItem("playingOrder"))`);
const characters = await fetch(`${base}/character.json`).then((response) => response.json());
const selectedMusic = [];
for (const characterId of playlistCharacters) {
  const index = selection[characterId];
  const musicList = characters[characterId]?.music;
  const musicId = typeof index === "number" && index >= 0
    ? (Array.isArray(musicList) ? musicList[index] : musicList)
    : null;
  if (musicId) { selectedMusic.push(musicId); }
}
if (selectedMusic.length !== playlistCharacters.size) {
  throw new Error(`not every playlist character received game music: ${JSON.stringify(selectedMusic)}`);
}
if (selectedMusic.some((musicId) => !playlistMusic.has(musicId))) {
  throw new Error(`game selected music outside playlist: ${JSON.stringify(selectedMusic)}`);
}
if (playingOrder.some((characterId) => !playlistCharacters.has(characterId))) {
  throw new Error(`playing order contains out-of-playlist characters: ${JSON.stringify(playingOrder)}`);
}
if (Object.entries(selection).some(([characterId, index]) => (
  index !== -1 && !playlistCharacters.has(characterId)
))) {
  throw new Error("music selection contains an out-of-playlist character");
}

if (exceptions.length) {
  console.error(JSON.stringify({ exceptions }, null, 2));
  throw new Error(`page exceptions: ${exceptions.join(" | ")}`);
}
if (consoleErrors.length) {
  console.error(JSON.stringify({ consoleErrors }, null, 2));
  throw new Error(`console errors: ${consoleErrors.join(" | ")}`);
}

console.log(JSON.stringify({
  pass: true,
  playlistName,
  tracks: playlist.tracks.length,
  uniqueCharacters: playlistCharacters.size,
  playingOrder,
  selectedMusic,
  gameState: await evaluate(`document.querySelector("[data-game-state]").getAttribute("data-game-state")`),
  managerScreenshot,
  gameScreenshot,
}));
socket.close();
