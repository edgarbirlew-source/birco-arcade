// Smash Yard hook-up for BIRCO's shared modules (shared/birco-more.js). Loaded after the game on the web and in the store apps.
// Kids' game: kids-safe tiles only, no external links, no ads, no auto promo.
// In the store apps (window.SYN from app/src/native.js) Duo, Trio and Squad are part of the one-time Full Game purchase.
(function () {
  'use strict';
  var SYN = window.SYN || null;
  var full = !SYN;                      // the web version stays fully free
  function owned() { return full; }
  function start() {
    if (window.BircoMore) window.BircoMore.init({ game: 'smash-yard', kids: true, buttons: ['#menu .bar', '#end .btns'], buttonClass: 'go alt', label: 'MORE GAMES', isFullGame: owned, autoPromo: false });
    if (!SYN) return;
    var locked = [].slice.call(document.querySelectorAll('.seg button[data-team]')).filter(function (b) { return b.dataset.team !== '1'; });
    function paint() { locked.forEach(function (b) { b.classList.toggle('sy-lock', !full); }); }
    var st = document.createElement('style');
    st.textContent = '.seg button.sy-lock::after{content:" \\1F512";font-size:.8em}';
    document.head.appendChild(st);
    var price = '';
    function unlock() { full = true; paint(); }
    function sheet() {
      window.BircoMore.fullGame({
        unlocks: 'Duo, Trio and Squad team battles', price: price,
        buy: function () { return SYN.buy().then(function (ok) { if (ok) unlock(); return ok; }); },
        restore: function () { return SYN.restore().then(function (ok) { if (ok) unlock(); return ok; }); },
      });
    }
    locked.forEach(function (b) {
      b.addEventListener('click', function (e) { if (full) return; e.preventDefault(); e.stopImmediatePropagation(); sheet(); }, true);
    });
    paint();
    SYN.owned().then(function (ok) { if (ok) unlock(); }, function () {});
    SYN.price().then(function (p) { if (p) price = p; }, function () {});
    window.SYFull = { owned: owned, sheet: sheet };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
