// App Store Connect helper for the iPhone build (no npm packages).
// node scripts/asc.mjs ensure <bundleId> <name>
//   Registers the bundle ID if it is missing, then prints "app=<id>" if the App Store Connect
//   app record exists, or "app=none" if Edgar still has to create it.
// Reads ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_P8 from the environment. Never prints them.
import { createSign, createPrivateKey } from 'node:crypto';
import { appendFileSync } from 'node:fs';

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8, GITHUB_OUTPUT } = process.env;
const b64u = (b) => Buffer.from(b).toString('base64url');
function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' }));
  const s = createSign('SHA256');
  s.update(`${head}.${body}`);
  const sig = s.sign({ key: createPrivateKey(ASC_KEY_P8), dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${b64u(sig)}`;
}
async function api(method, path, body) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + path, {
    method,
    headers: { authorization: 'Bearer ' + token(), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(j.errors?.map((e) => e.detail) ?? j)}`);
  return j;
}
const [cmd, bundleId, name] = process.argv.slice(2);
if (cmd !== 'ensure' || !bundleId) { console.error('usage: ensure <bundleId> <name>'); process.exit(2); }
const ids = await api('GET', `/v1/bundleIds?filter[identifier]=${encodeURIComponent(bundleId)}&limit=5`);
if (!ids.data.some((d) => d.attributes.identifier === bundleId)) {
  await api('POST', '/v1/bundleIds', { data: { type: 'bundleIds', attributes: { identifier: bundleId, name, platform: 'IOS' } } });
  console.log('Registered bundle ID', bundleId);
} else console.log('Bundle ID already registered', bundleId);
const apps = await api('GET', `/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=5`);
const app = apps.data.find((a) => a.attributes.bundleId === bundleId);
const out = `app=${app ? app.id : 'none'}`;
console.log(out);
if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, out + '\n');
