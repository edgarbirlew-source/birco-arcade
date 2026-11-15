// Put the store build of Smash Yard in www/: Cohen's game page as the live server sends it (source of truth:
// edgarbirlew-source/smash-yard, deployed by Railway), the shared BIRCO module with a bundled copy of the games
// list (works offline), the purchase bridge, and the online server address.
// The app has no accounts or friends list: it collects no personal data (kids' game, COPPA / Families).
// Online 1v1 by room code still works through the Railway server.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const HOST = process.env.SY_HOST || 'smash-yard-production-b96422af.up.railway.app'; // Railway (smash-yard repo, main)
// SY_GAME_DIR: a local folder with index.html and birco.js (tests); otherwise both are downloaded from the live server.
async function gameFile(name) {
  if (process.env.SY_GAME_DIR) return readFileSync(process.env.SY_GAME_DIR + '/' + name, 'utf8');
  const r = await fetch(`https://${HOST}/${name === 'index.html' ? '' : name}`);
  if (!r.ok) throw new Error(`could not download ${name} from ${HOST}: ${r.status}`);
  return r.text();
}
rmSync('www', { recursive: true, force: true });
mkdirSync('www', { recursive: true });
await build({ entryPoints: ['src/native.js'], bundle: true, format: 'iife', minify: true, outfile: 'www/native.js', target: 'es2020' });
copyFileSync('../../shared/birco-more.js', 'www/birco-more.js');
writeFileSync('www/birco.js', await gameFile('birco.js'));
const games = readFileSync('../../shared/birco-games.json', 'utf8');
JSON.parse(games);
writeFileSync('www/birco-games.js', 'window.BIRCO_GAMES_FALLBACK=' + games.trim() + ';\n');

let html = await gameFile('index.html');
// the server adds the web copies of the shared scripts; the app loads its bundled copies instead (below)
html = html.replace(/<script src="https:\/\/edgarbirlew-source\.github\.io\/birco-arcade\/shared\/birco-more\.js" defer><\/script><script src="\/birco\.js" defer><\/script>/, '');
const must = (what, n) => { const c = html.split(what).length - 1; if (c !== n) throw new Error(`expected ${n} x ${what}, found ${c}`); };
// 1) online play talks to the hosted server, not the app's own address
const wsFrom = /\(location\.protocol === 'https:' \? 'wss:\/\/' : 'ws:\/\/'\)\s*\+\s*location\.host/g;
const nWs = (html.match(wsFrom) || []).length;
if (nWs !== 2) throw new Error('expected 2 WebSocket addresses, found ' + nWs);
html = html.replace(wsFrom, `'wss://${HOST}'`);
// 2) no accounts in the app: never ask for an email; online 1v1 by room code works without one
must('setTimeout(() => SOC.boot(), 0);', 1);
html = html.replace('setTimeout(() => SOC.boot(), 0);', '/* store app: no accounts (no personal data) */');
// 3) the "dad's Railway link" note does not apply inside the app
html = html.replace('Online play only works on the hosted version of Smash Yard (the one on your dad’s Railway link), not inside the preview.', 'Check your internet connection and try again.');
// 4) safe areas on phones with notches and gesture bars
html = html.replace('</head>', '<style>#friendsBtn{display:none!important}body{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style></head>');
const tail = '<script src="native.js"></script><script src="birco-games.js"></script><script src="birco-more.js"></script><script src="birco.js"></script>';
must('</body>', 1);
html = html.replace('</body>', tail + '</body>');
writeFileSync('www/index.html', html);
console.log('www ready, server', HOST);
