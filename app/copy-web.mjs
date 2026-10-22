// Copies the web game from the repo root into www/ for the native shells.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
const root = new URL('../', import.meta.url).pathname;
const www = new URL('./www/', import.meta.url).pathname;
rmSync(www, { recursive: true, force: true });
mkdirSync(www);
for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'fonts', 'icons', 'lib']) {
  cpSync(root + f, www + f, { recursive: true });
}
console.log('Copied web game into', www);
