Smash Yard (made by Cohen). Node server + game page. Railway: root directory smash-yard, start = npm start.
Variables: DATA_DIR=/data with a Volume mounted at /data (keeps accounts across deploys).

server.js serves the game and adds two scripts to the page: BIRCO's shared module (shared/birco-more.js from
GitHub Pages: "More from BIRCO" list and the grown-up check) and birco.js (Smash Yard hook-up). /privacy and /support
are the store pages. index.html is Cohen's file, unchanged.

app/ = Android and iPhone apps (Capacitor). build-native.mjs copies the game, points online play at the Railway
server, and turns off accounts/friends inside the app (no personal data: kids' game). The Full Game purchase
(product id smashyard_full_game, one-time, non-consumable) unlocks Duo, Trio and Squad in the app only.
No ads. GitHub Actions: "Smash Yard Android" (unsigned .aab to sy-android-builds) and "Smash Yard iPhone"
(TestFlight once the App Store Connect app record exists; result in sy-ios-status).
Store text and answers: app/store/LISTING.md.
