# BIRCO Arcade

Installable web game by BIRCO, Inc. Static site served by GitHub Pages.

When any file changes, bump `VERSION` in `sw.js` so installed copies update.

Live at https://edgarbirlew-source.github.io/birco-arcade/ (served from the `gh-pages` branch). To publish: `git push origin main main:gh-pages`.

Online VS: private rooms joined by a 4-letter code, up to 4 players. Phones connect directly over WebRTC using the free public PeerJS service (no account or server of our own). `lib/peerjs.min.js` is PeerJS 1.5.4 (MIT). For local testing, run a PeerJS server and open `index.html?peer=127.0.0.1:9000`.

## Phone apps (Google Play and App Store)

`app/` wraps the game in Capacitor 8 (app ID `com.birco.arcade.drive`; the store name comes from `appName` in `app/capacitor.config.json`). GitHub Actions builds both apps on every push that touches the game:

- **Android app** workflow: an unsigned Play bundle plus a test APK, pushed to the `app-builds` branch. The Play bundle is signed with BIRCO's upload key, which is kept outside this public repo.
- **iPhone app** workflow: checks the app compiles. Once the repo has the `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` and `APPLE_TEAM_ID` secrets, it signs and uploads to TestFlight.

## Shared across every BIRCO game

`shared/birco-games.json` is the ONE list of BIRCO games and the latest Recon the Raccoon episode (store links, age rating,
kids-safe flag, and which stores each app is live in). `shared/birco-more.js` is the one module every game loads for the
"More from BIRCO" screen, the grown-up check and the Full Game sheet. Games load both from GitHub Pages
(`https://edgarbirlew-source.github.io/birco-arcade/shared/`), so editing the JSON and publishing updates every game; store
apps bundle a copy for offline use. Rules built in: this game's own tile hidden, only apps live in the player's store,
kids' games show kids-safe apps with no external links, links tagged `utm_source=<game>&utm_campaign=crosspromo`,
at most one full-screen promo per session and never for Full Game owners.

## Smash Yard

Cohen's game lives in `edgarbirlew-source/smash-yard` (Railway deploys its `main` to
https://smash-yard-production-b96422af.up.railway.app). This repo holds only the store apps, `smash-yard/app/`:
`build-native.mjs` downloads the game page and `birco.js` from that server, points online play at it, turns off
accounts/friends inside the app (no personal data: kids' game) and adds the Full Game purchase
(`smashyard_full_game`, one-time, non-consumable, unlocks Duo/Trio/Squad in the app only). No ads.
Workflows: "Smash Yard Android" (unsigned .aab + test APK to `sy-android-builds`; sign with the upload key in the Smash Yard
project files, `signing/`) and "Smash Yard iPhone" (TestFlight once the App Store Connect record exists; result in
`sy-ios-status`). Run them again (Actions > Run workflow) after a game change you want in the apps.
Store text, art and kids/privacy answers: `smash-yard/app/store/`.
