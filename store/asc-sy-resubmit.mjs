// Smash Yard 1.0: attach review video, update review notes, resubmit. STAGE=probe|submit (from store/STAGE.txt)
import { createSign, createPrivateKey, createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 } = process.env;
const STAGE = readFileSync('store/STAGE.txt', 'utf8').trim();
const VIDEO = '/tmp/video.mp4', VIDEO_NAME = 'SmashYard_iPhone_screen_recording.mp4';
const VIDEO_LINK = 'https://drive.google.com/file/d/1baWS9aQwx-54gpPZqR_DANZ5LgmxXB0m/view';
const APP = '6835434236', SUB = 'b267cdf6-dd4a-411b-bdb0-52f3d159b2ee';
const b64u = (b) => Buffer.from(b).toString('base64url');
function token(){ const now=Math.floor(Date.now()/1000);
  const head=b64u(JSON.stringify({alg:'ES256',kid:ASC_KEY_ID,typ:'JWT'}));
  const body=b64u(JSON.stringify({iss:ASC_ISSUER_ID,iat:now,exp:now+900,aud:'appstoreconnect-v1'}));
  const s=createSign('SHA256'); s.update(`${head}.${body}`);
  return `${head}.${body}.${b64u(s.sign({key:createPrivateKey(ASC_KEY_P8),dsaEncoding:'ieee-p1363'}))}`; }
async function api(method, path, body){
  const r = await fetch('https://api.appstoreconnect.apple.com'+path, {method, headers:{authorization:'Bearer '+token(),'content-type':'application/json'}, body: body?JSON.stringify(body):undefined});
  const j = await r.json().catch(()=>({}));
  return r.ok ? j : {error:r.status, detail:j.errors}; }
const out = { stage: STAGE, at: new Date().toISOString() };
const v = await api('GET', `/v1/apps/${APP}/appStoreVersions?filter[versionString]=1.0&include=appStoreReviewDetail`);
const ver = v.data?.[0]; out.version = ver && { id: ver.id, state: ver.attributes.appStoreState ?? ver.attributes.appVersionState };
const rd = v.included?.find(x=>x.type==='appStoreReviewDetails'); out.reviewDetailId = rd?.id; out.notesBefore = rd?.attributes?.notes;
if (rd) { const a = await api('GET', `/v1/appStoreReviewDetails/${rd.id}/appStoreReviewAttachments`); out.attachments = a.data?.map(x=>({id:x.id,...x.attributes})) ?? a; }
const s = await api('GET', `/v1/reviewSubmissions/${SUB}?include=items`);
out.submission = s.data ? { state: s.data.attributes.state, items: s.included?.map(i=>({id:i.id,state:i.attributes.state})) } : s;
if (STAGE === 'submit' && rd) {
  const buf = readFileSync(VIDEO); const size = statSync(VIDEO).size;
  const res = await api('POST', '/v1/appStoreReviewAttachments', { data: { type:'appStoreReviewAttachments', attributes:{ fileName: VIDEO_NAME, fileSize: size }, relationships:{ appStoreReviewDetail:{ data:{ type:'appStoreReviewDetails', id: rd.id } } } } });
  out.reserve = res.error ? res : { id: res.data.id, ops: res.data.attributes.uploadOperations?.length };
  if (res.data) {
    for (const op of res.data.attributes.uploadOperations) {
      const h = Object.fromEntries((op.requestHeaders||[]).map(x=>[x.name,x.value]));
      const r = await fetch(op.url, { method: op.method, headers: h, body: buf.subarray(op.offset, op.offset+op.length) });
      if (!r.ok) { out.uploadError = `${r.status} ${await r.text()}`; break; }
    }
    if (!out.uploadError) {
      const md5 = createHash('md5').update(buf).digest('hex');
      const c = await api('PATCH', `/v1/appStoreReviewAttachments/${res.data.id}`, { data:{ type:'appStoreReviewAttachments', id: res.data.id, attributes:{ uploaded:true, sourceFileChecksum: md5 } } });
      out.commit = c.error ? c : c.data.attributes.assetDeliveryState;
    }
  }
  const notes = (rd.attributes.notes||'').replace(/VIDEO_LINK_PENDING/g, `${VIDEO_LINK} (also attached to this review as ${VIDEO_NAME})`);
  const n = await api('PATCH', `/v1/appStoreReviewDetails/${rd.id}`, { data:{ type:'appStoreReviewDetails', id: rd.id, attributes:{ notes } } });
  out.notesAfter = n.error ? n : n.data.attributes.notes;
  if (!out.uploadError && !n.error) {
    const sub = await api('PATCH', `/v1/reviewSubmissions/${SUB}`, { data:{ type:'reviewSubmissions', id: SUB, attributes:{ submitted:true } } });
    out.resubmit = sub.error ? sub : sub.data.attributes.state;
  }
}
if (STAGE === 'resubmit') {
  out.resolve = [];
  for (const i of (s.included||[]).filter(i=>i.attributes.state==='REJECTED')) {
    const r = await api('PATCH', `/v1/reviewSubmissionItems/${i.id}`, { data:{ type:'reviewSubmissionItems', id:i.id, attributes:{ resolved:true } } });
    out.resolve.push(r.error ? r : r.data.attributes);
  }
  const sub = await api('PATCH', `/v1/reviewSubmissions/${SUB}`, { data:{ type:'reviewSubmissions', id: SUB, attributes:{ submitted:true } } });
  out.resubmit = sub.error ? sub : sub.data.attributes.state;
  const s2 = await api('GET', `/v1/reviewSubmissions/${SUB}?include=items`);
  out.after = s2.data ? { state: s2.data.attributes.state, items: s2.included?.map(i=>({id:i.id,state:i.attributes.state})) } : s2;
}
console.log(JSON.stringify(out, null, 2));
