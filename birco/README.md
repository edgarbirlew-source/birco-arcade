# BIRCO shared monetization and growth modules

Used by every BIRCO game (Game Monetization and Growth Standard, 2026-11-15). Fix things here, not in a copy.

## 1. Cross-promotion: `promo.js` + `promo.json`

- `promo.json` is the ONE list of BIRCO games and the latest Recon the Raccoon episode. Every game reads the live copy at
  `https://edgarbirlew-source.github.io/birco-arcade/birco/promo.json`, so editing it here (and publishing gh-pages) updates all games.
- When a game goes live in a store, set `playLive` / `appStoreLive` to `true` and fill `play` / `appStore`. New Recon episode: change `recon.latest` and `recon.pitch`.
- In a game:
  ```html
  <script src="https://edgarbirlew-source.github.io/birco-arcade/birco/promo.js"></script>  <!-- or a bundled copy for offline apps -->
  <script>
    BircoPromo.init({ game: 'knockout-zoo' });            // your id from promo.json (hides your own tile)
    BircoPromo.setSuppressed(() => ownsFullGame());        // Full Game owners: no full-screen promo
    moreButton.onclick = () => BircoPromo.open();          // menu and game-over screens only
    onGameOver(() => BircoPromo.maybeInterstitial());     // at most once per session, never during play
  </script>
  ```
- Kids games (under 13): `BircoPromo.init({ game, kids: true })` shows only `kidsSafe` tiles and no outside links.
- Links get `utm_source=<game>&utm_campaign=crosspromo` (plus the Play install `referrer` and the App Store `ct` token).

## 2. Store apps: `native/monetize.js`

Capacitor bridge, bundled with esbuild into each app (`import { installBircoStore } from '…/birco/native/monetize.js'`).
Needs `@capgo/native-purchases` and `@capacitor-community/admob` in the app. Gives the game `window.BircoStore`:

- `full.price() / buy() / owned() / restore()` for the one non-consumable Full Game product.
- `ads.start()` (Google consent form where required, then Apple's tracking prompt, then AdMob), `ads.available()`, `ads.show()` -> `true` only when the reward was earned. Rewarded ads only. No banners, no interstitials.
- `ads.privacyRequired() / privacyOptions()` for the "Privacy choices" button Google requires in the EEA/UK.

Keep every ID in the app's `monetization.json` (see `app/monetization.json`): Google's test IDs until AdMob gives real ones.
`app/native-config.mjs` writes the AdMob app ID into AndroidManifest/Info.plist, plus `NSUserTrackingUsageDescription` and Google's SKAdNetwork IDs (`app/skadnetwork.txt`).
