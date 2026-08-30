// build/check.mjs — prove every inline <script> in index.html parses.
//
// The app is one classic (non-module) script inside one HTML file, with
// no compiler in front of it, so a typo would ship as a blank stage.
// This is the pre-commit and CI gate: a syntax error fails the commit.
//
// What this proves: the JavaScript parses. What it does not prove: that
// it runs correctly — that is settled in a browser (README,
// "Verification"). Run with `pnpm check`.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'index.html');
const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

// 1-based line number of a character offset.
function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

// Every <script> element that carries its own body (no src=), with the
// line its body starts on.
function inlineScripts(html) {
  return [...html.matchAll(SCRIPT_RE)]
    .filter((m) => !/\bsrc=/i.test(m[1]))
    .map((m) => ({
      attrs: m[1],
      body: m[2],
      line: lineOf(html, m.index + m[0].indexOf('>') + 1),
    }));
}

// The SyntaxError for a classic script body, or null when it parses.
// lineOffset makes the error's line number match index.html.
function syntaxError(body, lineOffset) {
  try {
    new Script(body, { filename: 'index.html', lineOffset });
    return null;
  } catch (err) {
    return err;
  }
}

const html = readFileSync(SOURCE, 'utf8');
const scripts = inlineScripts(html);
if (scripts.length === 0) {
  console.error('[check] index.html has no inline <script>; nothing to check (did the app move?)');
  process.exit(1);
}

let failed = 0;
let skipped = 0;
for (const s of scripts) {
  if (/type\s*=\s*["']?module/i.test(s.attrs)) {
    // vm.Script parses classic scripts only. A module script would need
    // vm.SourceTextModule (flag-gated) — not implemented; reported, not
    // silently passed.
    console.warn(`[check] index.html:${s.line} — module script NOT checked (unsupported)`);
    skipped += 1;
    continue;
  }
  const err = syntaxError(s.body, s.line - 1);
  if (err) {
    failed += 1;
    console.error(`[check] ${err.stack?.split('\n').slice(0, 4).join('\n') ?? err.message}`);
  }
}

if (failed) {
  console.error(`[check] FAILED: ${failed} of ${scripts.length} inline script(s) do not parse`);
  process.exit(1);
}
console.log(`[check] ok — ${scripts.length - skipped} inline script(s) parse${skipped ? `, ${skipped} skipped` : ''}`);
