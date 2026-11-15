# BIRCO shared growth module (all BIRCO games)

One copy, used by every BIRCO game (Cash Diamond, Knockout Zoo, Sword of the Spirit, Search and Destroy, Smash Yard, future games).
This branch (`birco-shared` in edgarbirlew-source/birco-arcade) is the source of truth.

| File | What it is |
|---|---|
| `promo.json` | Cross-promo catalog: every BIRCO game + the latest Recon the Raccoon episode, with Play / App Store links, `live` flags, age rating, `kidsSafe`. Edit here and every game updates on its next launch (games cache it for offline). |
| `ads.json` | AdMob IDs for every game (rewarded only) + Google's test IDs + SKAdNetwork IDs. Swap test IDs for real ones here: `appId` + `rewarded` per platform, then `test:false`. |
| `birco-growth.js` | The module (`window.BircoGrowth`): "More from BIRCO" sheet, one promo pop-up per session on menu / game-over only, rewarded ads (AdMob through `@capacitor-community/admob`), Full Game owners get no ads and no pop-ups. |
| `birco-native-patch.mjs` | Build step: writes the AdMob App ID, SKAdNetwork IDs, tracking text into iOS Info.plist and Android manifest from `ads.json`; removes AD_ID for child-directed games. |
| `test/run.mjs` | `node test/run.mjs` unit tests. |

## Adopting it in a game (Capacitor)
1. `npm i --save-exact @capacitor-community/admob@8.3.0` (only if the game has ads; kids games don't).
2. Build script: download `birco-growth.js`, `promo.json`, `ads.json`, `birco-native-patch.mjs` from
   `https://raw.githubusercontent.com/edgarbirlew-source/birco-arcade/birco-shared/`, run
   `node birco-native-patch.mjs <game-id> .`, copy `birco-growth.js` into www/ and write
   `window.BIRCO_SHARED={promo,ads}` into a small script (see knockout-zoo/app/build-native.mjs).
   Store apps bundle the module (no remote code); web builds can load
   `https://cdn.jsdelivr.net/gh/edgarbirlew-source/birco-arcade@birco-shared/birco-growth.js`.
3. In the game: `BircoGrowth.init({game, platform, native, kids, isFullGame, admob, promo, ads})`,
   `setPlaying(true/false)` around every level, a "MORE FROM BIRCO" button on menu + game-over calling `openMore()`,
   `maybePromo('gameover')` on the result screen, and rewarded buttons using `ads.canOffer()` / `ads.watch(reason)`.

## Rules it enforces
- Promos and ads only on menu and game-over screens, never while playing. One full-screen promo per session.
- Rewarded ads only (player taps). No interstitial ads, no banners.
- Only tiles live in the store for the player's platform; never the game's own tile. Play link on Android, App Store on iPhone.
- Links tagged `utm_source=<game>&utm_medium=app&utm_campaign=crosspromo` (+ Play `referrer`, + App Store `ct`).
- Kids games (`kids:true`): kidsSafe tiles only, no external links, ads forced off.
- Full Game owners: no ads (rewards are free), no promo pop-ups. "More from BIRCO" stays available when they tap it.
- Store links sit behind a grown-up check (`parentalGate`, default on).

## Kids policy (Google Play Families + Apple Kids)
- Under-13 games (Sword of the Spirit, Smash Yard): NO ads, Full Game purchase only.
- Mixed audience games marketed to kids (Knockout Zoo): `childDirected:true`, `underAgeOfConsent:true`, `maxAdContentRating:General`,
  no tracking (no ATT prompt, no Advertising ID), non-personalized ads.
