// BIRCO store-app monetization, shared by every BIRCO game's Capacitor app (bundle it with esbuild).
//   1. Full Game: one non-consumable purchase that unlocks everything and removes all ads and promos.
//   2. Rewarded ads (Google AdMob): only when the player taps to watch for a reward. No banners, no interstitials.
// The game talks to window.BircoStore; the web version has no BircoStore, so it stays free with no ads.
//
// const cfg = { productId: 'mygame_full_game',
//   admob: { android: { rewarded: 'ca-app-pub-…/…' }, ios: { rewarded: 'ca-app-pub-…/…' } },
//   childDirected: false, maxAdContentRating: 'General' };
// installBircoStore(cfg)
import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { AdMob, RewardAdPluginEvents, AdmobConsentStatus, MaxAdContentRating } from '@capacitor-community/admob';

const TEST_PUB = 'ca-app-pub-3940256099942544/'; // Google's official test ad units

export function installBircoStore(cfg) {
  const platform = Capacitor.getPlatform();
  const store = platform === 'ios' ? 'App Store' : 'Google Play';
  const T = PURCHASE_TYPE.INAPP;
  const ID = cfg.productId;
  const good = (p) => p.productIdentifier === ID && (platform !== 'android' || p.purchaseState === '1' || p.purchaseState == null);
  const unit = (cfg.admob && cfg.admob[platform] && cfg.admob[platform].rewarded) || '';
  const testing = unit.startsWith(TEST_PUB);

  let adsState = 'off'; // off -> starting -> ready | none (no consent / no fill)
  let privacyRequired = false;
  let loaded = null;

  async function startAds() {
    if (!unit || adsState !== 'off') return;
    adsState = 'starting';
    try {
      // Google's consent form first (shows only where the law needs it, such as the EEA and UK) ...
      let info = await AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: !!cfg.childDirected });
      if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) info = await AdMob.showConsentForm();
      privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
      if (!info.canRequestAds) { adsState = 'none'; return; }
      // ... then Apple's App Tracking Transparency prompt (iPhone only, asked once).
      if (platform === 'ios' && !cfg.childDirected) {
        const t = await AdMob.trackingAuthorizationStatus().catch(() => null);
        if (t && t.status === 'notDetermined') await AdMob.requestTrackingAuthorization().catch(() => {});
      }
      await AdMob.initialize({
        tagForChildDirectedTreatment: !!cfg.childDirected,
        tagForUnderAgeOfConsent: !!cfg.childDirected,
        maxAdContentRating: MaxAdContentRating[cfg.maxAdContentRating || 'General'] || MaxAdContentRating.General,
      });
      adsState = 'ready';
      preload();
    } catch (e) {
      adsState = 'none';
    }
  }
  function preload() {
    if (adsState !== 'ready' || loaded) return;
    loaded = AdMob.prepareRewardVideoAd({ adId: unit, isTesting: testing, npa: !!cfg.childDirected }).then(() => true, () => { loaded = null; return false; });
  }

  window.BircoStore = {
    native: true,
    platform,
    store,
    full: {
      async price() {
        const { products } = await NativePurchases.getProducts({ productIdentifiers: [ID], productType: T });
        return products && products[0] ? products[0].priceString : null;
      },
      async buy() {
        const t = await NativePurchases.purchaseProduct({ productIdentifier: ID, productType: T, quantity: 1 });
        return !!t && good({ ...t, productIdentifier: t.productIdentifier || ID });
      },
      async owned() {
        const { purchases } = await NativePurchases.getPurchases({ productType: T });
        return (purchases || []).some(good);
      },
      async restore() {
        await NativePurchases.restorePurchases();
        return this.owned();
      },
    },
    ads: {
      start: startAds,
      // true when a rewarded ad can be offered right now
      available: () => adsState === 'ready',
      // Shows one rewarded ad. Resolves true only if the player watched to the reward.
      async show() {
        if (adsState !== 'ready') return false;
        try {
          if (!loaded) preload();
          if (!(await loaded)) { loaded = null; preload(); return false; }
          let rewarded = false;
          const h = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { rewarded = true; });
          try { const r = await AdMob.showRewardVideoAd(); if (r && r.amount != null) rewarded = true; }
          finally { h.remove(); loaded = null; setTimeout(preload, 500); }
          return rewarded;
        } catch (e) { loaded = null; setTimeout(preload, 2000); return false; }
      },
      privacyRequired: () => privacyRequired,
      privacyOptions: () => AdMob.showPrivacyOptionsForm(),
    },
  };
  return window.BircoStore;
}
