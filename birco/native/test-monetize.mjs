// Test for birco/native/monetize.js: a Full Game owner never gets an ad (owner rule 2026-11-17).
// Run: node birco/native/test-monetize.mjs   (no npm install needed; the Capacitor plugins are mocked)
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'monetize.js'), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^/, 'const { Capacitor, NativePurchases, PURCHASE_TYPE, AdMob, RewardAdPluginEvents, AdmobConsentStatus, MaxAdContentRating } = globalThis.__mocks;\n');
const dir = mkdtempSync(join(tmpdir(), 'birco-monetize-'));
const modPath = join(dir, 'monetize.mjs');
writeFileSync(modPath, src);

function mocks({ owned = false, platform = 'android' } = {}) {
  const calls = { init: 0, prepare: 0, show: 0, consent: 0 };
  const state = { owned };
  globalThis.window = {};
  globalThis.__mocks = {
    Capacitor: { getPlatform: () => platform },
    PURCHASE_TYPE: { INAPP: 'inapp' },
    NativePurchases: {
      getProducts: async () => ({ products: [{ priceString: '$3.99' }] }),
      purchaseProduct: async ({ productIdentifier }) => { state.owned = true; return { productIdentifier, purchaseState: '1' }; },
      getPurchases: async () => ({ purchases: state.owned ? [{ productIdentifier: 'game_full_game', purchaseState: '1' }] : [] }),
      restorePurchases: async () => {},
    },
    AdMob: {
      requestConsentInfo: async () => { calls.consent++; return { canRequestAds: true, status: 'OBTAINED', isConsentFormAvailable: false }; },
      showConsentForm: async () => ({ canRequestAds: true }),
      trackingAuthorizationStatus: async () => ({ status: 'authorized' }),
      requestTrackingAuthorization: async () => {},
      initialize: async () => { calls.init++; },
      prepareRewardVideoAd: async () => { calls.prepare++; },
      addListener: async () => ({ remove() {} }),
      showRewardVideoAd: async () => { calls.show++; return { amount: 1 }; },
      showPrivacyOptionsForm: async () => {},
    },
    RewardAdPluginEvents: { Rewarded: 'rewarded' },
    AdmobConsentStatus: { REQUIRED: 'REQUIRED' },
    MaxAdContentRating: { General: 'G' },
  };
  return { calls, state };
}
const cfg = { productId: 'game_full_game', admob: { android: { rewarded: 'ca-app-pub-1111111111111111/2222222222' } }, childDirected: true };
let n = 0;
async function load() { return (await import(modPath + '?v=' + (n++))).installBircoStore; }

// 1. Not owned: rewarded ads start and show.
{
  const { calls } = mocks();
  const S = (await load())(cfg);
  await S.ads.start();
  assert.equal(S.ads.available(), true, 'ads available for a free player');
  assert.equal(S.ads.removed(), false);
  assert.equal(await S.ads.show(), true, 'free player can watch a rewarded ad');
  assert.equal(calls.show, 1);
}
// 2. Already owned (returning owner): the ad SDK never starts, no ad loads or shows.
{
  const { calls } = mocks({ owned: true });
  const S = (await load())(cfg);
  await S.ads.start();
  assert.equal(calls.consent + calls.init + calls.prepare, 0, 'owner: AdMob never touched');
  assert.equal(S.ads.available(), false);
  assert.equal(S.ads.removed(), true);
  assert.equal(await S.ads.show(), false);
  assert.equal(calls.show, 0);
}
// 3. Buys mid-session: ads turn off at once, even if the game still calls show().
{
  const { calls } = mocks();
  const S = (await load())(cfg);
  await S.ads.start();
  assert.equal(S.ads.available(), true);
  assert.equal(await S.full.buy(), true);
  assert.equal(S.ads.available(), false, 'no ads after buying');
  assert.equal(S.ads.removed(), true);
  assert.equal(await S.ads.show(), false);
  assert.equal(calls.show, 0);
}
// 4. Restore Purchase restores ad-free.
{
  const { calls, state } = mocks();
  const S = (await load())(cfg);
  await S.ads.start();
  state.owned = true; // bought on another phone
  assert.equal(await S.full.restore(), true);
  assert.equal(S.ads.available(), false, 'no ads after restore');
  assert.equal(await S.ads.show(), false);
  assert.equal(calls.show, 0);
}
console.log('monetize.js: 4/4 checks passed (Full Game removes every ad; restore restores ad-free)');
