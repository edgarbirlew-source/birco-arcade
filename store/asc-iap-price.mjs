// Sets the US base price of an App Store in-app purchase (other countries follow Apple's equalized prices).
// node store/asc-iap-price.mjs <bundleId> <productId> <usdPrice>
//   e.g. node store/asc-iap-price.mjs com.birco.smashyard smashyard_full_game 3.99
// Reads ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_P8 from the environment. Never prints them. No npm packages.
import { createSign, createPrivateKey } from 'node:crypto';

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
  const url = path.startsWith('http') ? path : 'https://api.appstoreconnect.apple.com' + path;
  const r = await fetch(url, {
    method,
    headers: { authorization: 'Bearer ' + token(), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 204) return {};
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(j.errors?.map((e) => e.detail) ?? j)}`);
  return j;
}

const [bundleId, productId, usd] = process.argv.slice(2);
if (!bundleId || !productId || !/^\d+\.\d\d$/.test(usd || '')) {
  console.error('usage: asc-iap-price.mjs <bundleId> <productId> <usdPrice like 3.99>');
  process.exit(2);
}

const app = (await api('GET', `/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=5`)).data
  .find((a) => a.attributes.bundleId === bundleId);
if (!app) throw new Error('No App Store Connect app for ' + bundleId);
console.log('App', app.id, app.attributes.name);

const iap = (await api('GET', `/v1/apps/${app.id}/inAppPurchasesV2?filter[productId]=${encodeURIComponent(productId)}&limit=5`)).data
  .find((i) => i.attributes.productId === productId);
if (!iap) throw new Error('No in-app purchase ' + productId);
console.log('In-app purchase', iap.id, iap.attributes.name, iap.attributes.state);

async function usPrice() {
  try {
    const j = await api('GET', `/v1/inAppPurchasePriceSchedules/${iap.id}/manualPrices?include=inAppPurchasePricePoint,territory&limit=50`);
    const pts = Object.fromEntries((j.included || []).filter((x) => x.type === 'inAppPurchasePricePoints').map((x) => [x.id, x.attributes.customerPrice]));
    return (j.data || []).map((p) => `${p.relationships?.territory?.data?.id ?? '?'} ${pts[p.relationships?.inAppPurchasePricePoint?.data?.id] ?? '?'} from ${p.attributes.startDate ?? 'now'}`).join('; ') || 'none';
  } catch (e) { return 'unknown (' + e.message + ')'; }
}
console.log('Price before:', await usPrice());

let point = null;
let next = `/v2/inAppPurchases/${iap.id}/pricePoints?filter[territory]=USA&limit=200`;
while (next && !point) {
  const j = await api('GET', next);
  point = j.data.find((p) => p.attributes.customerPrice === usd) || null;
  next = j.links?.next || null;
}
if (!point) throw new Error('No US price point for ' + usd);
console.log('US price point', usd, point.id);

await api('POST', '/v1/inAppPurchasePriceSchedules', {
  data: {
    type: 'inAppPurchasePriceSchedules',
    relationships: {
      inAppPurchase: { data: { type: 'inAppPurchases', id: iap.id } },
      baseTerritory: { data: { type: 'territories', id: 'USA' } },
      manualPrices: { data: [{ type: 'inAppPurchasePrices', id: '${price1}' }] },
    },
  },
  included: [{
    type: 'inAppPurchasePrices',
    id: '${price1}',
    attributes: { startDate: null },
    relationships: {
      inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iap.id } },
      inAppPurchasePricePoint: { data: { type: 'inAppPurchasePricePoints', id: point.id } },
    },
  }],
});
console.log('Price schedule set: US base', usd, 'starting now');
console.log('Price after:', await usPrice());
