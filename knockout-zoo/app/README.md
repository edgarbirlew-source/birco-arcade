# Knockout Zoo store apps (Android + iOS)

Capacitor wraps the same game as the web version (`../index.html`, `../assets/`). The app build bundles
the fonts and `room.js`, so everything but online versus works offline; online versus talks to the
Railway server (`wss://knockout-zoo-production.up.railway.app/ws`). Fights 6 to 17 are sold as one
in-app purchase (`src/native.js`, product id `knockoutzoo_full_game`). The web version is unchanged: the
lock only turns on inside the app.

    npm ci
    npm run sync                 # build www/ and copy it into android/ and ios/
    NODE_PATH=$(npm root -g) node store-art.mjs   # icon, splash, Play feature graphic -> assets/, store/
    npx capacitor-assets generate --iconBackgroundColor '#0c0a14' --splashBackgroundColor '#0c0a14' --splashBackgroundColorDark '#0c0a14'

Android: push the commit to the `koz-android-build` branch. GitHub Actions builds the unsigned `.aab` and puts it
on the `koz-builds` branch. Sign it with the Play upload key (project files, `knockout-zoo/signing/`,
never in git):

    jarsigner -keystore koz-upload.jks -signedjar knockout-zoo.aab knockout-zoo-unsigned.aab koz-upload

Bump `versionCode` in `android/app/build.gradle` for every upload.

iOS: push the commit to the `koz-ios-build` branch. GitHub Actions builds on a Mac and uploads to TestFlight
(needs the App Store Connect API key secrets on this repo).

Store text, product setup, and kids/privacy answers: `store/LISTING.md`.
