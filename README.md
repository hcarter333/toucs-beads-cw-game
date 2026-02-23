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
