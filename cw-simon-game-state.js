(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root && typeof root === "object") {
    root.cwSimonGameState = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const GAME_MODE = Object.freeze({
    IDLE: "idle",
    PLAYING_SEQUENCE: "playing_sequence",
    AWAITING_INPUT: "awaiting_input",
    LOST: "lost",
  });

  const LOSS_CAUSE = Object.freeze({
    MISMATCH: "mismatch",
    TIMEOUT: "timeout",
  });

  const EVENT_TYPE = Object.freeze({
    RESET: "reset",
    RESTART: "restart",
    BEGIN_ROUND: "begin_round",
    SEQUENCE_PLAYBACK_FINISHED: "sequence_playback_finished",
    INPUT: "input",
    TIMEOUT: "timeout",
  });

  function normalizeSymbol(value) {
    return String(value == null ? "" : value).trim().toUpperCase();
  }

  function cloneState(state) {
    return {
      mode: state.mode,
      sequence: state.sequence.slice(),
      sequenceIndex: state.sequenceIndex,
      roundsCompleted: state.roundsCompleted,
      lossCause: state.lossCause,
    };
  }

  function createInitialGameState() {
    return {
      mode: GAME_MODE.IDLE,
      sequence: [],
      sequenceIndex: 0,
      roundsCompleted: 0,
      lossCause: null,
    };
  }

  function assertValidMode(mode) {
    const validModes = Object.values(GAME_MODE);
    if (!validModes.includes(mode)) {
      throw new Error("Invalid Simon game mode: " + mode);
    }
  }

  function assertState(state) {
    if (!state || typeof state !== "object") {
      throw new Error("Simon game state must be an object");
    }
    if (!Array.isArray(state.sequence)) {
      throw new Error("Simon game state.sequence must be an array");
    }
    if (!Number.isInteger(state.sequenceIndex) || state.sequenceIndex < 0) {
      throw new Error("Simon game state.sequenceIndex must be a non-negative integer");
    }
    if (!Number.isInteger(state.roundsCompleted) || state.roundsCompleted < 0) {
      throw new Error("Simon game state.roundsCompleted must be a non-negative integer");
    }
    assertValidMode(state.mode);
    if (
      state.lossCause !== null &&
      state.lossCause !== LOSS_CAUSE.MISMATCH &&
      state.lossCause !== LOSS_CAUSE.TIMEOUT
    ) {
      throw new Error("Invalid Simon game lossCause: " + state.lossCause);
    }
  }

  function requireMode(state, allowedModes, eventType) {
    if (allowedModes.includes(state.mode)) return;
    throw new Error(
      "Cannot apply event '" +
        eventType +
        "' while mode is '" +
        state.mode +
        "' (allowed: " +
        allowedModes.join(", ") +
        ")"
    );
  }

  function withLoss(state, cause) {
    return {
      mode: GAME_MODE.LOST,
      sequence: state.sequence.slice(),
      sequenceIndex: state.sequenceIndex,
      roundsCompleted: state.roundsCompleted,
      lossCause: cause,
    };
  }

  function reduceSimonGameState(currentState, event) {
    const state = currentState == null ? createInitialGameState() : cloneState(currentState);
    const evt = event || {};
    const type = evt.type;

    assertState(state);
    if (!type) {
      throw new Error("Simon game event requires a type");
    }

    if (type === EVENT_TYPE.RESET) {
      return createInitialGameState();
    }

    if (type === EVENT_TYPE.RESTART) {
      const resetState = createInitialGameState();
      if (evt.nextSymbol == null) {
        return resetState;
      }
      return reduceSimonGameState(resetState, {
        type: EVENT_TYPE.BEGIN_ROUND,
        nextSymbol: evt.nextSymbol,
      });
    }

    if (type === EVENT_TYPE.BEGIN_ROUND) {
      requireMode(state, [GAME_MODE.IDLE, GAME_MODE.LOST], type);
      const nextSymbol = normalizeSymbol(evt.nextSymbol);
      if (!nextSymbol) {
        throw new Error("BEGIN_ROUND requires a non-empty nextSymbol");
      }
      const nextSequence = state.mode === GAME_MODE.LOST ? [] : state.sequence.slice();
      nextSequence.push(nextSymbol);
      return {
        mode: GAME_MODE.PLAYING_SEQUENCE,
        sequence: nextSequence,
        sequenceIndex: 0,
        roundsCompleted: state.mode === GAME_MODE.LOST ? 0 : state.roundsCompleted,
        lossCause: null,
      };
    }

    if (type === EVENT_TYPE.SEQUENCE_PLAYBACK_FINISHED) {
      requireMode(state, [GAME_MODE.PLAYING_SEQUENCE], type);
      return {
        mode: GAME_MODE.AWAITING_INPUT,
        sequence: state.sequence.slice(),
        sequenceIndex: 0,
        roundsCompleted: state.roundsCompleted,
        lossCause: null,
      };
    }

    if (type === EVENT_TYPE.INPUT) {
      requireMode(state, [GAME_MODE.AWAITING_INPUT], type);
      const expected = state.sequence[state.sequenceIndex];
      const actual = normalizeSymbol(evt.symbol);
      if (!actual) {
        throw new Error("INPUT requires a non-empty symbol");
      }
      if (!expected) {
        throw new Error("No expected symbol at sequenceIndex " + state.sequenceIndex);
      }
      if (actual !== expected) {
        return withLoss(state, LOSS_CAUSE.MISMATCH);
      }

      const nextIndex = state.sequenceIndex + 1;
      const roundCompleted = nextIndex >= state.sequence.length;
      return {
        mode: roundCompleted ? GAME_MODE.IDLE : GAME_MODE.AWAITING_INPUT,
        sequence: state.sequence.slice(),
        sequenceIndex: roundCompleted ? 0 : nextIndex,
        roundsCompleted: roundCompleted ? state.roundsCompleted + 1 : state.roundsCompleted,
        lossCause: null,
      };
    }

    if (type === EVENT_TYPE.TIMEOUT) {
      requireMode(state, [GAME_MODE.AWAITING_INPUT], type);
      return withLoss(state, LOSS_CAUSE.TIMEOUT);
    }

    throw new Error("Unknown Simon game event type: " + type);
  }

  function createSimonGameStateModel(options) {
    const opts = options || {};
    const chooseNextSymbol = typeof opts.chooseNextSymbol === "function" ? opts.chooseNextSymbol : null;
    let state = createInitialGameState();

    function dispatch(event) {
      state = reduceSimonGameState(state, event);
      return cloneState(state);
    }

    function chooseSymbolOrThrow(explicitSymbol) {
      if (explicitSymbol != null) return explicitSymbol;
      if (!chooseNextSymbol) {
        throw new Error("No next symbol provided and no chooseNextSymbol configured");
      }
      const chosen = chooseNextSymbol(cloneState(state));
      const normalized = normalizeSymbol(chosen);
      if (!normalized) {
        throw new Error("chooseNextSymbol returned an empty symbol");
      }
      return normalized;
    }

    return {
      getState() {
        return cloneState(state);
      },
      dispatch,
      reset() {
        return dispatch({ type: EVENT_TYPE.RESET });
      },
      restart(nextSymbol) {
        if (nextSymbol == null) {
          return dispatch({ type: EVENT_TYPE.RESTART });
        }
        return dispatch({ type: EVENT_TYPE.RESTART, nextSymbol: nextSymbol });
      },
      beginNextRound(nextSymbol) {
        return dispatch({
          type: EVENT_TYPE.BEGIN_ROUND,
          nextSymbol: chooseSymbolOrThrow(nextSymbol),
        });
      },
      finishSequencePlayback() {
        return dispatch({ type: EVENT_TYPE.SEQUENCE_PLAYBACK_FINISHED });
      },
      submitInput(symbol) {
        return dispatch({ type: EVENT_TYPE.INPUT, symbol: symbol });
      },
      markInputTimeout() {
        return dispatch({ type: EVENT_TYPE.TIMEOUT });
      },
    };
  }

  return Object.freeze({
    GAME_MODE,
    LOSS_CAUSE,
    EVENT_TYPE,
    normalizeSymbol,
    createInitialGameState,
    cloneState,
    reduceSimonGameState,
    createSimonGameStateModel,
  });
});
