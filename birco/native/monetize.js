// BIRCO store-app monetization, shared by every BIRCO game's Capacitor app (bundle it with esbuild).
//   1. Full Game: one non-consumable purchase that unlocks everything and removes all ads and promos.
//      Owner rule (2026-11-17): every game shows ads, and buying the Full Game is the ONLY way to turn them off.
//      Once the Full Game is owned (bought, restored or found by owned()), this module never loads or shows an ad,
//      even if the game itself forgets to check. Restore Purchase restores ad-free.
//   2. Rewarded ads (Google AdMob): only when the player taps to watch for a reward. No banners, no interstitials.
// The game talks to window.BircoStore; the web version has no BircoStore and no AdMob SDK.
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

  let adsState = 'off'; // off -> starting -> ready | none (no consent / no fill) | removed (Full Game owned)
  let privacyRequired = false;
  let loaded = null;
  let fullOwned = false;
  let ownedCheck = null; // first owned() lookup, so startAds() can wait for it

  // Full Game owned: switch ads off for good in this session.
  function removeAds() {
    fullOwned = true;
    adsState = 'removed';
    loaded = null;
  }
  function noteOwned(isOwned) {
    if (isOwned) removeAds();
    return !!isOwned;
  }

  async function startAds() {
    if (!unit || fullOwned || adsState !== 'off') return;
    adsState = 'starting';
    // Never start the ad SDK for a Full Game owner: wait for the entitlement check first.
    try { if (ownedCheck) await ownedCheck; } catch (e) { /* store offline: fall through, ads allowed */ }
    if (fullOwned) return;
    try {
      // Google's consent form first (shows only where the law needs it, such as the EEA and UK) ...
      let info = await AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: !!cfg.childDirected });
      if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) info = await AdMob.showConsentForm();
      privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
      if (fullOwned) return;
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
      if (fullOwned) return;
      adsState = 'ready';
      preload();
    } catch (e) {
      if (!fullOwned) adsState = 'none';
    }
  }
  function preload() {
    if (fullOwned || adsState !== 'ready' || loaded) return;
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
        return noteOwned(!!t && good({ ...t, productIdentifier: t.productIdentifier || ID }));
      },
      async owned() {
        const { purchases } = await NativePurchases.getPurchases({ productType: T });
        return noteOwned((purchases || []).some(good));
      },
      async restore() {
        await NativePurchases.restorePurchases();
        return this.owned();
      },
    },
    ads: {
      start: startAds,
      // true when a rewarded ad can be offered right now (never for a Full Game owner)
      available: () => !fullOwned && adsState === 'ready',
      // true once the Full Game is owned: the game should hide every ad button
      removed: () => fullOwned,
      // Shows one rewarded ad. Resolves true only if the player watched to the reward. Never shows for a Full Game owner.
      async show() {
        if (fullOwned || adsState !== 'ready') return false;
        try {
          if (!loaded) preload();
          if (!(await loaded) || fullOwned) { loaded = null; preload(); return false; }
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
  // Look up the entitlement at install, so a returning owner never sees the ad SDK start.
  ownedCheck = window.BircoStore.full.owned().catch(() => false);
  return window.BircoStore;
}
