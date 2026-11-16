// Fills an App Store Connect product page from files in this folder, through the App Store Connect API.
// node store/asc-listing.mjs store/ios/listing.json store/ios/iphone
//   - App info: subtitle, categories. Version (the one in Prepare for Submission): description, keywords,
//     promotional text, support and marketing URLs, copyright.
//   - Replaces the iPhone screenshots of that version with the PNGs in the folder (sorted by file name).
// Reads ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_P8 from the environment. Never prints them. No npm packages.
import { createSign, createPrivateKey, createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 } = process.env;
const b64u = (b) => Buffer.from(b).toString('base64url');
function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' }));
  const s = createSign('SHA256');
  s.update(`${head}.${body}`);
  return `${head}.${body}.${b64u(s.sign({ key: createPrivateKey(ASC_KEY_P8), dsaEncoding: 'ieee-p1363' }))}`;
}
async function api(method, path, body) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + path, {
    method,
    headers: { authorization: 'Bearer ' + token(), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 204) return {};
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(j.errors?.map((e) => e.detail) ?? j)}`);
  return j;
}
const patch = (type, id, attributes, relationships) =>
  api('PATCH', `/v1/${type}/${id}`, { data: { type, id, attributes, ...(relationships ? { relationships } : {}) } });

const [cfgPath, shotDir] = process.argv.slice(2);
if (!cfgPath) { console.error('usage: asc-listing.mjs <listing.json> [screenshot folder]'); process.exit(2); }
const L = JSON.parse(readFileSync(cfgPath, 'utf8'));

const app = (await api('GET', `/v1/apps?filter[bundleId]=${encodeURIComponent(L.bundleId)}&limit=5`)).data
  .find((a) => a.attributes.bundleId === L.bundleId);
if (!app) throw new Error('No App Store Connect app for ' + L.bundleId);
console.log('App', app.id, app.attributes.name);

// App info (the one still editable) and its localization
const infos = (await api('GET', `/v1/apps/${app.id}/appInfos`)).data;
const info = infos.find((i) => !['READY_FOR_SALE', 'READY_FOR_DISTRIBUTION'].includes(i.attributes.appStoreState ?? i.attributes.state)) || infos[0];
const cat = (id) => (id ? { data: { type: 'appCategories', id } } : undefined);
await patch('appInfos', info.id, undefined, {
  primaryCategory: cat(L.primaryCategory),
  primarySubcategoryOne: cat(L.primarySubcategoryOne),
  primarySubcategoryTwo: cat(L.primarySubcategoryTwo),
});
console.log('Categories set');
const infoLoc = (await api('GET', `/v1/appInfos/${info.id}/appInfoLocalizations`)).data.find((l) => l.attributes.locale === L.locale);
if (infoLoc && L.subtitle) { await patch('appInfoLocalizations', infoLoc.id, { subtitle: L.subtitle }); console.log('Subtitle set'); }

// Version in Prepare for Submission
const ver = (await api('GET', `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10`)).data
  .find((v) => ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED'].includes(v.attributes.appStoreState));
if (!ver) throw new Error('No editable iOS version');
console.log('Version', ver.attributes.versionString, ver.attributes.appStoreState);
if (L.copyright) await patch('appStoreVersions', ver.id, { copyright: L.copyright });
const loc = (await api('GET', `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`)).data.find((l) => l.attributes.locale === L.locale);
if (!loc) throw new Error('No ' + L.locale + ' localization on the version');
const text = {};
for (const k of ['description', 'keywords', 'promotionalText', 'supportUrl', 'marketingUrl']) if (L[k]) text[k] = L[k];
await patch('appStoreVersionLocalizations', loc.id, text);
console.log('Text set:', Object.keys(text).join(', '));

// Screenshots
if (shotDir) {
  const files = readdirSync(shotDir).filter((f) => f.endsWith('.png')).sort();
  const sets = (await api('GET', `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`)).data;
  let set = sets.find((s) => s.attributes.screenshotDisplayType === L.screenshotDisplayType);
  if (!set) {
    set = (await api('POST', '/v1/appScreenshotSets', { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: L.screenshotDisplayType },
      relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } } } })).data;
  }
  for (const old of (await api('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots`)).data) await api('DELETE', `/v1/appScreenshots/${old.id}`);
  for (const f of files) {
    const buf = readFileSync(join(shotDir, f));
    const shot = (await api('POST', '/v1/appScreenshots', { data: { type: 'appScreenshots', attributes: { fileName: f, fileSize: buf.length },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } } })).data;
    for (const op of shot.attributes.uploadOperations) {
      const headers = Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value]));
      const r = await fetch(op.url, { method: op.method, headers, body: buf.subarray(op.offset, op.offset + op.length) });
      if (!r.ok) throw new Error(`upload ${f} -> ${r.status}`);
    }
    await patch('appScreenshots', shot.id, { uploaded: true, sourceFileChecksum: createHash('md5').update(buf).digest('hex') });
    console.log('Uploaded', f);
  }
}
console.log('Done');
