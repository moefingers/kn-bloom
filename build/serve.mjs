// build/serve.mjs — serve the repo root over HTTP for development.
//
// The app runs straight from file:// too. This exists for DevTools
// workflows that want an http origin (device emulation, the Network
// panel) and for a stable URL. No caching, no dependencies. Run with
// `pnpm dev`; PORT overrides the default 5173.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

// Map a request URL to a file under ROOT; null for anything outside it
// or missing. A directory resolves to its index.html.
async function fileFor(url) {
  const path = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  let file = resolve(ROOT, `.${path}`);
  if (file !== ROOT && !file.startsWith(ROOT + sep)) return null;
  try {
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    await stat(file);
    return file;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const file = await fileFor(req.url ?? '/');
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  res.end(await readFile(file));
}).listen(PORT, () => console.log(`[dev] serving ${ROOT} at http://localhost:${PORT}/`));
