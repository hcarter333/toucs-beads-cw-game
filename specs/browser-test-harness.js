(function () {
  const frame = document.getElementById("appFrame");
  const resultsList = document.getElementById("results");
  const summary = document.getElementById("summary");
  const runTestsButton = document.getElementById("runTestsButton");
  const reloadFrameButton = document.getElementById("reloadFrameButton");

  function clearResults() {
    resultsList.innerHTML = "";
  }

  function addResult(status, title, detail) {
    const li = document.createElement("li");
    li.className = status;
    const text = detail ? `${title} - ${detail}` : title;
    li.textContent = `${status.toUpperCase()}: ${text}`;
    resultsList.appendChild(li);
  }

  function pass(title, detail) {
    addResult("pass", title, detail);
  }

  function fail(title, detail) {
    addResult("fail", title, detail);
  }

  function todo(title, detail) {
    addResult("todo", title, detail);
  }

  function setSummary(text) {
    summary.textContent = text;
  }

  function assert(condition, title, detail) {
    if (!condition) {
      throw new Error(detail ? `${title}: ${detail}` : title);
    }
  }

  function waitForFrameLoad(timeoutMs) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`Timed out waiting for app frame load (${timeoutMs}ms)`));
      }, timeoutMs);

      function done(err) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (err) reject(err);
        else resolve();
      }

      frame.addEventListener("load", () => done(), { once: true });
      frame.addEventListener("error", () => done(new Error("Frame failed to load")), { once: true });
    });
  }

  function reloadAppFrame() {
    const url = new URL(frame.getAttribute("src") || "../cwsimon.html", window.location.href);
    url.searchParams.set("_harness", String(Date.now()));
    frame.src = url.toString();
  }

  function getFrameContext() {
    let win;
    let doc;
    try {
      win = frame.contentWindow;
      doc = frame.contentDocument || (win && win.document);
      if (!win || !doc) throw new Error("Frame window/document not available");
      void doc.body;
    } catch (error) {
      throw new Error(
        "Cannot access iframe DOM (likely file:// cross-origin restriction). Serve repo over http:// and retry."
      );
    }
    return { win, doc };
  }

  async function runSmokeTests() {
    clearResults();
    setSummary("Running...");

    const counts = { pass: 0, fail: 0, todo: 0 };
    const record = (fn, title, detail) => {
      try {
        fn();
        pass(title, detail);
        counts.pass += 1;
      } catch (error) {
        fail(title, error.message);
        counts.fail += 1;
      }
    };
    const recordAsync = async (fn, title, detail) => {
      try {
        await fn();
        pass(title, detail);
        counts.pass += 1;
      } catch (error) {
        fail(title, error.message);
        counts.fail += 1;
      }
    };

    try {
      reloadAppFrame();
      await waitForFrameLoad(10000);
      const { win, doc } = getFrameContext();

      record(() => {
        assert(doc.querySelector("#app"), "app root exists");
      }, "Load cwsimon page");

      record(() => {
        const start = doc.getElementById("startGameButton");
        assert(start, "startGameButton missing");
        assert(start.tagName === "BUTTON", "startGameButton should be BUTTON");
      }, "Static page start button exists");

      record(() => {
        const script = doc.querySelector('script[src="./pt-simon.js"]');
        assert(script, "Expected script tag for ./pt-simon.js");
      }, "Static HTML loads pt-simon.js");

      record(() => {
        ["practiceModeButton", "gapPlusButton", "gapMinusButton", "startHalikey", "playSequenceButton"].forEach(
          (id) => assert(doc.getElementById(id), `Missing UI control #${id}`)
        );
      }, "DOMContentLoaded adds iambic controls");

      record(() => {
        ["playMorseK", "keyPress", "keyRelease", "startIambic", "gapAdjust"].forEach((name) =>
          assert(typeof win[name] === "function", `Expected function window.${name}`)
        );
      }, "Core functions are defined");

      const testApi = win.cwSimonTestApi;
      if (!testApi) {
        todo(
          "cw-05x.3 sequence/catalog tests",
          "Stable hooks not exposed yet. Track test API follow-up in cw-z8p."
        );
        counts.todo += 1;
      } else {
        record(() => {
          const catalog = testApi.morseCatalog;
          assert(Array.isArray(catalog), "morseCatalog should be an array");
          assert(catalog.length === 36, "morseCatalog should include A-Z and 0-9");

          const symbols = catalog.map((entry) => entry.symbol);
          const uniqueSymbols = new Set(symbols);
          assert(uniqueSymbols.size === symbols.length, "morseCatalog symbols should be unique");

          const expectedSymbols = [
            ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
            ..."0123456789".split(""),
          ];
          expectedSymbols.forEach((symbol) => {
            assert(uniqueSymbols.has(symbol), `Missing symbol ${symbol}`);
          });

          catalog.forEach((entry) => {
            assert(typeof entry.code === "string" && entry.code.length > 0, `Missing code for ${entry.symbol}`);
            assert(/^[.-]+$/.test(entry.code), `Invalid Morse code chars for ${entry.symbol}`);
          });

          const map = Object.fromEntries(catalog.map((entry) => [entry.symbol, entry.code]));
          assert(map.A === ".-", "Expected A=.-");
          assert(map.K === "-.-", "Expected K=-.-");
          assert(map["5"] === ".....", "Expected 5=.....");
          assert(map["0"] === "-----", "Expected 0=-----");
        }, "Morse catalog completeness and mappings");

        record(() => {
          const before = JSON.stringify(testApi.morseCatalog);
          for (let i = 0; i < 200; i++) {
            const picked = testApi.chooseRandomMorseSymbol(() => i / 199);
            assert(picked && typeof picked.symbol === "string", "Chooser should return catalog entry");
            assert(
              testApi.morseCatalog.some((entry) => entry.symbol === picked.symbol && entry.code === picked.code),
              `Chooser returned non-catalog entry: ${JSON.stringify(picked)}`
            );
          }
          const after = JSON.stringify(testApi.morseCatalog);
          assert(before === after, "Chooser should not mutate catalog");
        }, "Random chooser returns catalog-only entries without mutation");

        await recordAsync(async () => {
          const sequence = testApi.createMorseSequenceState();
          assert(Array.isArray(sequence.read()), "Sequence read() should return an array");
          assert(sequence.read().length === 0, "Sequence should start empty");

          sequence.append("A");
          sequence.append("5");
          sequence.append("K");
          const firstRead = sequence.read();
          assert(firstRead.join(",") === "A,5,K", "append() should preserve order");

          const secondRead = sequence.read();
          assert(secondRead.join(",") === "A,5,K", "read() should be non-mutating");
          secondRead.push("Z");
          assert(sequence.read().join(",") === "A,5,K", "read() snapshot should be isolated");

          const replayed = [];
          await sequence.replay(async (symbol) => {
            replayed.push(symbol);
          });
          assert(replayed.join(",") === "A,5,K", "replay() should replay stored order");
          assert(sequence.read().join(",") === "A,5,K", "replay() should be non-mutating");
          sequence.reset();
          assert(sequence.read().length === 0, "reset() should clear sequence");
        }, "Sequence state append/read/replay/reset behavior");
      }

      record(() => {
        const before = doc.getElementById("1").textContent;
        win.enter(doc.getElementById("1"));
        const afterEnter = doc.getElementById("1").textContent;
        win.leave(doc.getElementById("1"));
        const afterLeave = doc.getElementById("1").textContent;
        assert(before !== undefined, "Missing paddle element #1");
        assert(afterEnter === "on", "enter() should set text to 'on'");
        assert(afterLeave === "off", "leave() should set text to 'off'");
      }, "Basic paddle UI handlers work");

    } catch (error) {
      fail("Harness runtime", error.message);
      counts.fail += 1;
    }

    setSummary(`Pass ${counts.pass} | Fail ${counts.fail} | Todo ${counts.todo}`);
  }

  reloadFrameButton.addEventListener("click", reloadAppFrame);
  runTestsButton.addEventListener("click", () => {
    runSmokeTests().catch((error) => {
      clearResults();
      fail("Harness fatal", error.message);
      setSummary("Pass 0 | Fail 1 | Todo 0");
    });
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get("autorun") === "1") {
    runSmokeTests().catch((error) => {
      clearResults();
      fail("Harness fatal", error.message);
      setSummary("Pass 0 | Fail 1 | Todo 0");
    });
  }
})();
