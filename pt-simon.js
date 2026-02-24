
let cwmsg = "";

const dtimeHistogramBins = new Array(50).fill(0);
const utimeHistogramBins = new Array(50).fill(0);
let dtimeCanvas;
let dtimeCtx;
let utimeCanvas;
let utimeCtx;
let lastDtimeUpdated = -1;

let practiceMode = false;
let note_context = null;
let note_node = null;
let gain_node = null;
let audioResume = false;

const FREQUENCY = 440;
let keydown = 0;
let dtime = 0;
let utime = 0;
let UNIT_MS = 80;
const IDLE_RESET_MS = 640;

let serialPort = null;
let prevCTS = null;
let lastElementTouched = null;
let morsePlaybackActive = false;
let morseOverlayFadeTimeout = null;

const MORSE_OVERLAY_FADE_MS = 500;
const MORSE_CATALOG = [
  { symbol: "A", code: ".-" },
  { symbol: "B", code: "-..." },
  { symbol: "C", code: "-.-." },
  { symbol: "D", code: "-.." },
  { symbol: "E", code: "." },
  { symbol: "F", code: "..-." },
  { symbol: "G", code: "--." },
  { symbol: "H", code: "...." },
  { symbol: "I", code: ".." },
  { symbol: "J", code: ".---" },
  { symbol: "K", code: "-.-" },
  { symbol: "L", code: ".-.." },
  { symbol: "M", code: "--" },
  { symbol: "N", code: "-." },
  { symbol: "O", code: "---" },
  { symbol: "P", code: ".--." },
  { symbol: "Q", code: "--.-" },
  { symbol: "R", code: ".-." },
  { symbol: "S", code: "..." },
  { symbol: "T", code: "-" },
  { symbol: "U", code: "..-" },
  { symbol: "V", code: "...-" },
  { symbol: "W", code: ".--" },
  { symbol: "X", code: "-..-" },
  { symbol: "Y", code: "-.--" },
  { symbol: "Z", code: "--.." },
  { symbol: "0", code: "-----" },
  { symbol: "1", code: ".----" },
  { symbol: "2", code: "..---" },
  { symbol: "3", code: "...--" },
  { symbol: "4", code: "....-" },
  { symbol: "5", code: "....." },
  { symbol: "6", code: "-...." },
  { symbol: "7", code: "--..." },
  { symbol: "8", code: "---.." },
  { symbol: "9", code: "----." },
];

const MORSE_CATALOG_BY_SYMBOL = Object.freeze(
  MORSE_CATALOG.reduce((acc, entry) => {
    acc[entry.symbol.toLowerCase()] = entry;
    return acc;
  }, {})
);

function morseCodeToPattern(code) {
  return String(code)
    .split("")
    .map((char) => (char === "-" ? 3 : 1));
}

const MORSE_PATTERNS = Object.freeze(
  Object.keys(MORSE_CATALOG_BY_SYMBOL).reduce((acc, symbol) => {
    acc[symbol] = morseCodeToPattern(MORSE_CATALOG_BY_SYMBOL[symbol].code);
    return acc;
  }, {})
);

function chooseRandomMorseSymbol(randomFn = Math.random) {
  if (MORSE_CATALOG.length === 0) return null;
  const index = Math.floor(randomFn() * MORSE_CATALOG.length);
  const safeIndex = Math.min(MORSE_CATALOG.length - 1, Math.max(0, index));
  return MORSE_CATALOG[safeIndex];
}

function normalizeSequenceSymbol(value) {
  return String(value == null ? "" : value).trim().toUpperCase();
}

function createMorseSequenceState() {
  const playedSymbols = [];

  return {
    append(symbol) {
      const normalized = normalizeSequenceSymbol(symbol);
      if (!normalized || !MORSE_CATALOG_BY_SYMBOL[normalized.toLowerCase()]) {
        throw new Error(`Unsupported sequence symbol: ${symbol}`);
      }
      playedSymbols.push(normalized);
      return normalized;
    },
    read() {
      return playedSymbols.slice();
    },
    async replay(playFn) {
      const snapshot = playedSymbols.slice();
      for (let i = 0; i < snapshot.length; i++) {
        await playFn(snapshot[i], i, snapshot);
      }
      return snapshot;
    },
    reset() {
      playedSymbols.length = 0;
    },
  };
}

const morseSimonSequenceState = createMorseSequenceState();

async function ensureAudioReady() {
  if (!note_context) {
    note_context = new (window.AudioContext || window.webkitAudioContext)();
    note_node = note_context.createOscillator();
    gain_node = note_context.createGain();
    note_node.frequency.value = FREQUENCY;
    gain_node.gain.value = 0;
    note_node.connect(gain_node);
    gain_node.connect(note_context.destination);
    note_node.start();
  }

  if (note_context.state === "suspended") {
    try {
      await note_context.resume();
      audioResume = true;
    } catch (error) {
      console.warn("Unable to resume audio context", error);
    }
  }
}

async function togglePracticeMode() {
  await ensureAudioReady();
  practiceMode = !practiceMode;
  updatePracticeButtonText();
}

function updatePracticeButtonText() {
  const button = document.getElementById("practiceModeButton");
  if (button) {
    button.innerText = practiceMode ? "🔊" : "🔇";
  }
}

async function connectToSerialPort() {
  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 9600 });
    const signals = await serialPort.getSignals();
    prevCTS = signals.clearToSend;
    listenToSerialPort();
  } catch (error) {
    serialPort = null;
    console.warn("Serial port failed", error);
  }
}

async function listenToSerialPort() {
  if (!serialPort) return;

  while (serialPort.readable) {
    const signals = await serialPort.getSignals();
    const currentCTS = signals.clearToSend;
    if (currentCTS !== prevCTS) {
      if (currentCTS) {
        keyPress();
      } else {
        keyRelease();
      }
      prevCTS = currentCTS;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function toggleHalikey() {
  if (!("serial" in navigator)) {
    alert("Web Serial API is not supported in this browser.");
    return;
  }
  await ensureAudioReady();
  await connectToSerialPort();
}

function playSidetone() {
  if (gain_node) {
    gain_node.gain.setTargetAtTime(0.1, 0, 0.001);
  }
}

function stopSidetone() {
  if (gain_node) {
    gain_node.gain.setTargetAtTime(0, 0, 0.001);
  }
}

function showMorseLetterOverlay(text) {
  const overlay = document.getElementById("morseLetterOverlay");
  if (!overlay) return;

  if (morseOverlayFadeTimeout !== null) {
    clearTimeout(morseOverlayFadeTimeout);
    morseOverlayFadeTimeout = null;
  }

  overlay.style.transitionDuration = `${MORSE_OVERLAY_FADE_MS}ms`;
  overlay.textContent = text;
  overlay.classList.remove("visible");
  void overlay.offsetWidth;
  overlay.classList.add("visible");
}

function fadeOutMorseLetterOverlay() {
  const overlay = document.getElementById("morseLetterOverlay");
  if (!overlay) return;

  overlay.style.transitionDuration = `${MORSE_OVERLAY_FADE_MS}ms`;
  overlay.classList.remove("visible");

  if (morseOverlayFadeTimeout !== null) {
    clearTimeout(morseOverlayFadeTimeout);
  }

  morseOverlayFadeTimeout = window.setTimeout(() => {
    if (!overlay.classList.contains("visible")) {
      overlay.textContent = "";
    }
    morseOverlayFadeTimeout = null;
  }, MORSE_OVERLAY_FADE_MS);
}

async function sendMorseMessage(text) {
  if (morsePlaybackActive) return;

  const displayText = String(text || "").trim();
  const normalized = displayText.toLowerCase();
  const entry = MORSE_CATALOG_BY_SYMBOL[normalized];
  const pattern = MORSE_PATTERNS[normalized];
  if (!entry || !pattern) {
    console.warn(`Unsupported Morse text: ${displayText}`);
    return;
  }

  morsePlaybackActive = true;
  showMorseLetterOverlay(entry.symbol);

  try {
    await ensureAudioReady();
    for (let i = 0; i < pattern.length; i++) {
      keyPress();
      await new Promise((resolve) => setTimeout(resolve, pattern[i] * UNIT_MS));
      keyRelease();
      if (i < pattern.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, UNIT_MS));
      }
    }
  } finally {
    stopSidetone();
    morsePlaybackActive = false;
    fadeOutMorseLetterOverlay();
  }
}

async function playMorseK() {
  await sendMorseMessage("k");
}

async function playMorseSymbolSequence(symbols) {
  const sequence = Array.isArray(symbols) ? symbols.slice() : [];
  for (let i = 0; i < sequence.length; i++) {
    await sendMorseMessage(sequence[i]);
    if (i < sequence.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, UNIT_MS * 3));
    }
  }
}

async function playNextSimonRound() {
  if (morsePlaybackActive) return;
  const nextEntry = chooseRandomMorseSymbol();
  if (!nextEntry) return;
  morseSimonSequenceState.append(nextEntry.symbol);
  await morseSimonSequenceState.replay(async (symbol) => {
    await sendMorseMessage(symbol);
    await new Promise((resolve) => setTimeout(resolve, UNIT_MS * 3));
  });
}

function gapAdjust(delta) {
  UNIT_MS = Math.max(10, UNIT_MS + delta);
}

function drawDtimeHistogram() {
  if (!dtimeCtx || !dtimeCanvas) return;
  dtimeCtx.clearRect(0, 0, dtimeCanvas.width, dtimeCanvas.height);
  const barWidth = dtimeCanvas.width / dtimeHistogramBins.length;
  const maxCount = Math.max(...dtimeHistogramBins);
  dtimeHistogramBins.forEach((count, index) => {
    const barHeight = maxCount > 0 ? (count / maxCount) * dtimeCanvas.height : 0;
    dtimeCtx.fillStyle = index === lastDtimeUpdated ? "yellow" : "blue";
    dtimeCtx.fillRect(index * barWidth, dtimeCanvas.height - barHeight, barWidth, barHeight);
  });
  dtimeCtx.strokeStyle = "black";
  dtimeCtx.beginPath();
  dtimeCtx.moveTo(0, dtimeCanvas.height);
  dtimeCtx.lineTo(dtimeCanvas.width, dtimeCanvas.height);
  dtimeCtx.lineTo(dtimeCanvas.width, 0);
  dtimeCtx.stroke();
  dtimeCtx.fillStyle = "black";
  dtimeCtx.font = "12px sans-serif";
  for (let i = 0; i <= dtimeHistogramBins.length; i += 8) {
    const xPosition = i * barWidth;
    dtimeCtx.fillText(i * 8, xPosition, dtimeCanvas.height - 5);
  }
}

function drawUtimeHistogram() {
  if (!utimeCtx || !utimeCanvas) return;
  utimeCtx.clearRect(0, 0, utimeCanvas.width, utimeCanvas.height);
  const barWidth = utimeCanvas.width / utimeHistogramBins.length;
  const maxCount = Math.max(...utimeHistogramBins);
  utimeHistogramBins.forEach((count, index) => {
    const barHeight = maxCount > 0 ? (count / maxCount) * utimeCanvas.height : 0;
    utimeCtx.fillStyle = "green";
    utimeCtx.fillRect(index * barWidth, utimeCanvas.height - barHeight, barWidth, barHeight);
  });
  utimeCtx.strokeStyle = "black";
  utimeCtx.beginPath();
  utimeCtx.moveTo(0, utimeCanvas.height);
  utimeCtx.lineTo(utimeCanvas.width, utimeCanvas.height);
  utimeCtx.lineTo(utimeCanvas.width, 0);
  utimeCtx.stroke();
  utimeCtx.fillStyle = "black";
  utimeCtx.font = "12px sans-serif";
  for (let i = 0; i <= utimeHistogramBins.length; i += 8) {
    const xPosition = i * barWidth;
    utimeCtx.fillText(i * 8, xPosition, utimeCanvas.height - 5);
  }
}

function updateDtimeHistogram(dtimeValue) {
  if (dtimeValue >= 0 && dtimeValue <= 400) {
    const binIndex = Math.min(Math.floor(dtimeValue / 8), dtimeHistogramBins.length - 1);
    dtimeHistogramBins[binIndex]++;
    lastDtimeUpdated = binIndex;
    drawDtimeHistogram();
  }
}

function updateUtimeHistogram(utimeValue) {
  if (utimeValue >= 0 && utimeValue <= 400) {
    const binIndex = Math.min(Math.floor(utimeValue / 8), utimeHistogramBins.length - 1);
    utimeHistogramBins[binIndex]++;
    drawUtimeHistogram();
  }
}

function clampCanvasSize(canvas, width) {
  if (!canvas) return;
  const clampedWidth = Math.max(200, width || 400);
  canvas.width = clampedWidth;
  canvas.height = (clampedWidth * 8) / 9;
}

function adduiEls(divStr, type = "generic") {
  const appDiv = document.getElementById(divStr);
  if (!appDiv) return;

  const buttonDiv = document.createElement("div");
  buttonDiv.id = "buttonDiv";
  buttonDiv.style.display = "flex";
  buttonDiv.style.flexDirection = "row";
  buttonDiv.style.alignItems = "center";
  buttonDiv.style.flexWrap = "wrap";
  buttonDiv.style.justifyContent = "center";
  buttonDiv.style.whiteSpace = "nowrap";
  buttonDiv.style.height = "auto";
  appDiv.appendChild(buttonDiv);

  const practiceButton = document.createElement("button");
  practiceButton.id = "practiceModeButton";
  practiceButton.innerText = practiceMode ? "🔊" : "🔇";
  buttonDiv.appendChild(practiceButton);

  const gapPlusButton = document.createElement("button");
  gapPlusButton.id = "gapPlusButton";
  gapPlusButton.innerText = "gap+";
  buttonDiv.appendChild(gapPlusButton);

  const gapMinusButton = document.createElement("button");
  gapMinusButton.id = "gapMinusButton";
  gapMinusButton.innerText = "gap-";
  buttonDiv.appendChild(gapMinusButton);

  const halikeyButton = document.createElement("button");
  halikeyButton.id = "startHalikey";
  halikeyButton.innerText = "Start Hk";
  buttonDiv.appendChild(halikeyButton);

  const generateButton = document.createElement("button");
  generateButton.textContent = "Histogram Image";
  generateButton.addEventListener("click", combineCanvasesAndGenerateDownloadLink);
  buttonDiv.appendChild(generateButton);

  const playSequenceButton = document.createElement("button");
  playSequenceButton.id = "playSequenceButton";
  playSequenceButton.innerText = "Play Key";
  playSequenceButton.addEventListener("click", () => playKeySequence(cwmsg));
  buttonDiv.appendChild(playSequenceButton);

  const clrMsgButton = document.createElement("button");
  clrMsgButton.id = "clrMsgButton";
  clrMsgButton.innerText = "clear";
  clrMsgButton.addEventListener("click", clrMsg);
  buttonDiv.appendChild(clrMsgButton);

  const histogramContainer = document.createElement("div");
  histogramContainer.style.display = "flex";
  histogramContainer.style.flexDirection = "column";
  histogramContainer.style.alignItems = "center";
  histogramContainer.style.width = "100%";
  histogramContainer.style.marginTop = "10px";
  appDiv.appendChild(histogramContainer);

  const dtimeTitle = document.createElement("div");
  dtimeTitle.innerText = "Dot/Dash Histogram";
  dtimeTitle.style.textAlign = "center";
  dtimeTitle.style.fontSize = "16px";
  dtimeTitle.style.marginBottom = "10px";
  histogramContainer.appendChild(dtimeTitle);

  dtimeCanvas = document.createElement("canvas");
  dtimeCanvas.id = "dtimeHistogramCanvas";
  clampCanvasSize(dtimeCanvas, histogramContainer.offsetWidth);
  histogramContainer.appendChild(dtimeCanvas);
  dtimeCtx = dtimeCanvas.getContext("2d");
  drawDtimeHistogram();

  const utimeTitle = document.createElement("div");
  utimeTitle.innerText = "Gap Histogram";
  utimeTitle.style.textAlign = "center";
  utimeTitle.style.fontSize = "16px";
  utimeTitle.style.margin = "10px 0";
  histogramContainer.appendChild(utimeTitle);

  utimeCanvas = document.createElement("canvas");
  utimeCanvas.id = "utimeHistogramCanvas";
  clampCanvasSize(utimeCanvas, histogramContainer.offsetWidth);
  histogramContainer.appendChild(utimeCanvas);
  utimeCtx = utimeCanvas.getContext("2d");
  drawUtimeHistogram();
}

function combineCanvasesAndGenerateDownloadLink() {
  const dcanvas = document.getElementById("dtimeHistogramCanvas");
  const ucanvas = document.getElementById("utimeHistogramCanvas");
  const buttonContainer = document.getElementById("buttonDiv");
  if (!dcanvas || !ucanvas || !buttonContainer) return;
  const labelHeight = 30;
  const combinedCanvas = document.createElement("canvas");
  combinedCanvas.width = Math.max(dcanvas.width, ucanvas.width);
  combinedCanvas.height = dcanvas.height + ucanvas.height + labelHeight * 2;
  const ctx = combinedCanvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);
  ctx.fillStyle = "black";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Dot/Dash Times", combinedCanvas.width / 2, labelHeight - 5);
  ctx.drawImage(dcanvas, 0, labelHeight);
  ctx.fillText("Gap Times", combinedCanvas.width / 2, dcanvas.height + labelHeight * 2 - 5);
  ctx.drawImage(ucanvas, 0, dcanvas.height + labelHeight * 2);
  const imageName = "csimon-histogram.png";
  const dataUrl = combinedCanvas.toDataURL("image/png");
  let downloadLink = document.getElementById("downloadHistogramLink");
  if (!downloadLink) {
    downloadLink = document.createElement("a");
    downloadLink.id = "downloadHistogramLink";
    downloadLink.style.display = "block";
    downloadLink.style.marginTop = "10px";
    downloadLink.style.textAlign = "right";
    buttonContainer.appendChild(downloadLink);
  }
  downloadLink.href = dataUrl;
  downloadLink.download = imageName;
  downloadLink.textContent = "Share your results [png]";
}

function clrMsg() {
  cwmsg = "";
  dtime = 0;
  utime = 0;
  keydown = 0;
}

function playKeySequence(keyDownUpString) {
  const sequence = keyDownUpString;
  cwmsg = "";
  dtime = 0;
  utime = 0;
  keydown = 0;
  const keyDownUp = sequence.split("+").map(Number);
  async function playSequence() {
    for (let i = 0; i < keyDownUp.length; i++) {
      if (isNaN(keyDownUp[i])) continue;
      if (i % 2 === 0) {
        playSidetone();
      } else {
        stopSidetone();
      }
      await new Promise((resolve) => setTimeout(resolve, keyDownUp[i]));
    }
    stopSidetone();
  }
  playSequence();
}

function logMessage(message) {
  let logDiv = document.getElementById("consoleLog");
  if (!logDiv) {
    logDiv = document.createElement("div");
    logDiv.id = "consoleLog";
    logDiv.style.position = "fixed";
    logDiv.style.bottom = "10px";
    logDiv.style.left = "10px";
    logDiv.style.background = "rgba(0,0,0,0.7)";
    logDiv.style.color = "white";
    logDiv.style.padding = "5px";
    logDiv.style.fontSize = "12px";
    logDiv.style.zIndex = "9999";
    document.body.appendChild(logDiv);
  }
  logDiv.innerHTML = message;
}

console.log = logMessage;

async function copyManualTestTemplate() {
  const template = document.getElementById("manualTestTemplate");
  const status = document.getElementById("manualTestCopyStatus");
  if (!template) return;

  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(template.value);
      copied = true;
    }
  } catch (error) {
    console.warn("Clipboard API copy failed, falling back", error);
  }

  if (!copied) {
    template.focus();
    template.select();
    template.setSelectionRange(0, template.value.length);
    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    }
  }

  if (status) {
    status.textContent = copied ? "Copied to clipboard" : "Copy failed (select text manually)";
  }
}

function keyPress() {
  if (keydown === 0) {
    const now = performance.now();
    if (utime !== 0) {
      const rawUp = now - utime;
      if (rawUp <= IDLE_RESET_MS) {
        const upDur = Math.round(rawUp);
        cwmsg += upDur + "+";
        updateUtimeHistogram(upDur);
      }
    }
    dtime = now;
    keydown = 1;
    ensureAudioReady();
    if (practiceMode || morsePlaybackActive) {
      playSidetone();
    }
  }
}

function keyRelease() {
  // Ignore stray releases
  if (keydown === 0) return;

  const now = performance.now();

  // --- Duration of this element (dot/dash) ---
  const downDur = Math.round(now - dtime);
  keydown = 0;

  updateDtimeHistogram(downDur);

  // mark time of this release for the next up-gap
  utime = now;

  // local practice sidetone off
  if (practiceMode || morsePlaybackActive) {
    stopSidetone();
  }
}

function control(event) {
  event.preventDefault();
  if (event.type === "touchend") {
    if (lastElementTouched) {
      leave(lastElementTouched);
    }
    lastElementTouched = null;
    return;
  }

  const touches = event.touches;
  if (!touches || touches.length === 0) return;
  const touch = touches[0];
  const pos = { x: touch.clientX, y: touch.clientY };
  const currentElementTouched = document.elementFromPoint(pos.x, pos.y);
  if (lastElementTouched !== null && lastElementTouched === currentElementTouched) {
    stay(currentElementTouched);
  } else {
    enter(currentElementTouched);
  }
}
// iambic loop control
let iambicActive = false;
let iambicToken = 0;
// simple sleep
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startIambic(sideId) {
  iambicActive = true;
  const myToken = ++iambicToken;

  const toneUnits = sideId === "3" ? 3 : 1; // 3 for id=3, 1 for id=1

  while (myToken === iambicToken) {
    keyPress();
    await sleep(toneUnits * UNIT_MS); // tone duration
    keyRelease();
    await sleep(UNIT_MS); // inter-element gap
    if (!iambicActive || myToken !== iambicToken) break;
  }
}

// Called when entering a new element.
function enter(element) {
  if (lastElementTouched !== null) {
    leave(lastElementTouched);
  }

  if (element && (element.id == "1" || element.id == "3")) {
    if (navigator.vibrate) navigator.vibrate(50);
    startIambic(element.id);
  }

  if (element) {
    element.textContent = "on";
    lastElementTouched = element;
  }
}


function stay(element) {
  // no-op right now
}


// Called when leaving an element.
function leave(element) {
  element.textContent = "off";
  iambicActive = false;
}

document.addEventListener("DOMContentLoaded", () => {
  const appDiv = document.getElementById("app");
  if (!appDiv) {
    console.warn("App container (#app) not found.");
    return;
  }

  adduiEls("app", "iambic");
  updatePracticeButtonText();

  const halikeyButton = document.getElementById("startHalikey");
  if (halikeyButton) {
    halikeyButton.addEventListener("click", toggleHalikey);
  }

  const practiceButton = document.getElementById("practiceModeButton");
  if (practiceButton) {
    practiceButton.addEventListener("click", togglePracticeMode);
  }

  const gapPlusButton = document.getElementById("gapPlusButton");
  if (gapPlusButton) {
    gapPlusButton.addEventListener("click", () => gapAdjust(5));
  }

  const gapMinusButton = document.getElementById("gapMinusButton");
  if (gapMinusButton) {
    gapMinusButton.addEventListener("click", () => gapAdjust(-5));
  }

  const elementsContainer = document.getElementById("elements");
  if (elementsContainer) {
    elementsContainer.addEventListener("touchstart", control, false);
    elementsContainer.addEventListener("touchmove", control, false);
    elementsContainer.addEventListener("touchend", control, false);
  }

  const startGameButton = document.getElementById("startGameButton");
  if (startGameButton) {
    startGameButton.addEventListener("click", () => {
      playNextSimonRound().catch((error) => console.warn("Simon round playback failed", error));
    });
  }

  const copyTemplateButton = document.getElementById("copyManualTestTemplateButton");
  if (copyTemplateButton) {
    copyTemplateButton.addEventListener("click", copyManualTestTemplate);
  }
});

const cwSimonGameStateApi =
  typeof window !== "undefined" && window.cwSimonGameState ? window.cwSimonGameState : null;

window.cwSimonTestApi = {
  morseCatalog: MORSE_CATALOG.map((entry) => ({ ...entry })),
  chooseRandomMorseSymbol,
  createMorseSequenceState,
  simonGameState: cwSimonGameStateApi,
  getSequenceSnapshot() {
    return morseSimonSequenceState.read();
  },
  resetSequence() {
    morseSimonSequenceState.reset();
  },
  async replaySequence(playFn) {
    return morseSimonSequenceState.replay(playFn);
  },
  playNextSimonRound,
  playMorseSymbolSequence,
  createSimonGameStateModel(options = {}) {
    if (!cwSimonGameStateApi) {
      throw new Error("cwSimonGameState module is not loaded");
    }
    const chooser =
      typeof options.chooseNextSymbol === "function"
        ? options.chooseNextSymbol
        : () => {
            const picked = chooseRandomMorseSymbol();
            return picked ? picked.symbol : null;
          };
    return cwSimonGameStateApi.createSimonGameStateModel({
      ...options,
      chooseNextSymbol: chooser,
    });
  },
};
