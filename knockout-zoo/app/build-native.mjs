// Put the store build of Knockout Zoo in www/: the same game file and art as the web page, fonts on board
// (works offline), the native bridge, and the room shim pointed at the hosted room server for online versus.
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const HOST = 'knockout-zoo-production.up.railway.app'; // Railway room server (server.ts) and the web game friends open
rmSync('www', { recursive: true, force: true });
mkdirSync('www', { recursive: true });
await build({ entryPoints: ['src/native.js'], bundle: true, format: 'iife', minify: true, outfile: 'www/native.js', target: 'es2020' });
cpSync('src/fonts', 'www/fonts', { recursive: true });
cpSync('../assets', 'www/assets', { recursive: true });

// room.js: the same shim the server sends at /room.js, but with a fixed server address, and invites that
// link to the web game (a friend without the app just taps the link)
const server = readFileSync('../server.ts', 'utf8');
const m = server.match(/const SHIM = `([\s\S]*?)`;/);
if (!m) throw new Error('room shim not found in server.ts');
const wsLine = "const WS=(location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws';";
if (!m[1].includes(wsLine)) throw new Error('room shim WS line changed');
const shim = m[1].replace(wsLine, `const WS='wss://${HOST}/ws';window.KZ_SHARE_BASE='https://${HOST}/';`);
writeFileSync('www/room.js', shim);

let html = readFileSync('../index.html', 'utf8');
const link = /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/;
if (!link.test(html)) throw new Error('font link not found');
html = html.replace(link, '<link rel="stylesheet" href="fonts/fonts.css">');
// Android draws apps edge to edge: without viewport-fit=cover Capacitor keeps the game inside the status and
// navigation bars, so the fight buttons sit above the phone's bottom bar (Edgar 2026-10-29: controls too low).
html = html.replaceAll(',viewport-fit=cover', '');
html = html.replace('</head>', '<style>body{padding-bottom:max(8px,env(safe-area-inset-bottom,0px),var(--safe-area-inset-bottom,0px))}</style></head>');
const i = html.indexOf('<script>');
if (i < 0) throw new Error('game script not found');
html = html.slice(0, i) + '<script src="room.js"></script>\n<script src="native.js"></script>\n' + html.slice(i);
writeFileSync('www/index.html', html);
console.log('www ready');
