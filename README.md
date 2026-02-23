# toucs-beads-cw-game
CW Simon game implemented with agents and beads

## Browser Test Harness (No Build)

A minimal static browser harness is included for smoke tests and future Simon
feature checks:

- `specs/browser-test-harness.html`
- `specs/browser-test-harness.js`

Run options:

- Open `specs/browser-test-harness.html` directly in a browser (may work)
- Recommended: serve the repo root and open the harness over `http://`

Example:

```bash
cd /home/hcarter/gt/cwtoucsgt/mayor/rig
python3 -m http.server 8000
```

Then open:

- `http://localhost:8000/specs/browser-test-harness.html`

## Agent Testing Workflow (Browser Harness)

Use the harness as the default smoke-test step for Simon tasks that touch
`cwsimon.html` or `pt-simon.js`.

### When to use it

- After any UI wiring change in `cwsimon.html`
- After changes to event handlers or initialization in `pt-simon.js`
- Before closing beads such as `cw-05x.2`, `cw-05x.3`, and follow-on Simon tasks

### Standard agent steps

1. Start a local server from the repo root:

   ```bash
   cd /home/hcarter/gt/cwtoucsgt/mayor/rig
   python3 -m http.server 8000
   ```

2. Open the harness in a browser (Windows browser from WSL is OK):

   - `http://localhost:8000/specs/browser-test-harness.html`
   - or `\\wsl$\...` path for manual open if needed

3. Click `Run Smoke Tests`.

4. Confirm:

   - App frame loads (`cwsimon.html`)
   - `pt-simon.js` is loaded
   - Core controls/functions still exist
   - No obvious console/runtime breakage in page initialization

5. Record the outcome in bead notes / work notes:

   - Harness run status (pass/fail count)
   - Any failing check names
   - Whether manual browser-only checks were also performed (audio, Web Serial)

### What the harness covers today

- Static page/script wiring smoke checks
- DOMContentLoaded UI control creation checks
- Presence of key global functions used by current features
- Basic paddle enter/leave UI handler behavior

### What still needs manual testing

- Audio playback behavior / timing (browser gesture + audio policy dependent)
- Web Serial / HALI key integration
- Touch interaction on real device hardware
- Visual polish and timing-sensitive animation/fade checks for future tasks

### Future extension pattern (for agents)

When implementing new Simon features, add targeted harness assertions in
`specs/browser-test-harness.js` for the new behavior when stable hooks exist.

- Prefer checking stable DOM/state hooks over brittle text scraping
- If needed, expose a small test API (see bead `cw-z8p`) for catalog/sequence
  assertions in `cw-05x.3+`
- Keep the harness no-build and browser-only (no npm, no test framework)

### Failure handling

- If the harness cannot access the iframe app DOM, you likely opened it from
  `file://` with browser cross-origin restrictions enabled. Re-run over
  `http://localhost`.
- If smoke tests fail after your change, do not close the bead until the failure
  is fixed or explicitly documented as expected with a follow-up bead.

## Manual Test Request Handoff Template (Agent -> Human)

When agents need human-only verification (UX/audio/hardware), they should
record details in the bead notes and send a short nudge/mail using a consistent
template.

### Bead notes template (agent fills this in)

```text
Manual test requested (human):
- Bead: cw-____
- Commit/branch tested: <commit hash or branch>
- Page: cwsimon.html
- Harness result: Pass X / Fail Y / Todo Z
- Smoke test summary: <short summary>
- Manual checks requested:
  - UX/visual behavior: <what to verify>
  - Audio/timing: <what to verify>
  - HALI/Web Serial (if applicable): <what to verify>
- Known caveats / expected issues:
  - <none or list>
- How to report back:
  - Paste results into bead notes using the in-app Manual Test Template panel
```

### Nudge/mail message template (agent sends this)

```text
<bead-id> ready for manual testing.
Smoke tests: Pass X / Fail Y / Todo Z (harness).
Please run UX/audio/hardware checks in cwsimon.html and paste results into the bead notes using the in-app template.
Specific checks: <one-line list>.
```

### Signaling guidance

- Prefer bead notes as the durable source of truth
- Use `gt nudge` for immediate attention while a session is active
- Use `gt mail send` if the recipient may not be active right now
