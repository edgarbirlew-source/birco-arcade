// Read-only: prints Smash Yard TestFlight beta review + tester status and App Store version state as JSON.
import { createSign, createPrivateKey } from 'node:crypto';
const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 } = process.env;
const b64u = (b) => Buffer.from(b).toString('base64url');
function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' }));
  const s = createSign('SHA256'); s.update(`${head}.${body}`);
  return `${head}.${body}.${b64u(s.sign({ key: createPrivateKey(ASC_KEY_P8), dsaEncoding: 'ieee-p1363' }))}`;
}
async function get(path) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + path, { headers: { authorization: 'Bearer ' + token() } });
  const j = await r.json().catch(() => ({}));
  return r.ok ? j : { error: r.status, detail: j.errors?.map((e) => e.detail) };
}
const APP = '6835434236', GROUP = '958699e9-749b-4097-b402-016e5a5d5b32';
const out = {};
const builds = await get(`/v1/builds?filter[app]=${APP}&sort=-uploadedDate&limit=5&include=betaAppReviewSubmission,buildBetaDetail`);
out.builds = (builds.data || []).map((b) => ({ id: b.id, version: b.attributes.version, processing: b.attributes.processingState, expired: b.attributes.expired }));
out.included = (builds.included || []).map((i) => ({ type: i.type, id: i.id, attributes: i.attributes }));
if (builds.error) out.buildsError = builds;
out.group = (await get(`/v1/betaGroups/${GROUP}?include=builds`));
out.testers = await get(`/v1/betaGroups/${GROUP}/betaTesters?limit=50`);
out.versions = await get(`/v1/apps/${APP}/appStoreVersions?filter[platform]=IOS&limit=5`);
out.reviewSubmissions = await get(`/v1/reviewSubmissions?filter[app]=${APP}&limit=5`);
console.log(JSON.stringify(out, null, 1));
