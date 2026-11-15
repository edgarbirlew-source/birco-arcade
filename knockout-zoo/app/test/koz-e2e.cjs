// Run: SCR=<folder holding birco-arcade/ and shared/ (birco-shared checkout)> node test/koz-e2e.cjs  (after BIRCO_SHARED_DIR=... npm run build)
// End-to-end check of Knockout Zoo v48 monetization in a real Chromium (app build www/ with a mocked native bridge + AdMob, and the web build).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), assert = require('assert');
const SCR = process.env.SCR, WWW = SCR + '/birco-arcade/knockout-zoo/app/www', WEB = SCR + '/birco-arcade/knockout-zoo', SHARED = SCR + '/shared';
const MOCK = fs.readFileSync(__dirname + '/mock-native.js', 'utf8');
const mime = f => f.endsWith('.js') ? 'application/javascript' : f.endsWith('.html') ? 'text/html' : f.endsWith('.json') ? 'application/json' : f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.css') ? 'text/css' : 'application/octet-stream';
async function page(browser, root, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } });
  await ctx.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.hostname === 'game.test') {
      let f = path.join(root, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
      if (u.pathname === '/native.js' && opts.mock) return r.fulfill({ body: MOCK.replace('__PLATFORM__', opts.platform || 'android'), contentType: 'application/javascript' });
      if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
      return r.fulfill({ body: fs.readFileSync(f), contentType: mime(f) });
    }
    if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.endsWith('/birco-growth.js')) return r.fulfill({ body: fs.readFileSync(SHARED + '/birco-growth.js'), contentType: 'application/javascript' });
    if (u.hostname === 'raw.githubusercontent.com' && u.pathname.endsWith('/promo.json')) return r.fulfill({ body: fs.readFileSync(SHARED + '/promo.json'), contentType: 'application/json' });
    return r.fulfill({ status: 404, body: '' }); // everything else offline
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  if (opts.full) await p.addInitScript(() => localStorage.setItem('koz_full', '1'));
  await p.goto('https://game.test/'); await p.waitForFunction(() => window.KZ && KZ.ready, null, { timeout: 30000 });
  return { p, errs, ctx };
}
async function fightAndResult(p, win = true) {
  await p.evaluate(() => KZ.startLevel(0)); await p.waitForTimeout(300);
  const during = await p.evaluate(() => ({ playing: BircoGrowth._t.state().playing, more: BircoGrowth.openMore(), canOffer: BircoGrowth.ads.canOffer(), sheet: !!document.querySelector('.bgw') }));
  await p.evaluate(w => finishFight(w, false), win); await p.waitForTimeout(2600);
  return during;
}
const vis = (p, sel) => p.$eval(sel, e => !e.hidden && e.offsetParent !== null).catch(() => false);
(async () => {
  const browser = await chromium.launch(); const out = [];
  const ok = (name, c) => { assert(c, name); out.push('PASS ' + name); };
  // ---------- Android app build ----------
  let { p, errs, ctx } = await page(browser, WWW, { mock: true, platform: 'android' });
  await p.waitForTimeout(800);
  let log = await p.evaluate(() => window.__admob);
  ok('AdMob initialized child-directed, G-rated, test mode', log.init && log.init.tagForChildDirectedTreatment === true && log.init.tagForUnderAgeOfConsent === true && log.init.maxAdContentRating === 'General' && log.init.initializeForTesting === true);
  ok('UMP consent info requested', log.consent === 1);
  ok('no ATT prompt (child-directed)', !log.att);
  ok('rewarded preloaded with Google TEST unit (Android)', log.prepare[0] && log.prepare[0].adId === 'ca-app-pub-3940256099942544/5224354917' && log.prepare[0].isTesting === true && log.prepare[0].npa === true);
  ok('MORE FROM BIRCO on main menu', await vis(p, '#bMore'));
  await p.click('#bMore'); await p.waitForSelector('.bgw');
  const names = await p.$$eval('.bgw-t b', a => a.map(x => x.textContent));
  ok('menu sheet: Cash Diamond shown, own tile + not-live hidden (' + names.join(', ') + ')', names.includes('Cash Diamond Baseball') && !names.includes('Knockout Zoo') && !names.includes('Sword of the Spirit Kids') && !names.includes('Smash Yard'));
  await p.screenshot({ path: SCR + '/e2e/1-more-from-birco-android.png' });
  await p.click('.bgw [data-go="0"]'); await p.waitForSelector('.bgw [data-a]');
  ok('store link behind grown-up check', true);
  const q = await p.$eval('.bgw-c', e => e.textContent.match(/(\d+) × (\d+)/).slice(1).map(Number));
  await p.evaluate(() => { window.__opened = []; window.open = u => (window.__opened.push(u), {}); });
  await p.fill('.bgw [data-a]', String(q[0] * q[1])); await p.click('.bgw [data-ok]');
  const opened = await p.evaluate(() => window.__opened[0]);
  ok('opens Play link tagged utm_source=knockout-zoo&utm_campaign=crosspromo: ' + opened, /^https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.birco\.cashdiamond&utm_source=knockout-zoo&utm_medium=app&utm_campaign=crosspromo&referrer=/.test(opened));
  let d = await fightAndResult(p, true);
  ok('during a fight: no promo, no ad offer, sheet blocked', d.playing && d.more === false && d.canOffer === false && !d.sheet);
  ok('result screen: reward button + MORE FROM BIRCO', await vis(p, '#bResAd') && await vis(p, '#bResMore'));
  ok('first result: no promo pop-up yet', !(await p.$('.bgw')));
  const cash0 = await p.evaluate(() => KZ.S.cash); const btn = await p.textContent('#bResAd');
  await p.screenshot({ path: SCR + '/e2e/2-result-reward-button.png' });
  await p.click('#bResAd'); await p.waitForTimeout(300);
  const cash1 = await p.evaluate(() => KZ.S.cash); log = await p.evaluate(() => window.__admob);
  ok('rewarded video shown on tap and cash doubled (' + btn.trim() + ': ' + cash0 + ' -> ' + cash1 + ')', log.show === 1 && cash1 - cash0 === +btn.match(/\+\$(\d+)/)[1] && !(await vis(p, '#bResAd')));
  d = await fightAndResult(p, false);
  ok('second result: one promo pop-up', await p.$eval('.bgw h2', e => e.textContent) === 'ALSO FROM BIRCO');
  await p.screenshot({ path: SCR + '/e2e/3-one-promo-per-session.png' });
  await p.click('.bgw [data-x]');
  await fightAndResult(p, false); await fightAndResult(p, true);
  ok('no second promo pop-up in the same session', !(await p.$('.bgw')));
  ok('ads never unlock locked fights', await p.evaluate(() => KZF.wall(5) === true));
  ok('no page errors (android)', errs.length === 0 || (console.log(errs), false));
  await ctx.close();
  // ---------- iPhone app build ----------
  ({ p, errs, ctx } = await page(browser, WWW, { mock: true, platform: 'ios' })); await p.waitForTimeout(800);
  log = await p.evaluate(() => window.__admob);
  ok('iOS rewarded TEST unit', log.prepare[0].adId === 'ca-app-pub-3940256099942544/1712485313');
  await p.click('#bMore'); await p.waitForSelector('.bgw');
  const inames = await p.$$eval('.bgw-t b', a => a.map(x => x.textContent));
  ok('iPhone sheet uses App Store tiles (' + inames.join(', ') + ')', inames.includes('Sword of the Spirit Kids') && !inames.includes('Cash Diamond Baseball') && !inames.includes('Knockout Zoo'));
  await p.screenshot({ path: SCR + '/e2e/4-more-from-birco-iphone.png' });
  await ctx.close();
  // ---------- Full Game owner ----------
  ({ p, errs, ctx } = await page(browser, WWW, { mock: true, platform: 'android', full: true })); await p.waitForTimeout(800);
  await fightAndResult(p, true);
  const fb = await p.textContent('#bResAd'); const c0 = await p.evaluate(() => KZ.S.cash);
  await p.click('#bResAd'); await p.waitForTimeout(200);
  log = await p.evaluate(() => window.__admob); const c1 = await p.evaluate(() => KZ.S.cash);
  ok('Full Game: bonus without a video (' + fb.trim() + ')', /FULL GAME BONUS/.test(fb) && log.show === 0 && c1 > c0);
  await fightAndResult(p, false); await fightAndResult(p, true);
  ok('Full Game: no promo pop-ups', !(await p.$('.bgw')));
  ok('Full Game: all fights open', await p.evaluate(() => KZF.wall(5) === false));
  ok('no page errors (full game)', errs.length === 0 || (console.log(errs), false));
  await ctx.close();
  // ---------- web build (Railway page) ----------
  ({ p, errs, ctx } = await page(browser, WEB, {})); await p.waitForFunction(() => window.BircoGrowth && document.getElementById('bMore').hidden === false, null, { timeout: 10000 });
  await fightAndResult(p, true);
  ok('web: no ad button (ads are app only)', !(await vis(p, '#bResAd')));
  ok('web: MORE FROM BIRCO on result screen', await vis(p, '#bResMore'));
  ok('no page errors (web)', errs.length === 0 || (console.log(errs), false));
  await ctx.close(); await browser.close();
  console.log(out.join('\n')); console.log(out.length + ' checks passed');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
