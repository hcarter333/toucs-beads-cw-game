(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.CWSimonLogic = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const GAME_MODE = Object.freeze({
    IDLE: "idle",
    PLAYBACK: "playback",
    INPUT: "input",
    LOST: "lost",
  });

  const MORSE_CATALOG = Object.freeze([
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
  ].map((entry) => Object.freeze({ symbol: entry.symbol, code: entry.code })));

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
      acc[symbol] = Object.freeze(morseCodeToPattern(MORSE_CATALOG_BY_SYMBOL[symbol].code));
      return acc;
    }, {})
  );

  function normalizeSequenceSymbol(value) {
    return String(value == null ? "" : value).trim().toUpperCase();
  }

  function isSupportedSequenceSymbol(value) {
    const normalized = normalizeSequenceSymbol(value);
    return Boolean(normalized && MORSE_CATALOG_BY_SYMBOL[normalized.toLowerCase()]);
  }

  function chooseRandomMorseSymbol(randomFn, catalog) {
    const list = Array.isArray(catalog) ? catalog : MORSE_CATALOG;
    const picker = typeof randomFn === "function" ? randomFn : Math.random;
    if (list.length === 0) return null;
    const index = Math.floor(picker() * list.length);
    const safeIndex = Math.min(list.length - 1, Math.max(0, index));
    return list[safeIndex];
  }

  function createRandomMorseChooser(options) {
    const opts = options || {};
    const catalog = Array.isArray(opts.catalog) ? opts.catalog.slice() : MORSE_CATALOG.slice();
    const random = typeof opts.random === "function" ? opts.random : Math.random;

    return {
      catalog() {
        return catalog.slice();
      },
      chooseEntry() {
        return chooseRandomMorseSymbol(random, catalog);
      },
      chooseSymbol() {
        const entry = chooseRandomMorseSymbol(random, catalog);
        return entry ? entry.symbol : null;
      },
    };
  }

  function createTimingAdapter(options) {
    const opts = options || {};
    const nowFn =
      typeof opts.now === "function"
        ? opts.now
        : function defaultNow() {
            return Date.now();
          };
    const setTimeoutFn =
      typeof opts.setTimeout === "function"
        ? opts.setTimeout
        : typeof setTimeout === "function"
          ? setTimeout
          : null;
    const clearTimeoutFn =
      typeof opts.clearTimeout === "function"
        ? opts.clearTimeout
        : typeof clearTimeout === "function"
          ? clearTimeout
          : null;

    function schedule(callback, delayMs) {
      if (typeof callback !== "function") {
        throw new Error("schedule requires a callback function");
      }
      if (!setTimeoutFn) {
        throw new Error("No setTimeout implementation configured");
      }
      const delay = Math.max(0, Number(delayMs) || 0);
      const handle = setTimeoutFn(callback, delay);
      return {
        handle,
        cancel() {
          if (!clearTimeoutFn) return false;
          clearTimeoutFn(handle);
          return true;
        },
      };
    }

    return {
      now() {
        return Number(nowFn());
      },
      schedule,
      delay(delayMs) {
        return new Promise((resolve) => {
          schedule(resolve, delayMs);
        });
      },
    };
  }

  function createMorseSequenceState(options) {
    const opts = options || {};
    const supportedMap = opts.catalogBySymbol || MORSE_CATALOG_BY_SYMBOL;
    const playedSymbols = [];

    return {
      append(symbol) {
        const normalized = normalizeSequenceSymbol(symbol);
        if (!normalized || !supportedMap[normalized.toLowerCase()]) {
          throw new Error("Unsupported sequence symbol: " + symbol);
        }
        playedSymbols.push(normalized);
        return normalized;
      },
      read() {
        return playedSymbols.slice();
      },
      async replay(playFn) {
        const snapshot = playedSymbols.slice();
        for (let i = 0; i < snapshot.length; i += 1) {
          await playFn(snapshot[i], i, snapshot);
        }
        return snapshot;
      },
      reset() {
        playedSymbols.length = 0;
      },
    };
  }

  function wpmToUnitMs(wpm) {
    const parsed = Number(wpm);
    const safeWpm = Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
    return Math.max(10, Math.round(1200 / safeWpm));
  }

  function unitMsToWpm(unitMs) {
    const parsed = Number(unitMs);
    const safeUnit = Number.isFinite(parsed) && parsed > 0 ? parsed : wpmToUnitMs(8);
    return Math.max(1, Math.round(1200 / safeUnit));
  }

  const DEFAULT_CONFIG = Object.freeze({
    letterWpm: 8,
    wordWpm: 8,
    noInputTimeoutMs: 5000,
    losingSoundEnabled: true,
  });

  function createConfig(overrides) {
    const next = Object.assign({}, DEFAULT_CONFIG, overrides || {});
    next.letterWpm = Math.max(1, Number(next.letterWpm) || DEFAULT_CONFIG.letterWpm);
    next.wordWpm = Math.max(1, Number(next.wordWpm) || DEFAULT_CONFIG.wordWpm);
    next.noInputTimeoutMs = Math.max(
      1,
      Number(next.noInputTimeoutMs) || DEFAULT_CONFIG.noInputTimeoutMs
    );
    next.letterUnitMs = wpmToUnitMs(next.letterWpm);
    next.wordGapMs = 7 * wpmToUnitMs(next.wordWpm);
    return Object.freeze(next);
  }

  function createMatcher(expectedSymbols) {
    const expected = Array.isArray(expectedSymbols) ? expectedSymbols.map(normalizeSequenceSymbol) : [];
    let index = 0;
    let lost = false;

    return {
      expected() {
        return expected.slice();
      },
      index() {
        return index;
      },
      isComplete() {
        return index >= expected.length;
      },
      isLost() {
        return lost;
      },
      push(actualSymbol) {
        if (lost) {
          return {
            ok: false,
            reason: "lost",
            expected: expected[index] || null,
            actual: normalizeSequenceSymbol(actualSymbol),
            index,
            complete: false,
          };
        }
        const actual = normalizeSequenceSymbol(actualSymbol);
        const expectedSymbol = expected[index] || null;
        const ok = Boolean(expectedSymbol && actual === expectedSymbol);
        if (!ok) {
          lost = true;
          return {
            ok: false,
            reason: expectedSymbol ? "mismatch" : "overflow",
            expected: expectedSymbol,
            actual,
            index,
            complete: false,
          };
        }
        index += 1;
        return {
          ok: true,
          reason: null,
          expected: expectedSymbol,
          actual,
          index: index - 1,
          complete: index >= expected.length,
        };
      },
      reset() {
        index = 0;
        lost = false;
      },
    };
  }

  function isNoInputTimedOut(lastInputAtMs, nowMs, timeoutMs) {
    if (!Number.isFinite(Number(lastInputAtMs)) || !Number.isFinite(Number(nowMs))) return false;
    const timeout = Math.max(1, Number(timeoutMs) || DEFAULT_CONFIG.noInputTimeoutMs);
    return Number(nowMs) - Number(lastInputAtMs) >= timeout;
  }

  function createGameState(options) {
    const opts = options || {};
    const sequence = Array.isArray(opts.sequence) ? opts.sequence.map(normalizeSequenceSymbol) : [];
    const roundsCompleted = Number.isInteger(opts.roundsCompleted) ? opts.roundsCompleted : 0;
    return {
      mode: opts.mode || GAME_MODE.IDLE,
      sequence,
      roundsCompleted,
      currentRound: sequence.length,
      expectedInputIndex: Number.isInteger(opts.expectedInputIndex) ? opts.expectedInputIndex : 0,
      lastInputAtMs: Number.isFinite(Number(opts.lastInputAtMs)) ? Number(opts.lastInputAtMs) : null,
      lossReason: opts.lossReason || null,
      config: createConfig(opts.config),
    };
  }

  function appendRoundSymbol(state, symbol) {
    const base = createGameState(state);
    const normalized = normalizeSequenceSymbol(symbol);
    if (!isSupportedSequenceSymbol(normalized)) {
      throw new Error("Unsupported sequence symbol: " + symbol);
    }
    const nextSequence = base.sequence.concat(normalized);
    return Object.assign({}, base, {
      sequence: nextSequence,
      currentRound: nextSequence.length,
    });
  }

  function startPlayback(state) {
    const base = createGameState(state);
    return Object.assign({}, base, {
      mode: GAME_MODE.PLAYBACK,
      expectedInputIndex: 0,
      lastInputAtMs: null,
      lossReason: null,
    });
  }

  function beginInput(state, nowMs) {
    const base = createGameState(state);
    return Object.assign({}, base, {
      mode: GAME_MODE.INPUT,
      expectedInputIndex: 0,
      lastInputAtMs: Number.isFinite(Number(nowMs)) ? Number(nowMs) : null,
    });
  }

  function applyInputSymbol(state, symbol, nowMs) {
    const base = createGameState(state);
    const actual = normalizeSequenceSymbol(symbol);
    const expected = base.sequence[base.expectedInputIndex] || null;
    if (base.mode !== GAME_MODE.INPUT) {
      return {
        state: base,
        result: { ok: false, reason: "not-input-mode", expected, actual, complete: false },
      };
    }
    if (actual !== expected) {
      const lostState = Object.assign({}, base, {
        mode: GAME_MODE.LOST,
        lossReason: "mismatch",
        lastInputAtMs: Number.isFinite(Number(nowMs)) ? Number(nowMs) : base.lastInputAtMs,
      });
      return {
        state: lostState,
        result: { ok: false, reason: "mismatch", expected, actual, complete: false },
      };
    }

    const nextIndex = base.expectedInputIndex + 1;
    const roundComplete = nextIndex >= base.sequence.length && base.sequence.length > 0;
    const nextMode = roundComplete ? GAME_MODE.IDLE : GAME_MODE.INPUT;
    const nextState = Object.assign({}, base, {
      mode: nextMode,
      expectedInputIndex: nextIndex,
      roundsCompleted: roundComplete ? base.sequence.length : base.roundsCompleted,
      lastInputAtMs: Number.isFinite(Number(nowMs)) ? Number(nowMs) : base.lastInputAtMs,
      lossReason: null,
    });
    return {
      state: nextState,
      result: {
        ok: true,
        reason: null,
        expected,
        actual,
        complete: roundComplete,
      },
    };
  }

  function applyNoInputTimeout(state, nowMs) {
    const base = createGameState(state);
    if (base.mode !== GAME_MODE.INPUT) {
      return { state: base, timedOut: false };
    }
    if (!isNoInputTimedOut(base.lastInputAtMs, nowMs, base.config.noInputTimeoutMs)) {
      return { state: base, timedOut: false };
    }
    return {
      state: Object.assign({}, base, {
        mode: GAME_MODE.LOST,
        lossReason: "timeout",
      }),
      timedOut: true,
    };
  }

  function resetGame(state) {
    const base = createGameState(state);
    return createGameState({ config: base.config });
  }

  return Object.freeze({
    GAME_MODE,
    MORSE_CATALOG,
    MORSE_CATALOG_BY_SYMBOL,
    MORSE_PATTERNS,
    DEFAULT_CONFIG,
    morseCodeToPattern,
    normalizeSequenceSymbol,
    isSupportedSequenceSymbol,
    chooseRandomMorseSymbol,
    createRandomMorseChooser,
    createTimingAdapter,
    createMorseSequenceState,
    wpmToUnitMs,
    unitMsToWpm,
    createConfig,
    createMatcher,
    isNoInputTimedOut,
    createGameState,
    appendRoundSymbol,
    startPlayback,
    beginInput,
    applyInputSymbol,
    applyNoInputTimeout,
    resetGame,
  });
});
