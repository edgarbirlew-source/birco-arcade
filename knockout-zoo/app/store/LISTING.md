# Knockout Zoo: store listing kit

Publisher: BIRCO, Inc. App id (both stores): `com.birco.knockoutzoo`. Version 1.0.0.
The full listing copy lives in Drive (Games/Knockout Zoo, "02" listing doc); this page is the build-side checklist.

## Names

| Field | Text |
|---|---|
| App name (Play, 30 max) | Knockout Zoo: Arcade Boxing |
| App name (Apple, 30 max) | Knockout Zoo: Arcade Boxing |
| Apple subtitle (30 max) | Animal Fighters, Wild Arenas |
| Name under the icon | Knockout Zoo |
| Category | Games > Action (Apple secondary: Games > Arcade) |

## Money (no ads, ever)

Fights 1 to 5 and online fights with a friend are free. One purchase, the Full Game, unlocks fights 6 to 17.
No ads, no subscription, no coins for sale. The buy button sits behind a grown-up check, and Restore purchase is on the same screen.

| Field | Value |
|---|---|
| Product id | `knockoutzoo_full_game` (must match exactly) |
| Type | Play: one-time product, non-consumable. Apple: Non-Consumable |
| Name | Full Game |
| Description | Unlock fights 6 to 17 and every arena. |
| Price | $3.99 USD (waiting on Edgar's OK) |

## Art (in `app/store/`, made by `store-art.mjs`)

| Store slot | File |
|---|---|
| Play app icon 512 | `play-icon-512.png` |
| Play feature graphic 1024x500 | `play-feature-graphic-1024x500.png` |
| Apple app icon 1024 | inside the iOS project (`app-store-icon-1024.png` is a copy) |
| Screenshots | after the fighter art fixes are signed off |

## Kids, privacy and content answers

What the app does with data (true for v1.0.0):
- No accounts, no ads, no analytics, no tracking, no ad ID, no chat.
- Progress and the purchase flag are saved on the phone only.
- Online versus sends fighter picks and moves through BIRCO's game server for the match only, joined by a 4-letter code. Nothing is stored after the room closes.
- Purchases are handled by Apple and Google. BIRCO never sees card details.

| Question | Answer |
|---|---|
| Apple age rating | 9+ (Infrequent/Mild Cartoon or Fantasy Violence). No gambling, no user content. |
| Apple Kids Category | Don't opt in. |
| Apple privacy label | Data Not Collected |
| Play target age groups | 9-12 and 13-15 (Families policy; already met: no ads, no data) |
| Play content rating (IARC) | Expect Everyone 10+ / PEGI 7 (cartoon boxing, no blood). Has in-app purchase, online play with friends by code, no chat. |
| Play data safety | No data collected or shared. Encrypted in transit: yes. |
| Play "contains ads" | No |
| Privacy policy URL | https://knockout-zoo-production.up.railway.app/privacy (goes live with the privacy step) |
| Support URL | https://knockout-zoo-production.up.railway.app/support |
