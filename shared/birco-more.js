/* BIRCO shared "More from BIRCO" screen and grown-up check. ONE copy for every BIRCO game.
 * Games load it from https://edgarbirlew-source.github.io/birco-arcade/shared/birco-more.js
 * (store apps bundle a copy at build time and still fetch the live list when online).
 * The list of games comes from birco-games.json next to this file: edit that one file to update every game.
 *
 *   BircoMore.init({
 *     game: 'smash-yard',            // this game's id in birco-games.json (its own tile is hidden)
 *     kids: true,                    // kids' game: kids-safe tiles only, and NO external links
 *     buttons: ['#menu .bar'],       // where to put a MORE FROM BIRCO button (menu and game-over only, never in play)
 *     buttonClass: 'go alt',         // the game's own button style; label: 'MORE GAMES' to change the button text
 *     isFullGame: () => false,       // Full Game owners never get a promo as an interruption
 *     autoPromo: false,              // allow one full-screen promo per session from promoAtGameOver()
 *   });
 *   BircoMore.open(); BircoMore.promoAtGameOver(); BircoMore.gate(onPass);
 */
(function () {
  'use strict';
  if (window.BircoMore) return;
  var HOME = 'https://edgarbirlew-source.github.io/birco-arcade/shared/';
  var me = (function () { try { return document.currentScript && document.currentScript.src; } catch (e) { return ''; } })();
  var opts = { game: '', kids: true, buttons: [], buttonClass: '', isFullGame: function () { return false; }, autoPromo: false };
  var cfg = null, ready = null, promoShown = false, btns = [];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function platform() {
    try { var p = window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform(); if (p === 'ios' || p === 'android') return p; } catch (e) {}
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'web';
  }
  // Tag every link so installs can be traced to the game that sent them.
  function tag(url, game) {
    if (!url) return '';
    var u; try { u = new URL(url); } catch (e) { return ''; }
    var src = game || 'birco';
    u.searchParams.set('utm_source', src); u.searchParams.set('utm_medium', 'crosspromo'); u.searchParams.set('utm_campaign', 'crosspromo');
    if (u.hostname === 'play.google.com') u.searchParams.set('referrer', 'utm_source=' + src + '&utm_medium=crosspromo&utm_campaign=crosspromo');
    if (/apps\.apple\.com$/.test(u.hostname)) u.searchParams.set('ct', 'crosspromo-' + src);
    return u.toString();
  }
  // Which store link this player should get. Only stores where the app is LIVE count.
  function storeLink(a, plat) {
    var live = a.live || {};
    var play = live.play && a.play ? a.play : '', ios = live.appStore && a.appStore ? a.appStore : '';
    if (plat === 'ios') return ios;
    if (plat === 'android') return play;
    return play || ios;
  }
  function tiles(c, o, plat) {
    c = c || cfg; o = o || opts; plat = plat || platform();
    if (!c || !c.apps) return [];
    var out = [];
    c.apps.forEach(function (a) {
      if (!a || a.id === o.game) return;                 // never promote the game you are in
      if (o.kids && !a.kidsSafe) return;                 // kids' games show kids-safe apps only
      var link = storeLink(a, plat);
      if (!link) return;                                 // only apps live in this player's store
      out.push({ id: a.id, name: a.name, pitch: a.pitch, icon: a.icon, rating: a.ageRating, link: o.kids ? '' : tag(link, o.game),
        storeName: plat === 'ios' ? 'the App Store' : 'Google Play' });
    });
    out = out.slice(0, 5);
    var r = c.recon;
    if (r && r.latestEpisodeUrl && (!o.kids || r.kidsSafe)) out.push({ id: 'recon', name: r.name, pitch: r.pitch, icon: r.icon, link: o.kids ? '' : tag(r.latestEpisodeUrl, o.game), video: true });
    return out.slice(0, 6);
  }
  function load() {
    if (ready) return ready;
    var base = me ? me.replace(/[^/]*$/, '') : HOME;
    var fallback = window.BIRCO_GAMES_FALLBACK || null;
    var urls = [HOME + 'birco-games.json'];
    if (base !== HOME) urls.push(base + 'birco-games.json');
    function tryAt(i) {
      if (i >= urls.length) return Promise.resolve(fallback);
      return fetch(urls[i] + '?v=' + Math.floor(Date.now() / 3600000), { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .catch(function () { return tryAt(i + 1); });
    }
    ready = tryAt(0).then(function (c) { cfg = c || fallback; paintButtons(); return cfg; });
    return ready;
  }

  var CSS = '.bm-ov{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:16px;background:rgba(14,10,36,.82);font:500 15px/1.35 system-ui,sans-serif;color:#fff}' +
    '.bm-ov[hidden]{display:none}.bm-box{width:min(100%,460px);max-height:100%;overflow:auto;padding:18px;border-radius:18px;border:4px solid #161233;background:linear-gradient(#3a2a9a,#241a63);box-shadow:0 0 0 3px #ffd23f}' +
    '.bm-box h2{margin:0 0 10px;font:900 24px/1.1 system-ui,sans-serif;letter-spacing:.04em;color:#ffd23f;text-align:center}' +
    '.bm-grid{display:grid;gap:10px}.bm-tile{display:grid;grid-template-columns:56px 1fr auto;gap:10px;align-items:center;padding:10px;border-radius:14px;background:rgba(255,255,255,.1)}' +
    '.bm-tile img,.bm-tile .bm-ph{width:56px;height:56px;border-radius:12px;object-fit:cover;background:#ff4f8b}.bm-tile b{display:block;font-size:16px}.bm-tile small{display:block;opacity:.85}' +
    '.bm-tile a,.bm-btn{display:inline-block;padding:9px 14px;border:3px solid #161233;border-radius:12px;background:#7ddc3c;color:#161233;font:900 15px system-ui,sans-serif;text-decoration:none;cursor:pointer}' +
    '.bm-ask{font-size:12px;opacity:.85;max-width:120px;text-align:right}.bm-row{display:flex;gap:10px;justify-content:center;margin-top:14px;flex-wrap:wrap}.bm-btn.alt{background:#36c5f4}' +
    '.bm-gate input{width:90px;padding:8px;border-radius:10px;border:3px solid #161233;font:900 20px system-ui;text-align:center}.bm-gate p{text-align:center}';
  var ov = null;
  function overlay() {
    if (ov) return ov;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    ov = document.createElement('div'); ov.className = 'bm-ov'; ov.hidden = true; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.body.appendChild(ov);
    return ov;
  }
  function close() { if (ov) { ov.hidden = true; ov.innerHTML = ''; } }
  function open() {
    return load().then(function () {
      var t = tiles(); var o = overlay();
      var rows = t.map(function (x) {
        var pic = x.icon ? '<img src="' + esc(x.icon) + '" alt="">' : '<span class="bm-ph"></span>';
        var act = x.link ? '<a href="' + esc(x.link) + '" target="_blank" rel="noopener">' + (x.video ? 'Watch' : 'Play') + '</a>'
          : '<span class="bm-ask">' + (x.video ? 'Ask a grown-up to watch it with you' : 'Ask a grown-up to find it in ' + esc(x.storeName)) + '</span>';
        return '<div class="bm-tile">' + pic + '<div><b>' + esc(x.name) + '</b><small>' + esc(x.pitch) + '</small></div>' + act + '</div>';
      }).join('');
      o.innerHTML = '<div class="bm-box"><h2>MORE FROM BIRCO</h2><div class="bm-grid">' + (rows || '<p>More games are coming soon!</p>') +
        '</div><div class="bm-row"><button type="button" class="bm-btn alt" data-bm-close>BACK</button></div></div>';
      o.querySelector('[data-bm-close]').addEventListener('click', close);
      o.hidden = false;
      return t;
    });
  }
  // At most one full-screen promo per session, only where the game asks for it (game-over), never for Full Game owners.
  function promoAtGameOver() {
    if (!opts.autoPromo || promoShown) return Promise.resolve(false);
    try { if (opts.isFullGame()) return Promise.resolve(false); } catch (e) {}
    try { if (sessionStorage.getItem('bm-promo')) return Promise.resolve(false); } catch (e) {}
    return load().then(function () {
      if (!tiles().length) return false;
      promoShown = true; try { sessionStorage.setItem('bm-promo', '1'); } catch (e) {}
      return open().then(function () { return true; });
    });
  }
  // Grown-up check before anything that spends money or leaves the game (Families / Kids rules).
  function gate(onPass, why) {
    var o = overlay();
    var a = 3 + Math.floor(Math.random() * 6), b = 4 + Math.floor(Math.random() * 6);
    o.innerHTML = '<div class="bm-box bm-gate"><h2>GROWN-UPS ONLY</h2><p>' + esc(why || 'Ask a grown-up to help.') + '</p><p>What is ' + a + ' × ' + b + '?</p>' +
      '<p><input inputmode="numeric" autocomplete="off" aria-label="Answer"></p><div class="bm-row"><button type="button" class="bm-btn" data-ok>OK</button><button type="button" class="bm-btn alt" data-no>CANCEL</button></div></div>';
    var inp = o.querySelector('input');
    o.querySelector('[data-no]').addEventListener('click', close);
    o.querySelector('[data-ok]').addEventListener('click', function () {
      if (parseInt(inp.value, 10) === a * b) { close(); onPass && onPass(); } else { inp.value = ''; inp.placeholder = 'Try again'; }
    });
    o.hidden = false; setTimeout(function () { inp.focus(); }, 30);
  }

  // Full Game sheet, the same in every game: what it unlocks, price, BUY (behind the grown-up check) and RESTORE.
  //   BircoMore.fullGame({ unlocks: 'Duo, Trio and Squad team battles', price: '$2.99', buy: async () => bool, restore: async () => bool, done: () => {},
  //                        title: 'FREE TRIAL OVER', lead: 'Your free fights are used up.' })
  function fullGame(f) {
    var o = overlay();
    // optional: title (e.g. 'FREE TRIAL OVER') and lead (one line above the unlock list), for games with a trial paywall
    o.innerHTML = '<div class="bm-box"><h2>' + esc(f.title || 'FULL GAME') + '</h2>' + (f.lead ? '<p style="text-align:center"><b>' + esc(f.lead) + '</b></p>' : '') +
      '<p style="text-align:center">Unlock ' + esc(f.unlocks) + '.</p>' +
      '<p style="text-align:center">One purchase. Removes all ads.</p><p class="bm-msg" style="text-align:center;min-height:1.3em"></p>' +
      '<div class="bm-row"><button type="button" class="bm-btn" data-buy>BUY ' + esc(f.price || '') + '</button>' +
      '<button type="button" class="bm-btn alt" data-restore>RESTORE PURCHASE</button><button type="button" class="bm-btn alt" data-no>NOT NOW</button></div></div>';
    var msg = o.querySelector('.bm-msg');
    function run(fn, okText) {
      msg.textContent = 'One moment...';
      Promise.resolve().then(fn).then(function (ok) {
        if (ok) { msg.textContent = okText; setTimeout(function () { close(); f.done && f.done(); }, 900); }
        else msg.textContent = fn === f.restore ? 'No Full Game purchase found on this account.' : 'Purchase not finished.';
      }, function () { msg.textContent = 'The store did not answer. Try again in a moment.'; });
    }
    o.querySelector('[data-no]').addEventListener('click', close);
    o.querySelector('[data-restore]').addEventListener('click', function () { run(f.restore, 'Full Game restored!'); });
    o.querySelector('[data-buy]').addEventListener('click', function () {
      gate(function () { fullGame(f); var m = ov.querySelector('.bm-msg'); msg = m; run(f.buy, 'Thanks! Full Game unlocked.'); }, 'Buying the Full Game needs a grown-up.');
    });
    o.hidden = false;
  }
  function paintButtons() {
    var n = tiles().length;
    btns.forEach(function (b) { b.hidden = n === 0; });
  }
  function init(o) {
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) opts[k] = o[k];
    (opts.buttons || []).forEach(function (sel) {
      var host = document.querySelector(sel); if (!host) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = (opts.buttonClass || '') + ' bm-more'; b.textContent = opts.label || 'MORE FROM BIRCO'; b.hidden = true;
      b.addEventListener('click', function () { open(); });
      host.appendChild(b); btns.push(b);
    });
    return load();
  }
  window.BircoMore = { init: init, open: open, close: close, promoAtGameOver: promoAtGameOver, gate: gate, fullGame: fullGame, tiles: function (c, o, p) { return tiles(c, o, p); }, tag: tag, platform: platform, load: load };
})();
