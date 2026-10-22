# BIRCO Arcade

Installable web game by BIRCO, Inc. Static site served by GitHub Pages.

When any file changes, bump `VERSION` in `sw.js` so installed copies update.

Live at https://edgarbirlew-source.github.io/birco-arcade/ (served from the `gh-pages` branch). To publish: `git push origin main main:gh-pages`.

Online VS: private rooms joined by a 4-letter code, up to 4 players. Phones connect directly over WebRTC using the free public PeerJS service (no account or server of our own). `lib/peerjs.min.js` is PeerJS 1.5.4 (MIT). For local testing, run a PeerJS server and open `index.html?peer=127.0.0.1:9000`.
