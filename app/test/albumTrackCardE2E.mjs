const base = process.env.TEST_BASE;
const debugBase = process.env.TEST_DEBUG;
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

async function clickExactText(text, root = "document") {
  const clicked = await evaluate(`(() => {
    const root = ${root};
    const element = [...root.querySelectorAll("button, p, span, div")].find(
      (item) => item.textContent?.trim() === ${JSON.stringify(text)},
    );
    if (!element) { return false; }
    element.click();
    return true;
  })()`);
  if (!clicked) { throw new Error(`could not find text: ${text}`); }
}

async function clickTransport(index) {
  const clicked = await evaluate(`(() => {
    const seek = document.querySelector('input[type="range"]');
    const controls = seek?.closest(".MuiStack-root")?.parentElement;
    const groups = controls ? [...controls.children].filter(
      (item) => item.classList.contains("MuiStack-root"),
    ) : [];
    const buttons = groups.at(-1)?.querySelectorAll("button") ?? [];
    if (!buttons[${index}]) { return false; }
    buttons[${index}].click();
    return true;
  })()`);
  if (!clicked) { throw new Error(`could not find transport button ${index}`); }
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

await send("Page.navigate", { url: `${base}/?locale=zh&album-card-e2e=${Date.now()}` });
await waitFor(`document.readyState === "complete" && document.body.innerText.includes("角色卡")`);
await evaluate(`localStorage.clear()`);
await send("Page.reload", { ignoreCache: true });
await waitFor(`document.readyState === "complete" && document.body.innerText.includes("角色卡")`);
const initialExceptionCount = exceptions.length;

const albumName = "against, perfect cherry blossom";
const firstCharacter = "レミリア・スカーレット";
const clickedTrack = "遠野幻想物語";
const clickedCharacter = "橙";
const nextTrack = "東方妖々夢 ～ Ancient Temple";
const nextCharacter = "魂魄妖夢";

await clickExactText("专辑", "document");
await waitFor(`document.querySelector(".MuiDrawer-paper")?.innerText.includes(${JSON.stringify(albumName)})`);
await clickExactText(albumName, 'document.querySelector(".MuiDrawer-paper")');
await waitFor(`localStorage.getItem("currentCharacterId") === ${JSON.stringify(firstCharacter)}`);
await waitFor(`document.querySelector(".MuiDrawer-paper")?.innerText.includes(${JSON.stringify(clickedTrack)})`);

await clickExactText(clickedTrack, 'document.querySelector(".MuiDrawer-paper")');
await waitFor(`localStorage.getItem("currentCharacterId") === ${JSON.stringify(clickedCharacter)}`);
await waitFor(`(() => {
  const card = [...document.querySelectorAll("div")].find(
    (item) => getComputedStyle(item).transform === "matrix(1, 0, 0, 1, 0, 0)"
      && item.querySelector('img[alt="Character Card"]'),
  );
  return card?.innerText.includes(${JSON.stringify(clickedCharacter)})
    && card?.innerText.includes(${JSON.stringify(clickedTrack)});
})()`);

await clickTransport(2);
await waitFor(`localStorage.getItem("currentCharacterId") === ${JSON.stringify(nextCharacter)}`);
await waitFor(`(() => {
  const card = [...document.querySelectorAll("div")].find(
    (item) => getComputedStyle(item).transform === "matrix(1, 0, 0, 1, 0, 0)"
      && item.querySelector('img[alt="Character Card"]'),
  );
  return card?.innerText.includes(${JSON.stringify(nextCharacter)})
    && card?.innerText.includes(${JSON.stringify(nextTrack)});
})()`);

await clickTransport(0);
await waitFor(`localStorage.getItem("currentCharacterId") === ${JSON.stringify(clickedCharacter)}`);

const interactionExceptions = exceptions.slice(initialExceptionCount);
if (interactionExceptions.length) {
  throw new Error(`page exceptions during interaction: ${interactionExceptions.join(" | ")}`);
}

console.log(JSON.stringify({
  pass: true,
  preexistingHydrationExceptions: initialExceptionCount,
  albumName,
  firstCharacter,
  clickedTrack,
  clickedCharacter,
  nextTrack,
  nextCharacter,
  currentCharacterId: await evaluate(`localStorage.getItem("currentCharacterId")`),
}));
socket.close();
