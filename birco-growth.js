/* BIRCO Growth: one shared module for every BIRCO game (Cash Diamond, Knockout Zoo, Sword of the Spirit,
 * Search and Destroy, Smash Yard, and future games). Source of truth: birco-arcade branch "birco-shared".
 *
 *  1. Cross-promotion: "More from BIRCO" sheet built from promo.json (one catalog for all games).
 *  2. Full Game: the game tells us if the one-time purchase is owned; owners get no ads and no promo pop-ups.
 *  3. Rewarded ads (Google AdMob through @capacitor-community/admob), IDs from ads.json.
 *
 * Rules built in (BIRCO Game Monetization and Growth Standard, 2026-11-15):
 *  - Promos and ads only on menu / game-over screens. Never while playing (setPlaying(true) blocks everything).
 *  - At most one full-screen promo per app session. No interstitial ads, no banners. Rewarded only, player taps.
 *  - Only tiles live in the store for this platform; never this game's own tile; Play link on Android, App Store on iPhone.
 *  - Every link tagged utm_source=<game>, utm_campaign=crosspromo (+ Play install referrer, + App Store ct).
 *  - Kids games (kids:true): only kidsSafe tiles, no external links, ads come from ads.json (kids games: enabled:false).
 *
 * Use (plain script, sets window.BircoGrowth):
 *   BircoGrowth.init({ game:'knockout-zoo', platform:'android'|'ios'|'web', native:true, kids:false,
 *     isFullGame:()=>bool, admob: AdMob plugin or null, promo: bundled promo.json, ads: bundled ads.json,
 *     parentalGate:true, label:{store:'Google Play'} });
 *   BircoGrowth.setPlaying(true|false)    // around every fight / level
 *   BircoGrowth.openMore()                // "More from BIRCO" button on menu and game-over
 *   BircoGrowth.maybePromo('gameover')    // at most one pop-up per session, never for Full Game owners
 *   BircoGrowth.ads.canOffer()            // show a "watch a video" button?
 *   await BircoGrowth.ads.watch('double_cash')  // -> {rewarded:boolean, free:boolean}
 */
(function (root) {
  'use strict';
  var RAW = 'https://raw.githubusercontent.com/edgarbirlew-source/birco-arcade/birco-shared/';
  var LS_PROMO = 'birco_promo_v1';
  var MAX_TILES = 6;

  // ---------- pure helpers (unit tested in test/run.mjs) ----------
  function itemLink(item, platform) {
    if (!item) return null;
    if (item.type === 'video') return item.live && item.url ? item.url : null;
    var p = platform === 'ios' ? item.ios : item.android;
    return p && p.live && p.url ? p.url : null;
  }
  function tag(url, game, platform) {
    if (!url) return url;
    var q = [];
    var add = function (k, v) { q.push(k + '=' + encodeURIComponent(v)); };
    add('utm_source', game); add('utm_medium', 'app'); add('utm_campaign', 'crosspromo');
    if (/play\.google\.com\/store\/apps\/details/.test(url)) add('referrer', 'utm_source=' + game + '&utm_medium=app&utm_campaign=crosspromo');
    if (/apps\.apple\.com\//.test(url)) add('ct', (game + '-crosspromo').slice(0, 40));
    return url + (url.indexOf('?') < 0 ? '?' : '&') + q.join('&');
  }
  function tiles(promo, game, platform, kids) {
    var items = (promo && promo.items) || [];
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || it.id === game) continue;
      if (kids && !it.kidsSafe) continue;
      var url = itemLink(it, platform);
      if (!url) continue; // not live on this platform
      out.push({ id: it.id, type: it.type, name: it.name, pitch: it.pitch || '', icon: it.icon || '', color: it.color || '#ffc83d',
        age: it.age || '', url: kids ? null : tag(url, game, platform) });
    }
    // games first, Recon last; cap at 6
    out.sort(function (a, b) { return (a.type === 'video') - (b.type === 'video'); });
    return out.slice(0, MAX_TILES);
  }
  function adUnit(adsCfg, game, platform) {
    var g = adsCfg && adsCfg.games && adsCfg.games[game];
    if (!g || !g.enabled || (platform !== 'android' && platform !== 'ios')) return null;
    var real = g[platform] || {};
    var test = adsCfg.testIds[platform];
    var useTest = g.test || !real.rewarded || !real.appId;
    return { appId: useTest ? test.appId : real.appId, rewarded: useTest ? test.rewarded : real.rewarded, isTest: useTest, cfg: g };
  }

  // ---------- state ----------
  var O = null, promo = null, playing = false, promoShown = false, resultCount = 0, sheet = null;
  var ad = { ready: false, loading: false, unit: null, inited: false, canRequest: true, err: '' };

  function platformOf() {
    if (O && O.platform && O.platform !== 'web') return O.platform;
    var ua = (root.navigator && navigator.userAgent) || '';
    return /iPhone|iPad|iPod/.test(ua) ? 'ios' : 'android';
  }
  function owned() { try { return !!(O && O.isFullGame && O.isFullGame()); } catch (e) { return false; } }

  function loadPromo() {
    try { var c = JSON.parse(localStorage.getItem(LS_PROMO) || 'null'); if (c && c.items) promo = c; } catch (e) {}
    if (!promo && O.promo) promo = O.promo;
    if (O.offline || !root.fetch) return;
    fetch(RAW + 'promo.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && j.items) { promo = j; try { localStorage.setItem(LS_PROMO, JSON.stringify(j)); } catch (e) {} }
    }).catch(function () {});
  }

  // ---------- UI ----------
  var CSS = '.bgw{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,3,12,.88)}'
    + '.bgw-c{width:100%;max-width:400px;max-height:100%;overflow-y:auto;background:var(--panel,#1b1730);color:var(--fg,#fff);border:3px solid var(--gold,#ffc83d);border-radius:16px;box-shadow:0 8px 0 #000;padding:14px;display:flex;flex-direction:column;gap:10px;text-align:center;font-family:var(--body,system-ui,sans-serif)}'
    + '.bgw-c h2{margin:0;color:var(--gold,#ffc83d);font-family:var(--display,Impact,sans-serif);letter-spacing:1px;font-size:30px;font-weight:400}.bgw-c p{margin:0;line-height:1.3}'
    + '.bgw-t{display:flex;gap:10px;align-items:center;text-align:left;background:#000;border-radius:12px;padding:8px;border:2px solid #333}'
    + '.bgw-i{width:56px;height:56px;border-radius:12px;flex:none;object-fit:cover;display:flex;align-items:center;justify-content:center;font-family:var(--display,Impact,sans-serif);font-size:28px;color:#000}'
    + '.bgw-n{flex:1;min-width:0}.bgw-n b{display:block;font-size:16px}.bgw-n span{display:block;font-size:13px;color:var(--muted,#b9b0d6)}.bgw-n small{display:block;font-size:11px;color:var(--muted,#b9b0d6);opacity:.8}'
    + '.bgw-b{flex:none;font:inherit;font-weight:800;border:0;border-radius:10px;padding:10px 12px;background:var(--gold,#ffc83d);color:#000;cursor:pointer;min-width:64px}'
    + '.bgw-x{font:inherit;font-weight:800;border:0;border-radius:12px;padding:12px;background:#3a3550;color:#fff;cursor:pointer}'
    + '.bgw-c input{font-size:26px;text-align:center;background:#000;color:var(--gold,#ffc83d);border:3px solid #000;border-radius:12px;padding:8px;width:100%;box-sizing:border-box}.bgw-m{color:var(--bad,#ff5a4a);min-height:1em}';
  function css() { if (document.getElementById('bgw-css')) return; var s = document.createElement('style'); s.id = 'bgw-css'; s.textContent = CSS; document.head.appendChild(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function close() { if (sheet) { sheet.remove(); sheet = null; } }
  function show(html, wire) {
    close(); css(); sheet = document.createElement('div'); sheet.className = 'bgw'; sheet.setAttribute('role', 'dialog');
    sheet.innerHTML = '<div class="bgw-c">' + html + '</div>'; document.body.appendChild(sheet);
    var q = function (s) { return sheet.querySelector(s); };
    sheet.querySelectorAll('[data-x]').forEach(function (b) { b.onclick = close; });
    if (wire) wire(q);
  }
  function tileHtml(t, i) {
    var icon = t.icon ? '<img class="bgw-i" alt="" src="' + esc(t.icon) + '" onerror="this.outerHTML=\'<div class=bgw-i style=background:' + esc(t.color) + '>' + esc(t.name.charAt(0)) + '</div>\'">'
      : '<div class="bgw-i" style="background:' + esc(t.color) + '">' + (t.type === 'video' ? '▶' : esc(t.name.charAt(0))) + '</div>';
    var btn = t.url ? '<button class="bgw-b" data-go="' + i + '">' + (t.type === 'video' ? 'WATCH' : 'PLAY') + '</button>' : '';
    return '<div class="bgw-t">' + icon + '<div class="bgw-n"><b>' + esc(t.name) + '</b><span>' + esc(t.pitch) + '</span>' + (t.age ? '<small>' + esc(t.age) + '</small>' : '') + '</div>' + btn + '</div>';
  }
  function open(url) {
    if (O.openUrl) { O.openUrl(url); return; }
    var w = null; try { w = root.open(url, '_blank'); } catch (e) {}
    if (!w && !O.native) location.href = url;
  }
  // a grown-up check before leaving the game (stores' kids rules); same style as the purchase gate
  function gate(then) {
    if (!O.parentalGate) { then(); return; }
    var a = 11 + Math.floor(Math.random() * 8), b = 3 + Math.floor(Math.random() * 6);
    show('<h2>GROWN-UPS ONLY</h2><p>This opens the app store. Type the answer:</p><p style="font-size:30px;font-weight:800">' + a + ' × ' + b + ' = ?</p><input inputmode="numeric" autocomplete="off" data-a aria-label="Answer"><p class="bgw-m" data-m></p><button class="bgw-b" data-ok>OPEN</button><button class="bgw-x" data-x>CANCEL</button>', function (q) {
      var inp = q('[data-a]'); setTimeout(function () { inp.focus(); }, 50);
      var go = function () { if (+inp.value.trim() !== a * b) { q('[data-m]').textContent = 'Not quite. Ask a grown-up.'; inp.value = ''; return; } close(); then(); };
      q('[data-ok]').onclick = go; inp.onkeydown = function (e) { if (e.key === 'Enter') go(); };
    });
  }
  function wireTiles(list) {
    return function (q) {
      sheet.querySelectorAll('[data-go]').forEach(function (b) {
        b.onclick = function () { var t = list[+b.getAttribute('data-go')]; if (t && t.url) gate(function () { open(t.url); }); };
      });
    };
  }

  // ---------- ads ----------
  function adsInit() {
    var plat = O.platform;
    ad.unit = O.native && O.admob ? adUnit(O.ads, O.game, plat) : null;
    if (!ad.unit) return;
    var A = O.admob, c = ad.unit.cfg;
    var p = A.initialize({
      initializeForTesting: !!ad.unit.isTest,
      tagForChildDirectedTreatment: !!c.childDirected,
      tagForUnderAgeOfConsent: !!c.underAgeOfConsent,
      maxAdContentRating: c.maxAdContentRating || 'General',
    }).then(function () {
      ad.inited = true;
      // Google User Messaging Platform (GDPR / EEA consent). Not shown when the user is tagged under age of consent.
      return A.requestConsentInfo({ tagForUnderAgeOfConsent: !!c.underAgeOfConsent }).then(function (info) {
        if (info && info.status === 'REQUIRED' && info.isConsentFormAvailable) return A.showConsentForm();
        return info;
      }).then(function (info) { if (info && info.canRequestAds === false) ad.canRequest = false; }).catch(function () {});
    }).then(function () {
      // App Tracking Transparency (iPhone). Only for games that track; child-directed games never ask.
      if (plat === 'ios' && c.requestTracking && !c.childDirected) {
        return A.trackingAuthorizationStatus().then(function (s) { if (s && s.status === 'notDetermined') return A.requestTrackingAuthorization(); }).catch(function () {});
      }
    }).then(preload).catch(function (e) { ad.err = String(e && (e.message || e)); });
    return p;
  }
  function preload() {
    if (!ad.unit || !ad.inited || ad.loading || ad.ready || !ad.canRequest) return Promise.resolve();
    ad.loading = true;
    var c = ad.unit.cfg;
    return O.admob.prepareRewardVideoAd({ adId: ad.unit.rewarded, isTesting: ad.unit.isTest, npa: !!(c.childDirected || !c.requestTracking) })
      .then(function () { ad.ready = true; }).catch(function (e) { ad.err = String(e && (e.message || e)); })
      .then(function () { ad.loading = false; });
  }
  var ads = {
    // true when a "watch a video" button makes sense right now (Full Game owners get the reward with no video)
    canOffer: function () { if (playing) return false; if (owned()) return true; return !!(ad.unit && ad.ready); },
    isFree: function () { return owned(); },
    status: function () { return { unit: ad.unit && { rewarded: ad.unit.rewarded, isTest: ad.unit.isTest }, ready: ad.ready, inited: ad.inited, err: ad.err }; },
    watch: function (reason) {
      if (playing) return Promise.resolve({ rewarded: false, free: false, why: 'playing' });
      if (owned()) return Promise.resolve({ rewarded: true, free: true });
      if (!ad.unit || !ad.ready) { preload(); return Promise.resolve({ rewarded: false, free: false, why: 'not_ready' }); }
      var A = O.admob, got = false, h = null;
      ad.ready = false;
      return Promise.resolve(A.addListener ? A.addListener('onRewardedVideoAdReward', function () { got = true; }) : null)
        .then(function (handle) { h = handle; return A.showRewardVideoAd(); })
        .then(function (item) { if (item && item.amount != null) got = true; })
        .catch(function (e) { ad.err = String(e && (e.message || e)); })
        .then(function () { if (h && h.remove) h.remove(); preload(); return { rewarded: got, free: false, reason: reason }; });
    },
  };

  var BG = {
    version: 1,
    init: function (opts) {
      O = Object.assign({ platform: 'web', native: false, kids: false, parentalGate: true, label: {} }, opts || {});
      if (O.platform !== 'android' && O.platform !== 'ios') O.platform = 'web';
      loadPromo();
      if (O.kids && O.ads && O.ads.games && O.ads.games[O.game] && O.ads.games[O.game].enabled) {
        // kids games never run ads, whatever the config says
        O.ads = JSON.parse(JSON.stringify(O.ads)); O.ads.games[O.game].enabled = false;
      }
      adsInit();
      return BG;
    },
    setPlaying: function (b) { playing = !!b; if (playing) close(); },
    tiles: function () { return tiles(promo, O.game, platformOf(), O.kids); },
    hasTiles: function () { return BG.tiles().length > 0; },
    openMore: function () {
      if (playing) return false;
      var list = BG.tiles();
      var body = list.length ? list.map(tileHtml).join('') : '<p>More BIRCO games are coming soon!</p>';
      show('<h2>MORE FROM BIRCO</h2>' + body + (O.kids ? '<p style="font-size:13px">Ask a grown-up to find these in the app store.</p>' : '') + '<button class="bgw-x" data-x>BACK</button>', wireTiles(list));
      return true;
    },
    // Full-screen promo: only on 'menu' or 'gameover', at most once per session, never for Full Game owners,
    // and not before the player has seen at least `after` result screens this session.
    maybePromo: function (where, after) {
      if (where === 'gameover') resultCount++;
      if (playing || promoShown || owned()) return false;
      if (where !== 'menu' && where !== 'gameover') return false;
      if (resultCount < (after == null ? 2 : after)) return false;
      var list = BG.tiles().filter(function (t) { return t.type !== 'video'; });
      if (!list.length) list = BG.tiles();
      if (!list.length) return false;
      var t = list[Math.floor(Math.random() * list.length)];
      promoShown = true;
      show('<h2>ALSO FROM BIRCO</h2>' + tileHtml(t, 0) + '<button class="bgw-x" data-x>NOT NOW</button>', wireTiles([t]));
      return true;
    },
    close: close,
    ads: ads,
    _t: { tiles: tiles, tag: tag, itemLink: itemLink, adUnit: adUnit, state: function () { return { playing: playing, promoShown: promoShown, resultCount: resultCount }; } },
  };
  root.BircoGrowth = BG;
  if (typeof module !== 'undefined' && module.exports) module.exports = BG;
})(typeof window !== 'undefined' ? window : globalThis);
