// After `cap add` + `cap sync`: puts the AdMob app ID, Apple's tracking text and Google's SKAdNetwork IDs
// into the generated Android and iPhone projects (they are rebuilt from scratch on every CI run).
// usage: node native-config.mjs android|ios
import { readFileSync, writeFileSync } from 'node:fs';
const cfg = JSON.parse(readFileSync(new URL('./monetization.json', import.meta.url)));
const which = process.argv[2];
if (which === 'android') {
  const f = new URL('./android/app/src/main/AndroidManifest.xml', import.meta.url);
  let x = readFileSync(f, 'utf8');
  const meta = `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="${cfg.admob.android.appId}"/>`;
  if (!x.includes('gms.ads.APPLICATION_ID')) x = x.replace(/(<application[^>]*>)/, `$1\n        ${meta}`);
  if (!x.includes('gms.ads.APPLICATION_ID')) throw new Error('could not add AdMob app ID');
  writeFileSync(f, x);
  console.log('Android: AdMob app ID set');
} else if (which === 'ios') {
  const f = new URL('./ios/App/App/Info.plist', import.meta.url);
  let x = readFileSync(f, 'utf8');
  const ids = readFileSync(new URL('./skadnetwork.txt', import.meta.url), 'utf8').split(/\s+/).filter(Boolean);
  const add = `\t<key>GADApplicationIdentifier</key>\n\t<string>${cfg.admob.ios.appId}</string>\n` +
    `\t<key>NSUserTrackingUsageDescription</key>\n\t<string>${cfg.trackingText}</string>\n` +
    `\t<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>\n` +
    `\t<key>UIDeviceFamily</key>\n\t<array><integer>1</integer></array>\n` +
    `\t<key>SKAdNetworkItems</key>\n\t<array>\n` + ids.map((i) => `\t\t<dict><key>SKAdNetworkIdentifier</key><string>${i}</string></dict>\n`).join('') + `\t</array>\n`;
  if (!x.includes('GADApplicationIdentifier')) x = x.replace(/<\/dict>\s*<\/plist>\s*$/, add + '</dict>\n</plist>\n');
  if (!x.includes('GADApplicationIdentifier')) throw new Error('could not edit Info.plist');
  writeFileSync(f, x);
  console.log(`iPhone: AdMob app ID, tracking text and ${ids.length} SKAdNetwork IDs set`);
} else { console.error('usage: node native-config.mjs android|ios'); process.exit(2); }
