// Test stand-in for app/src/native.js: a native-looking bridge and a fake AdMob plugin that records calls.
(function(){
  const L = window.__admob = { init:null, consent:0, att:0, prepare:[], show:0 };
  const listeners = {};
  const AdMob = {
    initialize: async o => { L.init = o; },
    requestConsentInfo: async o => { L.consent++; return { status:'NOT_REQUIRED', canRequestAds:true, isConsentFormAvailable:false }; },
    showConsentForm: async () => ({ status:'OBTAINED', canRequestAds:true }),
    trackingAuthorizationStatus: async () => { L.att++; return { status:'notDetermined' }; },
    requestTrackingAuthorization: async () => { L.att++; },
    prepareRewardVideoAd: async o => { L.prepare.push(o); return { adUnitId:o.adId }; },
    showRewardVideoAd: async () => { L.show++; (listeners.onRewardedVideoAdReward||[]).forEach(f=>f({type:'coins',amount:10})); return { type:'coins', amount:10 }; },
    addListener: async (ev, f) => { (listeners[ev] = listeners[ev] || []).push(f); return { remove(){ listeners[ev] = (listeners[ev]||[]).filter(x=>x!==f); } }; },
  };
  const plat = '__PLATFORM__';
  window.KZN = { native:true, platform:plat, store: plat==='ios'?'App Store':'Google Play', admob: AdMob,
    price: async()=>'$3.99', owned: async()=>localStorage.getItem('koz_full')==='1', buy: async()=>true, restore: async()=>localStorage.getItem('koz_full')==='1' };
})();
