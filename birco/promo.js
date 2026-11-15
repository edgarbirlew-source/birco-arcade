/* BIRCO cross-promotion: the "More from BIRCO" screen shared by every BIRCO game.
 *
 * Use (see birco/README.md):
 *   <script src="birco/promo.js"></script>
 *   BircoPromo.init({ game: 'arcade-drive', accent: '#ffb02e', font: 'inherit' });
 *   BircoPromo.open();                      // from a menu or game-over button
 *   BircoPromo.maybeInterstitial();         // on a game-over screen; shows at most once per session
 *   BircoPromo.setSuppressed(() => owned);  // Full Game owners get no full-screen promo
 *
 * Content comes from ONE file, promo.json. The copy next to this script is the offline fallback;
 * the live copy on GitHub Pages wins when it loads, so editing it there updates every game.
 * Rules built in: only apps live in the visitor's store, never this game's own tile, Play links on
 * Android and App Store links on iPhone, utm tags on every link, kids mode shows kids-safe tiles
 * with no outside links, and nothing here ever runs during play (the game decides when to call it).
 */
(function () {
  'use strict';
  var LIVE = 'https://edgarbirlew-source.github.io/birco-arcade/birco/promo.json';
  var KEY = 'birco-promo-cfg', SKEY = 'birco-promo-shown';
  var here = (document.currentScript && document.currentScript.src) || location.href;
  var base = here.replace(/[^/]*$/, '');
  var opt = { game: '', kids: false, accent: '#ffb02e', font: 'inherit', max: 6 };
  var cfg = null, cfgBase = base, suppressed = function () { return false; }, sessionShown = false, el = null;

  function platform() {
    var C = window.Capacitor;
    if (C && C.getPlatform && C.getPlatform() !== 'web') return C.getPlatform();
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'web';
  }
  function native() { var C = window.Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform()); }

  function load() {
    try { var c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && c.apps) { cfg = c; cfgBase = LIVE.replace(/[^/]*$/, ''); } } catch (e) {}
    var local = fetch(base + 'promo.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
      .then(function (c) { if (!cfg && c && c.apps) { cfg = c; cfgBase = base; } }).catch(function () {});
    var live = fetch(LIVE, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (c) { if (c && c.apps) { cfg = c; cfgBase = LIVE.replace(/[^/]*$/, ''); try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} } })
      .catch(function () {});
    return Promise.all([local, live]);
  }

  function tag(url) {
    var src = encodeURIComponent(opt.game || 'birco'), q = 'utm_source=' + src + '&utm_medium=app&utm_campaign=crosspromo';
    var u = url + (url.indexOf('?') < 0 ? '?' : '&') + q;
    if (/play\.google\.com/.test(url)) u += '&referrer=' + encodeURIComponent(q);
    if (/apps\.apple\.com/.test(url)) u += '&ct=' + src + '-crosspromo&mt=8';
    return u;
  }

  // Tiles for this visitor: Recon first, then live apps for their store, never this game itself.
  function tiles() {
    if (!cfg) return [];
    var p = platform(), out = [];
    var r = cfg.recon;
    if (r && r.latest && (!opt.kids || r.kidsSafe)) out.push({ id: r.id, name: r.name, pitch: r.pitch, icon: r.icon, url: r.latest, cta: 'WATCH' });
    (cfg.apps || []).forEach(function (a) {
      if (a.id === opt.game || (opt.kids && !a.kidsSafe)) return;
      var url = p === 'ios' ? (a.appStoreLive && a.appStore) : (a.playLive && a.play);
      if (url) out.push({ id: a.id, name: a.name, pitch: a.pitch, icon: a.icon, url: url, cta: 'PLAY' });
    });
    return out.slice(0, Math.max(1, opt.max));
  }

  function css() {
    if (document.getElementById('bp-css')) return;
    var s = document.createElement('style'); s.id = 'bp-css';
    s.textContent =
      '.bp-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(10,8,6,.86);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;-webkit-tap-highlight-color:transparent}' +
      '.bp-card{width:100%;max-width:420px;max-height:100%;overflow:auto;background:#1d1713;color:#f7efe2;border:1px solid #4a3c30;border-radius:16px;padding:18px 16px 14px;box-sizing:border-box;font-family:var(--bp-font);box-shadow:0 10px 40px rgba(0,0,0,.5)}' +
      '.bp-card h2{margin:0 0 4px;font-size:22px;letter-spacing:.04em;color:var(--bp-accent);text-align:center}' +
      '.bp-sub{margin:0 0 12px;font-size:13px;color:#b9a994;text-align:center}' +
      '.bp-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}' +
      '.bp-t{display:flex;align-items:center;gap:10px;background:#140f0c;border:1px solid #3a2f26;border-radius:12px;padding:8px}' +
      '.bp-t img,.bp-t .bp-ph{width:52px;height:52px;border-radius:12px;flex:none;object-fit:cover;background:#2b221b}' +
      '.bp-t div{flex:1;min-width:0}.bp-t b{display:block;font-size:15px}.bp-t small{display:block;font-size:12px;color:#b9a994;line-height:1.3}' +
      '.bp-t a,.bp-t span.bp-k{flex:none;font:700 13px var(--bp-font);background:var(--bp-accent);color:#140f0c;border-radius:9px;padding:9px 12px;text-decoration:none}' +
      '.bp-t span.bp-k{background:none;color:#b9a994;font-weight:500;font-size:11px;padding:0;max-width:90px;text-align:right}' +
      '.bp-x{display:block;width:100%;margin:12px 0 0;font:700 15px var(--bp-font);background:none;color:#f7efe2;border:1px solid #4a3c30;border-radius:10px;padding:11px;cursor:pointer}' +
      '.bp-none{font-size:14px;color:#b9a994;text-align:center;margin:8px 0}';
    document.head.appendChild(s);
  }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function go(url) {
    // Inside the store app the link leaves the app (Play Store / App Store / YouTube app); on the web it opens a new tab.
    if (native()) location.href = url; else window.open(url, '_blank', 'noopener');
  }

  function show(title, sub) {
    close(); css();
    var list = tiles();
    el = document.createElement('div'); el.className = 'bp-ov'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', title);
    el.style.setProperty('--bp-accent', opt.accent); el.style.setProperty('--bp-font', opt.font === 'inherit' ? 'inherit' : opt.font);
    el.style.fontFamily = opt.font;
    el.innerHTML = '<div class="bp-card"><h2>' + esc(title) + '</h2><p class="bp-sub">' + esc(sub) + '</p>' +
      (list.length ? '<ul class="bp-list">' + list.map(function (t, i) {
        var img = t.icon ? '<img alt="" src="' + esc(cfgBase + t.icon) + '" onerror="this.style.visibility=\'hidden\'">' : '<i class="bp-ph"></i>';
        var act = opt.kids ? '<span class="bp-k">Ask a grown-up to find it</span>' : '<a href="' + esc(tag(t.url)) + '" data-i="' + i + '" rel="noopener" target="_blank">' + t.cta + '</a>';
        return '<li class="bp-t">' + img + '<div><b>' + esc(t.name) + '</b><small>' + esc(t.pitch) + '</small></div>' + act + '</li>';
      }).join('') + '</ul>' : '<p class="bp-none">More BIRCO games are on the way.</p>') +
      '<button class="bp-x" type="button">BACK TO GAME</button></div>';
    el.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[data-i]');
      if (a) { e.preventDefault(); go(a.getAttribute('href')); return; }
      if (e.target === el || (e.target.closest && e.target.closest('.bp-x'))) close();
    });
    document.body.appendChild(el);
    var b = el.querySelector('.bp-x'); if (b) b.focus({ preventScroll: true });
    return list.length > 0;
  }
  function close() { if (el) { el.remove(); el = null; } }

  var ready = null;
  window.BircoPromo = {
    init: function (o) { for (var k in o) opt[k] = o[k]; ready = ready || load(); return ready; },
    ready: function () { return ready || (ready = load()); },
    tiles: tiles,
    link: tag,
    open: function () { var self = this; return this.ready().then(function () { return show('MORE FROM BIRCO', 'Free to try. Tap one to get it.'); }); },
    // At most one full-screen promo per session, never for Full Game owners, never with nothing to show.
    maybeInterstitial: function () {
      var self = this;
      if (sessionShown || suppressed()) return Promise.resolve(false);
      try { if (sessionStorage.getItem(SKEY)) return Promise.resolve(false); } catch (e) {}
      return this.ready().then(function () {
        if (sessionShown || suppressed() || !tiles().length) return false;
        sessionShown = true; try { sessionStorage.setItem(SKEY, '1'); } catch (e) {}
        return show('MORE FROM BIRCO', 'Like this game? Try these next.');
      });
    },
    setSuppressed: function (fn) { suppressed = typeof fn === 'function' ? fn : function () { return !!fn; }; },
    close: close,
    isOpen: function () { return !!el; }
  };
})();
