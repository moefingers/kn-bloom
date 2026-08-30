// build/build.mjs — emit dist/index.html: the app with every remote
// dependency embedded, so one file runs offline from anywhere.
//
// The source index.html has exactly one network dependency: two font
// families from Google Fonts. This script fetches that stylesheet at
// build time, keeps the subsets the app actually uses, embeds each
// woff2 as a data: URI, drops the now-pointless preconnect hints, and
// writes the result as dist/index.html. It then refuses to emit a file
// that still references any remote resource — an artifact that quietly
// phones home is not the artifact this project promises.
//
// Zero dependencies: Node 22+ (global fetch; node:zlib for the gzip
// size report). Run with `pnpm build`.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'index.html');
const DIST_DIR = resolve(ROOT, 'dist');
const DIST = resolve(DIST_DIR, 'index.html');

// The app's text is ASCII plus a few symbols the latin subset covers
// (°). Glyphs outside it (● ✕) already fall back to the system font in
// the source, so dropping the other subsets changes nothing visible and
// cuts the embedded font payload to roughly a quarter.
const KEEP_SUBSETS = ['latin'];

// Google Fonts serves different CSS per user-agent. A modern Chrome UA
// gets woff2 — the smallest format every current browser reads.
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const FONT_LINK_RE = /<link\s[^>]*href="(https:\/\/fonts\.googleapis\.com\/css2?\?[^"]+)"[^>]*>/;
const PRECONNECT_RE = /[ \t]*<link\s[^>]*rel="preconnect"[^>]*>\r?\n?/g;
const FONT_FILE_RE = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;
const SUBSET_MARK_RE = /^\/\*\s*([\w-]+)\s*\*\//;

// Every way an HTML document pulls a remote resource at load time. An
// <a href> is deliberately absent: a link the user may click is not a
// dependency.
const REMOTE_REF_RES = [
  /<link\b[^>]*\bhref="https?:/i,
  /<script\b[^>]*\bsrc="https?:/i,
  /<img\b[^>]*\bsrc="https?:/i,
  /<iframe\b[^>]*\bsrc="https?:/i,
  /url\(\s*['"]?https?:/i,
  /@import\s+['"]?https?:/i,
];

const log = (msg) => console.log(`[build] ${msg}`);
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

// Read the source document from the repo root.
function readSource() {
  return readFileSync(SOURCE, 'utf8');
}

// Fetch a URL as text, sending the given user-agent.
async function fetchText(url, userAgent) {
  const res = await fetch(url, { headers: { 'User-Agent': userAgent } });
  if (!res.ok) throw new Error(`fetch failed: ${url} (${res.status})`);
  return res.text();
}

// Fetch a URL as bytes.
async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${url} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

// Keep only the @font-face blocks whose "/* subset */" marker is
// allowlisted. Google emits one marker per block; unmarked text (none
// today) passes through untouched. Fail safe: a stylesheet with no
// markers at all is kept whole, with a warning, never emptied.
function keepSubsets(css, subsets) {
  const chunks = css.split(/(?=\/\*\s*[\w-]+\s*\*\/)/);
  const marked = chunks.filter((c) => SUBSET_MARK_RE.test(c));
  if (marked.length === 0) {
    console.warn('[build] font CSS has no subset markers; keeping every @font-face');
    return css;
  }
  const kept = chunks.filter((c) => {
    const m = c.match(SUBSET_MARK_RE);
    return !m || subsets.includes(m[1]);
  });
  if (!kept.some((c) => SUBSET_MARK_RE.test(c))) {
    throw new Error(`font CSS has no @font-face for subsets [${subsets.join(', ')}]`);
  }
  return kept.join('');
}

// Merge @font-face blocks that are identical except for font-weight into
// one block with a weight range. Google emits one block per requested
// weight even when a variable font serves them all from the same file,
// which would otherwise embed that file once per weight.
function mergeVariableWeights(css) {
  const WEIGHT_RE = /font-weight:\s*(\d+)(?:\s+(\d+))?;/;
  const groups = new Map();
  const out = [];
  for (const chunk of css.split(/(?=\/\*\s*[\w-]+\s*\*\/)/)) {
    const m = chunk.match(WEIGHT_RE);
    if (!m) {
      out.push({ text: chunk });
      continue;
    }
    const key = chunk.replace(WEIGHT_RE, 'font-weight:@;');
    const lo = Number(m[1]);
    const hi = Number(m[2] ?? m[1]);
    const seen = groups.get(key);
    if (seen) {
      seen.lo = Math.min(seen.lo, lo);
      seen.hi = Math.max(seen.hi, hi);
      seen.merged += 1;
      continue;
    }
    const entry = { key, lo, hi, merged: 0 };
    groups.set(key, entry);
    out.push(entry);
  }
  const merged = out.reduce((n, e) => n + (e.merged ?? 0), 0);
  if (merged) log(`merged ${merged} duplicate variable-font @font-face block(s) into weight ranges`);
  return out
    .map((e) =>
      e.text ?? e.key.replace('font-weight:@;', e.lo === e.hi ? `font-weight: ${e.lo};` : `font-weight: ${e.lo} ${e.hi};`),
    )
    .join('');
}

// Replace every gstatic woff2 url() with a data: URI of its bytes.
async function inlineFontFiles(css) {
  const urls = [...new Set([...css.matchAll(FONT_FILE_RE)].map((m) => m[1]))];
  let bytes = 0;
  const data = new Map(
    await Promise.all(
      urls.map(async (u) => {
        const raw = await fetchBytes(u);
        bytes += raw.length;
        return [u, `data:font/woff2;base64,${Buffer.from(raw).toString('base64')}`];
      }),
    ),
  );
  return { css: css.replace(FONT_FILE_RE, (_, u) => `url(${data.get(u)})`), files: urls.length, bytes };
}

// Replace the Google Fonts <link> with an inline <style> whose fonts
// are embedded.
async function embedFonts(html) {
  const m = html.match(FONT_LINK_RE);
  if (!m) throw new Error('index.html has no Google Fonts <link>; nothing to embed');
  const css = mergeVariableWeights(keepSubsets(await fetchText(m[1], CHROME_UA), KEEP_SUBSETS));
  const { css: embedded, files, bytes } = await inlineFontFiles(css);
  log(`embedded ${files} font file(s), ${kb(bytes)} of woff2 (subsets: ${KEEP_SUBSETS.join(', ')})`);
  return html.replace(m[0], () => `<style>${embedded.replace(/<\/style/g, '<\/style')}</style>`);
}

// Remove <link rel="preconnect"> hints; they only make sense while the
// fonts are remote.
function stripPreconnects(html) {
  return html.replace(PRECONNECT_RE, '');
}

// Fail if the document still references a remote resource at load time.
function assertOffline(html) {
  const hit = REMOTE_REF_RES.find((re) => re.test(html));
  if (hit) {
    const line = html.split('\n').findIndex((l) => hit.test(l)) + 1;
    throw new Error(`dist would still load a remote resource (line ${line}): ${html.split('\n')[line - 1].trim()}`);
  }
  return html;
}

// Write dist/index.html and report its size.
function writeDist(html) {
  mkdirSync(DIST_DIR, { recursive: true });
  writeFileSync(DIST, html);
  const raw = Buffer.byteLength(html);
  log(`wrote dist/index.html — ${kb(raw)} raw / ${kb(gzipSync(html).length)} gzipped`);
}

try {
  writeDist(assertOffline(stripPreconnects(await embedFonts(readSource()))));
} catch (err) {
  console.error(`[build] FAILED: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
