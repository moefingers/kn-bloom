# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] — 2026-08-30

### Added
- **Loop seam.** A knob that cuts the loop wherever you like: pick the point count the cycle starts from, and the direction it leaves in. On a 1–7 range a seam of 3 heading down runs 3 → 1 → 7 → 3; heading up it runs 3 → 7 → 1 → 3. The lap is the same length either way — only the cut moves — so exports stay seamless. At the minimum the seam can only head up and at the maximum only down; the barred direction is disabled in the select and the seam is clamped whenever min or max moves.

### Changed
- With rewind off, the end-of-cycle snap now returns to the **seam** rather than always to the minimum, and it fires at whichever end the seam direction runs into — so a descending-only cycle is possible for the first time. The checkbox is relabelled accordingly. With the seam left at its default (the minimum, heading up) the behaviour is unchanged.

## [1.0.0] — 2026-08-29

First tagged release. The app itself predates the repository; this release puts it under version control with a build, a deploy, and a release pipeline.

### Added
- **The app.** A single `index.html`: points materialize on a circle and every pair is chorded — the complete graph Kₙ, growing from K₂ to a configurable ceiling and rewinding (ping-pong) or resetting. Motion controls (move / birth times, min / max points, step and turn pauses, fade, six easings including overshoot and elastic with wobble amplitude and decay), line and point styling with glow, an evenly-spread hue spectrum with blended chords, stage colour and guide circle, presentation mode (`Esc` to exit), point-count and newest-point overlays, and `localStorage` persistence (reads the older `chord-bloom-settings-v2` key once so earlier saves carry over).
- **Animated WebP export.** One seamless cycle rendered offscreen at 30 / 60 / 120 fps and 128–1080 px, frames encoded via `canvas.toBlob`, their `VP8` / `VP8L` / `ALPH` chunks muxed by hand into a looping `VP8X` + `ANIM` + `ANMF` container. Fractional frame durations accumulate so 60 fps stays exact; a 9,000-frame cap and a WebP-encode probe fail early with a plain message.
- **Source link and favicon.** A "Source" link in the header points at this repository so an offline copy can find its origin; a K₄ favicon is inlined as a `data:` URI.
- **Single-file build.** `pnpm build` (`build/build.mjs`, zero dependencies) fetches the Google Fonts stylesheet, keeps the `latin` subset, merges variable-font weight blocks so each file is embedded once, inlines every woff2 as a `data:` URI, drops the `preconnect` hints, and refuses to emit a file that still references any remote resource. Output: `dist/index.html`, ~135 kB raw / ~62 kB gzipped, zero runtime network requests.
- **Syntax gate.** `pnpm check` (`build/check.mjs`) parses every inline `<script>` with `vm.Script`; runs as the husky pre-commit hook (skipped for docs/image-only commits via the shared `.husky/lib/non-code-paths.sh` allowlist) and in both workflows. The commit-msg hook enforces Conventional Commits.
- **Deploy.** Push to `shepherd` builds and deploys `dist/` to GitHub Pages (`.github/workflows/deploy.yml`).
- **Release.** Pushing a `v*.*.*` tag verifies it matches `package.json`, runs the check and build, and creates a GitHub Release with auto-generated notes and the built file attached as `kn-bloom.html` (`.github/workflows/release.yml`). `pnpm release:patch` / `release:minor` / `release:major` cut one in a single command.
- `pnpm dev`: a dependency-free static server (`build/serve.mjs`) for an `http://` origin during development.

### Changed
- Defaults: easing is now **elastic** and move time is **650 ms** (previously ease in-out and 350 ms). The slider, the select, and the engine's `cfg` all agree; *Defaults* restores these.

[Unreleased]: https://github.com/moefingers/kn-bloom/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/moefingers/kn-bloom/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/moefingers/kn-bloom/releases/tag/v1.0.0
