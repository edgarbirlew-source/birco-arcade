// Icon, splash and Play feature graphic from the game's own art -> assets/ (for @capacitor/assets) and store/.
// Run from app/ after `npm run build` (reads www/): NODE_PATH=$(npm root -g) node store-art.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const srv = createServer((q, r) => { try { r.end(readFileSync('www' + decodeURIComponent(q.url.split('?')[0]))); } catch { r.statusCode = 404; r.end(); } }).listen(8799);
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('http://localhost:8799/fonts/fonts.css');
await p.setContent(`<link rel="stylesheet" href="http://localhost:8799/fonts/fonts.css"><canvas id=c></canvas>`);
const art = await p.evaluate(async () => {
  await document.fonts.load('100px Bangers');
  const L = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'http://localhost:8799/assets/' + s; });
  const [ring, tiger, gor, glove] = await Promise.all([L('ring_neon.jpg'), L('tiger_jab.png'), L('gorilla_hit.png'), L('glove_gold.png')]);
  const out = {};
  function title(c, x, y, size, lines) {
    c.textAlign = 'center'; c.font = size + 'px Bangers'; c.lineJoin = 'round';
    lines.forEach((t, k) => { const yy = y + k * size * .92; c.lineWidth = size * .16; c.strokeStyle = '#000'; c.strokeText(t, x, yy);
      const g = c.createLinearGradient(0, yy - size * .8, 0, yy); g.addColorStop(0, '#fff3b0'); g.addColorStop(.5, '#ffc83d'); g.addColorStop(1, '#ff8a1a'); c.fillStyle = g; c.fillText(t, x, yy); });
  }
  function scene(w, h, opts) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
    const s = Math.max(w / ring.width, h / ring.height); c.drawImage(ring, (w - ring.width * s) / 2, (h - ring.height * s) / 2, ring.width * s, ring.height * s);
    c.fillStyle = 'rgba(12,10,20,.35)'; c.fillRect(0, 0, w, h);
    if (opts.fighters) { const fh = h * opts.fh;
      const gs = fh / gor.height; c.save(); c.translate(opts.gx * w, opts.base * h); c.scale(-gs, gs); c.drawImage(gor, -gor.width / 2, -gor.height); c.restore();
      const ts = fh / tiger.height; c.save(); c.translate(opts.tx * w, opts.base * h); c.scale(ts, ts); c.drawImage(tiger, -tiger.width / 2, -tiger.height); c.restore(); }
    return [cv, c];
  }
  // icon: tiger throwing the jab, big KO
  { const [cv, c] = scene(1024, 1024, { fighters: false });
    const ts = 900 / tiger.height; c.save(); c.translate(470, 1010); c.scale(ts, ts); c.drawImage(tiger, -tiger.width * .45, -tiger.height); c.restore();
    title(c, 512, 250, 260, ['KO']); out.icon = cv.toDataURL('image/png');
    // adaptive icon foreground: same art on transparent, kept inside the safe middle
    const f = document.createElement('canvas'); f.width = f.height = 1024; const fc = f.getContext('2d');
    const ts2 = 560 / tiger.height; fc.save(); fc.translate(500, 800); fc.scale(ts2, ts2); fc.drawImage(tiger, -tiger.width * .45, -tiger.height); fc.restore();
    title(fc, 512, 380, 170, ['KO']); out.fg = f.toDataURL('image/png');
    const bg = document.createElement('canvas'); bg.width = bg.height = 1024; const bc = bg.getContext('2d'); const s = Math.max(1024 / ring.width, 1024 / ring.height);
    bc.drawImage(ring, (1024 - ring.width * s) / 2, (1024 - ring.height * s) / 2, ring.width * s, ring.height * s); bc.fillStyle = 'rgba(12,10,20,.35)'; bc.fillRect(0, 0, 1024, 1024); out.bg = bg.toDataURL('image/png'); }
  // splash: title over the dark background, art in the middle third (safe for every crop)
  { const cv = document.createElement('canvas'); cv.width = cv.height = 2732; const c = cv.getContext('2d'); c.fillStyle = '#0c0a14'; c.fillRect(0, 0, 2732, 2732);
    title(c, 1366, 1300, 300, ['KNOCKOUT', 'ZOO']); out.splash = cv.toDataURL('image/png'); }
  // Play feature graphic 1024x500
  { const [cv, c] = scene(1024, 500, { fighters: true, fh: .9, base: .98, gx: .78, tx: .22 }); title(c, 512, 200, 120, ['KNOCKOUT ZOO']);
    c.font = '40px Bangers'; c.textAlign = 'center'; c.lineWidth = 8; c.strokeStyle = '#000'; c.strokeText('HUMANS VS. BEASTS', 512, 270); c.fillStyle = '#19e0ff'; c.fillText('HUMANS VS. BEASTS', 512, 270);
    out.feature = cv.toDataURL('image/png'); }
  return out;
});
const save = (f, d) => writeFileSync(f, Buffer.from(d.split(',')[1], 'base64'));
save('assets/icon-only.png', art.icon); save('assets/icon-foreground.png', art.fg); save('assets/icon-background.png', art.bg);
save('assets/splash.png', art.splash); save('assets/splash-dark.png', art.splash);
save('store/app-store-icon-1024.png', art.icon); save('store/play-feature-graphic-1024x500.png', art.feature);
await p.setViewportSize({ width: 512, height: 512 }); await p.setContent(`<img src="${art.icon}" style="width:512px;height:512px;display:block">`); await p.screenshot({ path: 'store/play-icon-512.png' });
await b.close(); srv.close(); console.log('art done');
