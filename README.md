# BIRCO Arcade

Installable web game by BIRCO, Inc. Static site served by GitHub Pages.

When any file changes, bump `VERSION` in `sw.js` so installed copies update.

Live at https://edgarbirlew-source.github.io/birco-arcade/ (served from the `gh-pages` branch). To publish: `git push origin main main:gh-pages`.

Online VS: private rooms joined by a 4-letter code, up to 4 players. Phones connect directly over WebRTC using the free public PeerJS service (no account or server of our own). `lib/peerjs.min.js` is PeerJS 1.5.4 (MIT). For local testing, run a PeerJS server and open `index.html?peer=127.0.0.1:9000`.

## Phone apps (Google Play and App Store)

`app/` wraps the game in Capacitor 8 (app ID `com.birco.arcade.drive`; the store name comes from `appName` in `app/capacitor.config.json`). GitHub Actions builds both apps on every push that touches the game:

- **Android app** workflow: an unsigned Play bundle plus a test APK, pushed to the `app-builds` branch. The Play bundle is signed with BIRCO's upload key, which is kept outside this public repo.
- **iPhone app** workflow: checks the app compiles. Once the repo has the `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` and `APPLE_TEAM_ID` secrets, it signs and uploads to TestFlight.
