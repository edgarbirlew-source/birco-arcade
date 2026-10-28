// Knockout Zoo web host (Railway Function, Bun). Serves the game from this repo folder and runs the online rooms.
// The game was written for Claude's `room` capability; /room.js gives it the same API (presence, peers, onPeers)
// over a WebSocket to this server, so the game code runs unchanged outside Claude.
// Deploy: this file is the Railway Function's source (project knockout-zoo). Game files are read from this repo, branch knockout-zoo.

const RAW = "https://raw.githubusercontent.com/edgarbirlew-source/birco-arcade/knockout-zoo/knockout-zoo/";
const LOCAL = Bun.env.KZ_LOCAL_DIR || ""; // for local testing: serve files from disk instead of GitHub

type Cached = { body: ArrayBuffer; type: string; at: number };
const cache = new Map<string, Cached>();

async function getFile(path: string): Promise<Cached | null> {
  const c = cache.get(path);
  // art never changes once published; the page is re-read at most once a minute so a push goes live quickly
  if (c && (path !== "index.html" || Date.now() - c.at < 60_000)) return c;
  let body: ArrayBuffer;
  if (LOCAL) {
    const f = Bun.file(LOCAL + "/" + path);
    if (!(await f.exists())) return null;
    body = await f.arrayBuffer();
  } else {
    const r = await fetch(RAW + path + (path === "index.html" ? "?t=" + Date.now() : ""));
    if (!r.ok) return c || null;
    body = await r.arrayBuffer();
  }
  if (path === "index.html") {
    const html = new TextDecoder().decode(body).replace("<script>", '<script src="/room.js"></script>\n<script>');
    body = new TextEncoder().encode(html).buffer as ArrayBuffer;
  }
  const type = path.endsWith(".png") ? "image/png" : path.endsWith(".jpg") ? "image/jpeg" : "text/html; charset=utf-8";
  const v = { body, type, at: Date.now() };
  cache.set(path, v);
  return v;
}

// ---- rooms: each member has an id and a presence object; every change is sent to the others ----
type Member = { ws: any; p: Record<string, unknown>; at: number };
const rooms = new Map<string, Map<string, Member>>();
const send = (ws: any, m: unknown) => { try { ws.send(JSON.stringify(m)); } catch {} };
const others = (room: string, id: string) => [...(rooms.get(room) || new Map()).entries()].filter(([k]) => k !== id);

const SHIM = `(()=>{
window.KZ_HOSTED=true;
const WS=(location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws';
const rid=()=>Math.random().toString(36).slice(2,12);
function fake(){let mine={},at=Date.now();const hs=new Set();
  const snap=()=>[{peer:'me',sameTab:true,isMe:true,kind:'viewer',guest:false,by:null,presence:Object.freeze({...mine}),updatedAt:at}];
  return {presence(p){for(const k in p){if(p[k]===null)delete mine[k];else mine[k]=p[k];}at=Date.now();const s=snap();hs.forEach(h=>h({peers:s}));return Promise.resolve();},
    peers:snap,onPeers(h){hs.add(h);setTimeout(()=>h({peers:snap()}),0);return()=>hs.delete(h);},leave(){return Promise.resolve();},
    emit(){return Promise.resolve();},on(){return()=>{};},connected(){return true;},onConnection(f){setTimeout(()=>f(true),0);return()=>{};},
    join:joinRoom};}
function joinRoom(name){return new Promise((res,rej)=>{
  const id=rid();let ws=null,mine={},mineAt=Date.now(),left=false,tries=0,first=true;const others=new Map();const hs=new Set(),cs=new Set();
  let snap=[];const rebuild=()=>{snap=Object.freeze([{peer:id,sameTab:true,isMe:true,kind:'viewer',guest:false,by:null,presence:Object.freeze({...mine}),updatedAt:mineAt},...others.values()]);hs.forEach(h=>{try{h({peers:snap});}catch(e){console.error(e);}});};
  const put=(peer,p)=>others.set(peer,{peer,sameTab:false,isMe:false,kind:'viewer',guest:false,by:null,presence:Object.freeze(p||{}),updatedAt:Date.now()});
  const room={presence(p){for(const k in p){if(p[k]===null)delete mine[k];else mine[k]=p[k];}mineAt=Date.now();if(ws&&ws.readyState===1)ws.send(JSON.stringify({t:'p',p:mine}));rebuild();return Promise.resolve();},
    peers(){return snap;},onPeers(h){hs.add(h);setTimeout(()=>h({peers:snap}),0);return()=>hs.delete(h);},
    leave(){left=true;hs.clear();if(ws)ws.close();return Promise.resolve();},emit(){return Promise.resolve();},on(){return()=>{};},
    connected(){return !!ws&&ws.readyState===1;},onConnection(f){cs.add(f);setTimeout(()=>f(room.connected()),0);return()=>cs.delete(f);},join:joinRoom};
  const open=()=>{ws=new WebSocket(WS+'?room='+encodeURIComponent(name)+'&id='+id);
    ws.onopen=()=>{tries=0;ws.send(JSON.stringify({t:'p',p:mine}));cs.forEach(f=>f(true));if(first){first=false;rebuild();res(room);}};
    ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.t==='all'){others.clear();for(const [k,p] of m.peers)put(k,p);}else if(m.t==='u')put(m.peer,m.p);else if(m.t==='x')others.delete(m.peer);rebuild();};
    ws.onclose=()=>{cs.forEach(f=>f(false));if(left)return;if(first&&tries>=2){first=false;rej({code:'upstream_error'});return;}
      tries++;setTimeout(open,Math.min(4000,400*tries));};};
  open();addEventListener('pagehide',()=>{left=true;if(ws)ws.close();});
  setInterval(()=>{if(ws&&ws.readyState===1)ws.send('{"t":"k"}');},20000);});}
window.claude={use:n=>Promise.resolve(n==='room'?fake():null)};
})();`;

Bun.serve({
  port: Number(Bun.env.PORT || 3000),
  async fetch(req, server) {
    const u = new URL(req.url);
    if (u.pathname === "/ws") {
      const room = u.searchParams.get("room") || "", id = u.searchParams.get("id") || "";
      if (!/^[a-z0-9-]{1,40}$/.test(room) || !/^[a-z0-9]{4,16}$/.test(id)) return new Response("bad room", { status: 400 });
      if ((rooms.get(room)?.size || 0) >= 8) return new Response("room full", { status: 429 });
      if (server.upgrade(req, { data: { room, id } })) return;
      return new Response("upgrade failed", { status: 400 });
    }
    if (u.pathname === "/room.js") return new Response(SHIM, { headers: { "content-type": "application/javascript", "cache-control": "no-cache" } });
    if (u.pathname === "/health") return new Response("ok");
    const path = u.pathname === "/" || u.pathname === "/index.html" ? "index.html" : u.pathname.slice(1);
    if (!/^(index\.html|assets\/[a-z0-9_]+\.(png|jpg))$/.test(path)) return new Response("Not found", { status: 404 });
    const f = await getFile(path);
    if (!f) return new Response("Not found", { status: 404 });
    return new Response(f.body, { headers: { "content-type": f.type, "cache-control": path === "index.html" ? "no-cache" : "public, max-age=604800" } });
  },
  websocket: {
    idleTimeout: 120,
    open(ws: any) {
      const { room, id } = ws.data;
      if (!rooms.has(room)) rooms.set(room, new Map());
      const r = rooms.get(room)!;
      const old = r.get(id);
      if (old && old.ws !== ws) { old.ws.data.replaced = true; try { old.ws.close(); } catch {} }
      r.set(id, { ws, p: old?.p || {}, at: Date.now() });
      send(ws, { t: "all", peers: others(room, id).map(([k, m]) => [k, m.p]) });
    },
    message(ws: any, raw) {
      const { room, id } = ws.data;
      let m: any; try { m = JSON.parse(String(raw)); } catch { return; }
      if (m.t !== "p" || typeof m.p !== "object" || !m.p) return;
      const me = rooms.get(room)?.get(id); if (!me || me.ws !== ws) return;
      me.p = m.p; me.at = Date.now();
      const msg = JSON.stringify({ t: "u", peer: id, p: m.p });
      for (const [, o] of others(room, id)) { try { o.ws.send(msg); } catch {} }
    },
    close(ws: any) {
      const { room, id, replaced } = ws.data;
      if (replaced) return;
      const r = rooms.get(room); if (!r) return;
      if (r.get(id)?.ws !== ws) return;
      r.delete(id);
      for (const [, o] of r) send(o.ws, { t: "x", peer: id });
      if (!r.size) rooms.delete(room);
    },
  },
});
console.log("Knockout Zoo host up");
