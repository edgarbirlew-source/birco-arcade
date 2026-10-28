# Knockout Zoo (web)

Humans-vs-beasts boxing game. Same game file as the Claude artifact version (https://claude.ai/artifact/Ar2sX5f45GrpYst3c8ea5g).

- `index.html` + `assets/`: the game.
- `server.ts`: Railway Function source (Railway project `knockout-zoo`). Serves the game from this branch and runs the online rooms over WebSocket. `/room.js` gives the game the same `room` API it uses inside Claude.

To update the live game: push `index.html` (or assets) to branch `knockout-zoo`; the server re-reads the page within a minute. Changes to `server.ts` must also be pasted into the Railway Function.
