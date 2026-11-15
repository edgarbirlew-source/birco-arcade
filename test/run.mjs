// node test/run.mjs  — unit tests for the shared BIRCO growth module, config and native patcher
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { adIds, patchManifest, patchPlist } from '../birco-native-patch.mjs';
const require = createRequire(import.meta.url);
const here = new URL('..', import.meta.url).pathname;
const BG = require(here + 'birco-growth.js');
const promo = JSON.parse(readFileSync(here + 'promo.json', 'utf8'));
const ads = JSON.parse(readFileSync(here + 'ads.json', 'utf8'));
const { tiles, tag, adUnit } = BG._t;
let n = 0; const t = (name, f) => { f(); n++; console.log('ok', name); };

t('own tile hidden', () => { for (const p of ['android', 'ios']) assert(!tiles(promo, 'knockout-zoo', p, false).some(x => x.id === 'knockout-zoo')); });
t('only live per platform', () => {
  const a = tiles(promo, 'knockout-zoo', 'android', false).map(x => x.id), i = tiles(promo, 'knockout-zoo', 'ios', false).map(x => x.id);
  assert(a.includes('cash-diamond') && !a.includes('sword-of-the-spirit'));
  assert(i.includes('sword-of-the-spirit') && !i.includes('cash-diamond'));
  for (const x of [...a, ...i]) assert(!['smash-yard', 'search-and-destroy'].includes(x));
});
t('store link per platform', () => {
  for (const x of tiles(promo, 'knockout-zoo', 'android', false)) if (x.type === 'game') assert.match(x.url, /^https:\/\/play\.google\.com\//);
  for (const x of tiles(promo, 'knockout-zoo', 'ios', false)) if (x.type === 'game') assert.match(x.url, /^https:\/\/apps\.apple\.com\//);
});
t('utm tags', () => {
  const u = tag('https://play.google.com/store/apps/details?id=x', 'knockout-zoo', 'android');
  assert.match(u, /[?&]utm_source=knockout-zoo/); assert.match(u, /utm_campaign=crosspromo/); assert.match(u, /referrer=utm_source%3Dknockout-zoo/);
  const v = tag('https://apps.apple.com/app/id1', 'cash-diamond', 'ios');
  assert.match(v, /\?utm_source=cash-diamond&/); assert.match(v, /ct=cash-diamond-crosspromo/);
  for (const x of tiles(promo, 'cash-diamond', 'android', false)) assert.match(x.url, /utm_source=cash-diamond.*utm_campaign=crosspromo/);
});
t('kids: kidsSafe only, no links', () => {
  const k = tiles(promo, 'sword-of-the-spirit', 'android', true);
  assert(k.length > 0); for (const x of k) { assert.equal(x.url, null); assert(promo.items.find(i => i.id === x.id).kidsSafe); }
  assert(!k.some(x => x.id === 'knockout-zoo'));
});
t('max 6 tiles, video last', () => {
  const many = { items: Array.from({ length: 9 }, (_, i) => ({ id: 'g' + i, type: i === 0 ? 'video' : 'game', name: 'G' + i, kidsSafe: true, live: true, url: 'https://y/v', android: { live: true, url: 'https://play.google.com/store/apps/details?id=g' + i } })) };
  const r = tiles(many, 'x', 'android', false); assert.equal(r.length, 6); assert(r.every(x => x.type === 'game'));
  const few = { items: many.items.slice(0, 3) }; const r2 = tiles(few, 'x', 'android', false); assert.equal(r2[r2.length - 1].type, 'video');
});
t('recon tile appears once a link is set', () => {
  const p = JSON.parse(JSON.stringify(promo)); const r = p.items.find(i => i.id === 'recon-the-raccoon'); r.live = true; r.url = 'https://www.youtube.com/watch?v=abc';
  const x = tiles(p, 'knockout-zoo', 'ios', false).find(i => i.id === 'recon-the-raccoon'); assert(x); assert.match(x.url, /youtube\.com\/watch\?v=abc&utm_source=knockout-zoo/);
});
t('ads: test IDs until real ones', () => {
  const u = adUnit(ads, 'knockout-zoo', 'android'); assert.equal(u.rewarded, 'ca-app-pub-3940256099942544/5224354917'); assert(u.isTest);
  const i = adUnit(ads, 'knockout-zoo', 'ios'); assert.equal(i.rewarded, 'ca-app-pub-3940256099942544/1712485313');
  const real = JSON.parse(JSON.stringify(ads)); Object.assign(real.games['knockout-zoo'], { test: false, android: { appId: 'ca-app-pub-1~2', rewarded: 'ca-app-pub-1/3' } });
  const r = adUnit(real, 'knockout-zoo', 'android'); assert.equal(r.rewarded, 'ca-app-pub-1/3'); assert(!r.isTest);
  assert.equal(adUnit(ads, 'knockout-zoo', 'web'), null);
});
t('ads: kids games have ads off', () => { for (const g of ['sword-of-the-spirit', 'smash-yard']) assert.equal(adUnit(ads, g, 'android'), null); });
t('ads: knockout zoo is child-directed, G-rated, no tracking', () => { const g = ads.games['knockout-zoo']; assert(g.childDirected && g.underAgeOfConsent && !g.requestTracking); assert.equal(g.maxAdContentRating, 'General'); });
t('skadnetwork list', () => { assert(ads.skAdNetworkIds.length >= 49); assert.equal(ads.skAdNetworkIds[0], 'cstr6suwn9.skadnetwork'); assert.equal(new Set(ads.skAdNetworkIds).size, ads.skAdNetworkIds.length); });
t('manifest patch idempotent + AD_ID removed', () => {
  const m0 = '<?xml version="1.0"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <application\n        android:label="x">\n    </application>\n</manifest>';
  const ids = adIds(ads, 'knockout-zoo', 'android'); const m1 = patchManifest(m0, ids), m2 = patchManifest(m1, ids);
  assert.equal(m1, m2); assert.match(m1, /APPLICATION_ID" android:value="ca-app-pub-3940256099942544~3347511713"/); assert.match(m1, /AD_ID" tools:node="remove"/); assert.match(m1, /xmlns:tools=/);
  assert(!/APPLICATION_ID/.test(patchManifest(m1, null)));
});
t('plist patch idempotent', () => {
  const p0 = '<?xml version="1.0"?>\n<plist version="1.0">\n<dict>\n\t<key>CFBundleName</key>\n\t<string>X</string>\n</dict>\n</plist>\n';
  const ids = adIds(ads, 'knockout-zoo', 'ios'); const p1 = patchPlist(p0, ids, ads), p2 = patchPlist(p1, ids, ads);
  assert.equal(p1, p2); assert.match(p1, /GADApplicationIdentifier<\/key>\s*<string>ca-app-pub-3940256099942544~1458002511/); assert.equal((p1.match(/SKAdNetworkIdentifier/g) || []).length, ads.skAdNetworkIds.length);
  assert.doesNotMatch(p1, /NSUserTrackingUsageDescription/); assert.equal(patchPlist(p1, null, ads).trim(), p0.trim());
});
t('plist: tracking text only for tracking games, and removed from old builds', () => {
  const p0 = '<?xml version="1.0"?>\n<plist version="1.0">\n<dict>\n\t<key>NSUserTrackingUsageDescription</key>\n\t<string>old</string>\n</dict>\n</plist>\n';
  const kz = adIds(ads, 'knockout-zoo', 'ios'); assert.doesNotMatch(patchPlist(p0, kz, ads), /NSUserTrackingUsageDescription/);
  const tr = { appId: 'x', test: true, cfg: { requestTracking: true, childDirected: false } }; assert.match(patchPlist(p0, tr, ads), /NSUserTrackingUsageDescription/);
});
console.log(n + ' tests passed');
