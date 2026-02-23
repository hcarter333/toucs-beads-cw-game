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

      todo(
        "cw-05x.3 sequence/catalog tests",
        "Add assertions once catalog/sequence APIs are exposed (e.g., window.cwSimonTestApi)"
      );
      counts.todo += 1;
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
})();
