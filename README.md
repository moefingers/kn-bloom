# Kₙ Bloom

One HTML file. Open it. It runs.

Points materialize one by one on a circle, and every pair is joined by a chord — the complete graph Kₙ, growing point by point from K₂ to whatever ceiling you set, then rewinding or resetting. The whole app — canvas renderer, six easings, colour spectrum, presentation mode, animated-WebP exporter, fonts, favicon — is one `index.html`. Drop it on any static host, double-click it from disk, run it offline. Zero network requests at runtime, no accounts, no backend, no telemetry.

**Live:** https://moefingers.github.io/kn-bloom/

## At a glance

- **Motion**: move time, birth time, min/max points (1–24), step pause, turn pause, fade, six easings (ease in-out, linear, in, out, overshoot, elastic with wobble amplitude and decay), ping-pong rewind or reset-to-two at the top
- **Lines**: thickness, glow, opacity, colour — the line colour is also the UI accent
- **Points**: size, glow, colour
- **Spectrum**: multi-colour points spread evenly around the hue wheel for the max count (so each point keeps its colour through the whole cycle), global hue rotation, blended chord gradients between neighbouring hues
- **Stage**: background colour, guide-circle opacity
- **Export**: one seamless cycle to an animated `.webp` — 30 / 60 / 120 fps, 128–1080 px square, cancelable, progress bar
- **Presentation mode**: hides all chrome for a clean fullscreen stage; `Esc` or the corner button exits
- **Extras**: show point count, highlight the newest point
- **Persistence**: every control in `localStorage`; *Defaults* clears it
- Responsive (stacks under 760 px with a sticky, frosted stage), respects `prefers-reduced-motion` for UI transitions

## How it works

**Engine** — a single `requestAnimationFrame` loop advances a small state machine (`hold → spawn → move → settle`, and `unspawn` on the way back) on virtual time, so pauses and easings are real milliseconds. Targets for *n* points are `k · 360 / n`; each formation glides its existing points to the new targets while the newest one materializes (or dissolves) with a configurable beat. Rendering is plain Canvas 2D at device pixel ratio, with glow via `shadowBlur`.

**Spectrum** — hue for point *k* is `baseHue + k · 360 / maxN`; a chord between two coloured points is a linear gradient through the shorter arc between their hues (`midHue`), so blends never wrap the long way round the wheel.

**Export** — the cycle is first simulated to count frames (capped at 9,000), then rendered frame by frame to an offscreen canvas. Each frame is encoded with `canvas.toBlob('image/webp')`, its `VP8` / `VP8L` / `ALPH` chunks are lifted out of the RIFF container, and the frames are muxed by hand into an animated WebP (`VP8X` + `ANIM` + `ANMF`, infinite loop). Frame durations accumulate fractional milliseconds so 60 fps stays exact across the file. Needs a browser that can *encode* WebP (Chromium); others get a plain message instead of a broken file.

**Persistence** — settings live under `kn-bloom-settings-v2`, with a one-way read of the older `chord-bloom-settings-v2` key so earlier saves carry over.

## Stack

Vanilla HTML, CSS, and JavaScript. Canvas 2D. No framework, no bundler, no runtime dependencies. The only devDependency is `husky` (git hooks); the build is a Node script.

## Development

```
pnpm install   # installs the git hooks
pnpm dev       # http://localhost:5173/ — or just open index.html
```

`index.html` is the whole app; edit it and reload. In development it loads its two font families from Google Fonts, exactly as written in the source. `pnpm dev` is a 50-line no-cache static server for when you want an `http://` origin (device emulation, the Network panel); nothing about the app needs it.

## Build

`pnpm build` emits exactly one file: `dist/index.html` (~135 kB raw / ~62 kB gzipped). `build/build.mjs`:

1. fetches the Google Fonts stylesheet with a modern Chrome user-agent (so it gets woff2),
2. keeps only the `latin` subset — the UI is ASCII plus `°`; the `●` and `✕` glyphs already fall back to the system font in the source — which cuts the font payload to roughly a quarter,
3. merges the two Space Grotesk weight blocks, which point at the same variable font file, into one `font-weight: 400 500` block so the file is embedded once,
4. embeds every woff2 as a `data:` URI and replaces the `<link>` with an inline `<style>`,
5. drops the `preconnect` hints, and
6. **refuses to write** if any `<link href>`, `<script src>`, `<img src>`, `url()`, or `@import` still points at `http(s)://`.

The favicon is already a `data:` URI in the source. The result makes zero network requests at runtime.

## Verification

Each gate proves one thing; none of them proves the next.

- `pnpm check` (`build/check.mjs`, also the pre-commit hook) parses every inline `<script>` with `vm.Script`. **Proves:** the JavaScript is syntactically valid. **Does not prove:** it does the right thing.
- `pnpm build` **proves:** the emitted file references no remote resource. **Does not prove:** it renders.
- Whether the animation, export, and presentation mode behave is settled only by opening `dist/index.html` in a browser — via `file://`, with DevTools' Network tab showing nothing but `data:` URIs — and watching it. Do that before cutting a release.

There is no ESLint and no test runner; the check is deliberately the smallest gate that stops a broken file from shipping, not a substitute for running it.

## Deployment

Built and deployed automatically to GitHub Pages via Actions on push to `shepherd` (`.github/workflows/deploy.yml`). The Pages source must be set to **GitHub Actions** in the repository settings. Pre-commit hook runs `pnpm check` via husky (skipped for docs/image-only commits — see `.husky/lib/non-code-paths.sh`); commit-msg hook enforces [Conventional Commits](https://www.conventionalcommits.org/).

## Releasing

Releases follow [SemVer](https://semver.org/) and are cut by pushing a `vX.Y.Z` tag. The release workflow (`.github/workflows/release.yml`) verifies the tag matches `package.json`, runs the check and the build, and creates a GitHub Release with auto-generated notes and the built file attached as `kn-bloom.html`. The Pages deploy fires separately from the same `shepherd` push.

To cut a release:

```
pnpm release:patch   # 1.0.0 → 1.0.1
pnpm release:minor   # 1.0.0 → 1.1.0
pnpm release:major   # 1.0.0 → 2.0.0
```

Each script runs `pnpm version <bump>`, which bumps `package.json`, creates a `chore(release): vX.Y.Z` commit, and tags it. Then `git push --follow-tags` ships the commit to `shepherd` and the tag to origin, triggering both the Pages deploy and the release workflow.

After the workflow finishes, edit the release on github.com if you want to add prose above the auto-generated commit list — see [CHANGELOG.md](CHANGELOG.md) for the project changelog kept in the repo.

## License

[MIT](LICENSE)
