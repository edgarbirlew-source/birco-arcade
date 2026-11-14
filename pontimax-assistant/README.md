# PM Assistant IQ by PontiMax: store apps

`app/` wraps the live PM Assistant IQ web app (`pm-assistant-iq-production.up.railway.app`, later
`app.pontimaxassistant.com`) in Capacitor 8 for Google Play and the App Store. The app source lives in
`edgarbirlew-source/birco-project-tracker` under `pmiq/`; this folder only holds the phone shell.
It is a separate product from the games in this repo: no game files are copied into it.

- App ID / bundle ID: `com.birco.pmassistantiq`. Home-screen name: `PM Assistant IQ`. Store name: `PM Assistant IQ by PontiMax`.
- `capacitor.config.json` opens the live app (`server.url`). Sign-in pages for connected finance and project apps stay inside the app (`allowNavigation`); other links open in the phone's browser. `www/offline.html` shows when there is no connection.
- Safe areas: the web pages use `viewport-fit=cover` and `env(safe-area-inset-*)`; Capacitor's SystemBars (`insetsHandling: css`) keeps every page below the status bar and above the soft keys on Android, and `contentInset: never` does the same on iPhone.
- Icons: `assets/icon-only.png` (store icon 1024) and `assets/icon-foreground.png` (adaptive/maskable 1024), copied from `pmiq/brand/`. `npm run assets` makes every size.

Builds (GitHub Actions, on every push to `main` or a `claude/pmiq-*` branch that touches this folder):

- **PM Assistant IQ Android**: unsigned `.aab` plus a test APK on the `pmiq-android-builds` branch. Sign the bundle with the
  PM Assistant IQ upload key (PontiMax project files, `store-app/signing/`, never in git):
  `jarsigner -keystore pmiq-upload.jks -signedjar pm-assistant-iq.aab pm-assistant-iq-unsigned.aab pmiq-upload`
- **PM Assistant IQ iPhone**: registers the bundle ID through the App Store Connect API key secrets, and once the app record exists
  in App Store Connect, signs and uploads to TestFlight. The result is written to `pmiq-ios-status` (`STATUS.txt`).

When the app moves to `app.pontimaxassistant.com`, change `server.url` and the retry link in `www/offline.html`, bump `version`
in `package.json`, and push.
