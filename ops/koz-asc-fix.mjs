// Knockout Zoo, one-off fix approved by the owner on Nov 17:
//   1. Age rating: set Advertising = Yes (guideline 2.3.6). Nothing else in the age rating changes.
//   2. Resubmit iOS version 1.0.4 for review.
//   3. Read only: StewardOne's latest iOS build and whether it carries an app icon.
// Reads ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 from the environment. Never prints them. No npm packages.
import { createSign, createPrivateKey } from 'node:crypto';

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 } = process.env;
if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_P8) { console.log('Missing App Store Connect key secrets'); process.exit(1); }
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
  if (!r.ok) throw new Error(`${method} ${path.split('?')[0]} -> ${r.status} ${JSON.stringify(j.errors?.map((e) => e.code + ': ' + e.detail) ?? j)}`);
  return j;
}

const APP = '6828700996';
const VERSION = '1.0.4';
const SUB = 'bc80e338-2fe6-4460-8005-cecbe4471657';
const WAITING = ['WAITING_FOR_REVIEW', 'IN_REVIEW'];

async function knockoutZoo() {
  const app = (await api('GET', `/v1/apps/${APP}`)).data;
  console.log('App:', app.attributes.name, app.attributes.bundleId);
  if (!/knockout/i.test(app.attributes.name)) throw new Error('App name is not Knockout Zoo, stopping without changes');

  // Version 1.0.4
  const vers = (await api('GET', `/v1/apps/${APP}/appStoreVersions?filter[platform]=IOS&filter[versionString]=${VERSION}&limit=5`)).data;
  const ver = vers[0];
  if (!ver) throw new Error('No iOS version ' + VERSION + ', stopping without changes');
  const vstate = () => ver.attributes.appVersionState ?? ver.attributes.appStoreState;
  console.log('Version', VERSION, 'state:', vstate());
  const build = (await api('GET', `/v1/appStoreVersions/${ver.id}/build`)).data;
  console.log('Build on version:', build ? build.attributes.version : 'none');
  if (!build) throw new Error('Version has no build attached, stopping without changes');

  // 1. Age rating: Advertising = Yes
  const infos = (await api('GET', `/v1/apps/${APP}/appInfos`)).data;
  const live = ['READY_FOR_SALE', 'READY_FOR_DISTRIBUTION'];
  const info = infos.find((i) => !live.includes(i.attributes.appStoreState ?? i.attributes.state)) || infos[0];
  const ard = (await api('GET', `/v1/appInfos/${info.id}/ageRatingDeclaration`)).data;
  console.log('Age rating Advertising before:', ard.attributes.advertising);
  if (ard.attributes.advertising !== true) {
    await api('PATCH', `/v1/ageRatingDeclarations/${ard.id}`, { data: { type: 'ageRatingDeclarations', id: ard.id, attributes: { advertising: true } } });
    const after = (await api('GET', `/v1/appInfos/${info.id}/ageRatingDeclaration`)).data;
    console.log('Age rating Advertising after:', after.attributes.advertising);
    if (after.attributes.advertising !== true) throw new Error('Advertising did not change, stopping before resubmit');
  }

  // 2. Resubmit
  let sub = null;
  try { sub = (await api('GET', `/v1/reviewSubmissions/${SUB}`)).data; } catch (e) { console.log('Earlier submission not readable:', e.message); }
  if (sub) console.log('Earlier submission state:', sub.attributes.state);
  if (sub && WAITING.includes(sub.attributes.state)) { console.log('Already waiting for review, nothing to submit'); return; }

  if (sub && sub.attributes.state === 'UNRESOLVED_ISSUES') {
    const items = (await api('GET', `/v1/reviewSubmissions/${SUB}/items`)).data;
    for (const it of items) {
      console.log('Item state:', it.attributes.state);
      if (it.attributes.state === 'REJECTED' || it.attributes.state === 'UNRESOLVED') {
        await api('PATCH', `/v1/reviewSubmissionItems/${it.id}`, { data: { type: 'reviewSubmissionItems', id: it.id, attributes: { resolved: true } } });
        console.log('Item marked resolved');
      }
    }
  } else {
    // Earlier submission is closed: use an open draft for iOS or start one with version 1.0.4
    const open = (await api('GET', `/v1/reviewSubmissions?filter[app]=${APP}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW,UNRESOLVED_ISSUES&limit=5`)).data;
    sub = open[0];
    if (!sub) {
      sub = (await api('POST', '/v1/reviewSubmissions', { data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' },
        relationships: { app: { data: { type: 'apps', id: APP } } } } })).data;
      console.log('Started a new submission');
    } else console.log('Using open submission, state:', sub.attributes.state);
    const items = (await api('GET', `/v1/reviewSubmissions/${sub.id}/items?include=appStoreVersion`)).data;
    const hasVer = items.some((it) => it.relationships?.appStoreVersion?.data?.id === ver.id);
    if (!hasVer) {
      await api('POST', '/v1/reviewSubmissionItems', { data: { type: 'reviewSubmissionItems',
        relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } }, appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } } });
      console.log('Added version', VERSION, 'to the submission');
    }
  }

  await api('PATCH', `/v1/reviewSubmissions/${sub.id}`, { data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } } });
  const s2 = (await api('GET', `/v1/reviewSubmissions/${sub.id}`)).data;
  const v2 = (await api('GET', `/v1/appStoreVersions/${ver.id}`)).data;
  console.log('Submission state now:', s2.attributes.state);
  console.log('Version state now:', v2.attributes.appVersionState ?? v2.attributes.appStoreState);
}

async function stewardOne() {
  const apps = (await api('GET', `/v1/apps?filter[bundleId]=com.birco.stewardone&limit=5`)).data;
  const app = apps.find((a) => a.attributes.bundleId === 'com.birco.stewardone');
  if (!app) { console.log('StewardOne: no App Store Connect app for com.birco.stewardone under this key'); return; }
  console.log('StewardOne app:', app.attributes.name);
  const builds = (await api('GET', `/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=3`)).data;
  if (!builds.length) console.log('StewardOne: no builds uploaded');
  for (const b of builds) console.log('StewardOne build', b.attributes.version, b.attributes.processingState, b.attributes.uploadedDate,
    b.attributes.iconAssetToken ? 'app icon present' : 'NO app icon');
  const vers = (await api('GET', `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=3`)).data;
  for (const v of vers) console.log('StewardOne version', v.attributes.versionString, v.attributes.appVersionState ?? v.attributes.appStoreState);
}

let failed = false;
try { await knockoutZoo(); } catch (e) { failed = true; console.log('Knockout Zoo stopped:', e.message); }
try { await stewardOne(); } catch (e) { console.log('StewardOne check stopped:', e.message); }
process.exit(failed ? 1 : 0);
