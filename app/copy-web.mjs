// Builds www/ for the native shells: the web game from the repo root, the shared BIRCO promo module,
// and the bundled store bridge (src/native.js). The store build carries the working store name.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';
const root = new URL('../', import.meta.url).pathname;
const www = new URL('./www/', import.meta.url).pathname;
const NAME = JSON.parse(readFileSync(new URL('./capacitor.config.json', import.meta.url))).appName;
rmSync(www, { recursive: true, force: true });
mkdirSync(www);
for (const f of ['manifest.webmanifest', 'fonts', 'icons', 'lib']) cpSync(root + f, www + f, { recursive: true });
mkdirSync(www + 'birco');
for (const f of ['promo.js', 'promo.json', 'icons']) cpSync(root + 'birco/' + f, www + 'birco/' + f, { recursive: true });
await build({ entryPoints: [new URL('./src/native.js', import.meta.url).pathname], bundle: true, format: 'iife', minify: true, target: 'es2020', outfile: www + 'native.js', nodePaths: [new URL('./node_modules/', import.meta.url).pathname] });

let html = readFileSync(root + 'index.html', 'utf8');
const tag = '<script src="birco/promo.js"></script>';
if (!html.includes(tag)) throw new Error('promo script tag not found in index.html');
html = html.replace(tag, '<script src="native.js"></script>\n' + tag);
html = html.replaceAll('ROAD RAMPAGE', NAME.toUpperCase()).replace(/<title>[^<]*<\/title>/, `<title>${NAME}</title>`);
writeFileSync(www + 'index.html', html);
console.log('www ready for', NAME);
