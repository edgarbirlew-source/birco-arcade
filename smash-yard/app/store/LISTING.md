# Smash Yard: store listing kit

Publisher: BIRCO, Inc. Made by Cohen. App id (both stores): `com.birco.smashyard`. Version 1.0.0.
Privacy policy: https://smash-yard-production-b96422af.up.railway.app/privacy
Support: https://smash-yard-production-b96422af.up.railway.app/support

## Names and text

| Field | Text |
|---|---|
| App name (Play and Apple, 30 max) | Smash Yard: Backyard Brawl |
| Apple subtitle (30 max) | Brawl Friends and Bots |
| Name under the icon | Smash Yard |
| Category | Games > Action (Apple secondary: Games > Arcade) |
| Short description (Play, 80 max) | Brawl bots or a friend online. 10 free fights, then unlock the Full Game. |
| Apple keywords | brawler,arena,brawl,fighting,arcade,friends,multiplayer,battle,kids,action |

Full description:

> Smash Yard is a fast arcade brawler made by a young game maker.
>
> Pick a brawler, run the backyard arena and blast your rival. Fill your SUPER and let it rip!
>
> - Solo fights against bots at Chill, Fair or Brutal skill
> - Online 1v1 with a friend: one makes a room, the other types the 4-letter code
> - Win matches to earn coins, open crates and level up your brawlers
> - Lots of brawlers to unlock, rainbow skins and seasonal arenas
> - Solo, Duo, Trio and Squad battles
>
> Free trial: your first 10 fights are free in every mode. After that, one $3.99 Full Game purchase unlocks unlimited fights. Brawlers and coins you earn in the trial are kept.
>
> No ads. No chat. No accounts. Nothing about you is collected.

## Money (no ads, ever)

Free download with a 10-fight free trial in every mode (Solo, Duo, Trio, Squad, online 1v1); the number is `trialFights` in
shared/birco-games.json. After the trial, FIGHT, REMATCH and online rooms show "FREE TRIAL OVER" (BUY $3.99, RESTORE PURCHASE,
NOT NOW). The Full Game unlocks unlimited fights. Brawlers and coins are kept. Coins and crates are earned by playing only; they are never sold for real money. The buy button sits behind a
grown-up check, and Restore Purchase is on the same screen.

| Field | Value |
|---|---|
| Product id | `smashyard_full_game` (must match exactly) |
| Type | Play: one-time product, non-consumable. Apple: Non-Consumable |
| Name | Full Game |
| Description | Unlock unlimited fights in every mode. |
| Price | $3.99 USD |

Ads decision (kids' game, standard item 13): NO ads and no AdMob SDK. One-time Full Game purchase only. Cross-promo tiles are
kids-safe and have no external links.

## Art (this folder)

| Store slot | File |
|---|---|
| Play app icon 512 | `play-icon-512.png` |
| Play feature graphic 1024x500 | `play-feature-graphic-1024x500.png` |
| Play phone screenshots 1080x1920 | `play/1-menu.png` ... `play/4-online.png` |
| Apple 6.7" screenshots 1290x2796 | `appstore/1-menu.png` ... `appstore/4-online.png` |
| Apple app icon 1024 | built into the iPhone app from `../assets/icon-only.png` |

## Kids, privacy and content answers (true for the store apps, v1.0.0)

- No accounts, no sign-in, no chat, no ads, no analytics, no tracking, no ad ID. (Accounts and friends exist only on the web version.)
- Progress, coins and the purchase flag are saved on the phone only.
- Online 1v1 sends moves through BIRCO's game server for the match only; nothing is stored after the room closes.
- Purchases are handled by Apple and Google.

| Question | Answer |
|---|---|
| Play: target age groups | 9-12 and 13-15 (Families policy: met, no ads, no data) |
| Play: contains ads | No |
| Play: app access | All functionality available without special access |
| Play: data safety | No data collected. No data shared. (Encrypted in transit: yes) |
| Play: content rating (IARC) | Category Game. Violence: cartoon/fantasy violence, no blood. Users interact: no (no chat; online is gameplay only with a friend who has the code). Shares location: no. Digital purchases: yes. Random items bought with real money: no. Expect Everyone 10+ / PEGI 7. |
| Play: government / news / health / financial | No |
| Apple: age rating | 9+ (Infrequent/Mild Cartoon or Fantasy Violence). Unrestricted web access: No. Gambling: No. Loot boxes: No (crates use earned coins only). |
| Apple: Kids Category | Do not opt in |
| Apple: App Privacy | Data Not Collected |
| Apple: export compliance | Uses only standard encryption (exempt); `ITSAppUsesNonExemptEncryption = false` is set by the build |
