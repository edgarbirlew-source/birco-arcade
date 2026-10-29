// Offline support: cache the whole game on first visit, serve it from cache, refresh in the background.
// Bump VERSION whenever any file changes so installed copies pick up the update.
const VERSION='rr-v19-1';
const FILES=['./','index.html','manifest.webmanifest','fonts/bungee.woff2','fonts/chakra-500.woff2','fonts/chakra-700.woff2',
  'icons/icon-192.png','icons/icon-512.png','icons/maskable-192.png','icons/maskable-512.png','icons/apple-touch-icon.png','icons/favicon-32.png','lib/peerjs.min.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
  e.respondWith(caches.open(VERSION).then(async c=>{
    const hit=await c.match(req,{ignoreSearch:true})||(req.mode==='navigate'&&await c.match('index.html'));
    const net=fetch(req).then(r=>{if(r.ok)c.put(req,r.clone());return r;}).catch(()=>null);
    if(hit){e.waitUntil(net);return hit;}
    return (await net)||Response.error();
  }));
});
