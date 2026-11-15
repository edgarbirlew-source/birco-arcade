// BIRCO shared build step for every Capacitor game: put the AdMob App ID and ad privacy settings into the
// native projects from ads.json (the one config file). Safe to run on every build (idempotent).
//
//   node birco-native-patch.mjs <game-id> <capacitor-app-dir> [ads.json path]
//
// Android: AdMob APPLICATION_ID meta-data; removes the AD_ID permission for games that don't track
//          (child-directed games), so Play's "Advertising ID: No" stays true.
// iOS:     GADApplicationIdentifier, Google's SKAdNetwork IDs, NSUserTrackingUsageDescription.
// A game with ads disabled gets everything removed again.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function adIds(ads, game, platform) {
  const g = ads.games?.[game];
  if (!g?.enabled) return null;
  const real = g[platform] || {};
  const test = g.test || !real.appId || !real.rewarded;
  return { appId: test ? ads.testIds[platform].appId : real.appId, test, cfg: g };
}

export function patchManifest(xml, ids) {
  const META = /\s*<meta-data android:name="com\.google\.android\.gms\.ads\.APPLICATION_ID"[^>]*\/>/g;
  const ADID = /\s*<uses-permission android:name="com\.google\.android\.gms\.permission\.AD_ID"[^>]*\/>/g;
  xml = xml.replace(META, '').replace(ADID, '');
  if (!ids) return xml;
  if (!/xmlns:tools=/.test(xml)) xml = xml.replace('<manifest xmlns:android="http://schemas.android.com/apk/res/android"', '<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools"');
  xml = xml.replace(/(<application[^>]*>)/, `$1\n        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="${ids.appId}"/>`);
  if (!ids.cfg.requestTracking || ids.cfg.childDirected)
    xml = xml.replace('</manifest>', '    <uses-permission android:name="com.google.android.gms.permission.AD_ID" tools:node="remove"/>\n</manifest>');
  return xml;
}

function plistKey(xml, key) {
  // remove <key>K</key> and its value (string or array)
  const re = new RegExp(`\\s*<key>${key}</key>\\s*(<string>[^<]*</string>|<array>[\\s\\S]*?</array>)`, 'g');
  return xml.replace(re, '');
}
export function patchPlist(xml, ids, ads) {
  for (const k of ['GADApplicationIdentifier', 'SKAdNetworkItems', 'NSUserTrackingUsageDescription']) xml = plistKey(xml, k);
  if (!ids) return xml;
  const sk = ads.skAdNetworkIds.map(s => `\n\t\t<dict>\n\t\t\t<key>SKAdNetworkIdentifier</key>\n\t\t\t<string>${s}</string>\n\t\t</dict>`).join('');
  const add = `\n\t<key>GADApplicationIdentifier</key>\n\t<string>${ids.appId}</string>`
    + `\n\t<key>SKAdNetworkItems</key>\n\t<array>${sk}\n\t</array>`
    + `\n\t<key>NSUserTrackingUsageDescription</key>\n\t<string>${ads.trackingUsageDescription}</string>`;
  const i = xml.lastIndexOf('</dict>');
  return xml.slice(0, i).replace(/\s*$/, '') + add + '\n' + xml.slice(i);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [game, appDir, adsPath] = process.argv.slice(2);
  if (!game || !appDir) { console.error('usage: node birco-native-patch.mjs <game> <appDir> [ads.json]'); process.exit(2); }
  const ads = JSON.parse(readFileSync(adsPath || join(dirname(fileURLToPath(import.meta.url)), 'ads.json'), 'utf8'));
  const man = join(appDir, 'android/app/src/main/AndroidManifest.xml');
  const pl = join(appDir, 'ios/App/App/Info.plist');
  if (existsSync(man)) { const ids = adIds(ads, game, 'android'); writeFileSync(man, patchManifest(readFileSync(man, 'utf8'), ids)); console.log('android', ids ? ids.appId + (ids.test ? ' (TEST)' : '') : 'no ads'); }
  if (existsSync(pl)) { const ids = adIds(ads, game, 'ios'); writeFileSync(pl, patchPlist(readFileSync(pl, 'utf8'), ids, ads)); console.log('ios', ids ? ids.appId + (ids.test ? ' (TEST)' : '') : 'no ads'); }
}
