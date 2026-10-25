// Smash Yard relay: serves index.html and pairs two players by a 4-letter room code.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 3000;
const page = () => fs.readFileSync(path.join(__dirname, 'index.html'));
const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.end('ok'); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page());
});
// ---- accounts and friends (email is only kept as a one-way hash and is never shown to anyone) ----
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
const FILE = path.join(DATA, 'users.json');
let db = { users: {} };
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) {}
let dirty = false;
const saveSoon = () => { if (dirty) return; dirty = true; setTimeout(() => { dirty = false; try { fs.writeFileSync(FILE + '.tmp', JSON.stringify(db)); 
fs.renameSync(FILE + '.tmp', FILE); } catch (e) { console.log('save failed', e.message); } }, 400); };
const hashEmail = (e) => crypto.createHash('sha256').update('smash-yard|' + 
e).digest('hex');
const online = new Map();
const BAD = ['fuck', 'shit', 'bitch', 'cunt', 'nigg', 'fag', 'rape', 'porn', 'sex', 'dick', 'cock', 'pussy', 'nazi', 'admin'];
const nameOk = (n) => /^[A-Za-z0-9_]{3,12}$/.test(n) && !BAD.some((b) => 
n.toLowerCase().includes(b));
const U = (n) => db.users[String(n || '').toLowerCase()];
const send = (ws, o) => { if (ws && ws.readyState === 1) 
ws.send(JSON.stringify(o)); };
function viewOf(u) {
  return { t: 'fl', me: u.name, friends: u.friends.map((n) => ({ name: U(n).name, on: online.has(n) })), inc: u.inc.map((n) => U(n).name), out: u.out.map((n) => U(n).name) };
}
const push = (u) => send(online.get(u.name.toLowerCase()), viewOf(u));
const pushWith = (u) => { push(u); u.friends.forEach((n) => push(U(n))); };
const pull = (a, k, v) => { a[k] = a[k].filter((x) => x !== v); };
const SOCIAL = new Set(['login', 'search', 'freq', 'facc', 'fdec', 'frem', 
'invite']);
function social(ws, m) {
  ws.n = (ws.n || 0) + 1;
  if (ws.n > 80) return;
  if (m.t === 'login') {
    const email = String(m.email || '').trim().toLowerCase();
    if (!/^[^@\s]{1,64}@[^@\s]{1,120}\.[^@\s]{2,}$/.test(email)) return send(ws, { t: 'err2', msg: 'That does not look like an email.' });
    const eh = hashEmail(email);
    let u = Object.values(db.users).find((x) => x.eh === eh);
    if (!u) {
      if (!m.name) return send(ws, { t: 'need_name' });
      const nm = String(m.name).trim();
      if (!nameOk(nm)) return send(ws, { t: 'err2', msg: 'Names are 3-12 letters, numbers or _ (and must be clean).', needName: true });
      if (U(nm)) return send(ws, { t: 'err2', msg: 'That name is taken.', 
needName: true });
      u = { name: nm, eh, friends: [], inc: [], out: [] };
      db.users[nm.toLowerCase()] = u; saveSoon();
    }
    const key = u.name.toLowerCase();
    const old = online.get(key); if (old && old !== ws) { old.user = null; try { old.close(); } catch (e) {} }
    ws.user = key; online.set(key, ws);
    send(ws, { t: 'authed', name: u.name });
    pushWith(u);
    return;
  }
  const u = U(ws.user); if (!u) return;
  if (m.t === 'search') {
    const q = String(m.q || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (q.length < 2) return send(ws, { t: 'sr', res: [] });
    const res = Object.keys(db.users).filter((k) => k !== ws.user && 
k.includes(q)).sort((a, b) => (b.startsWith(q) - a.startsWith(q)) || a.length - b.length).slice(0, 8)
      .map((k) => ({ name: db.users[k].name, rel: u.friends.includes(k) ? 'friend' : u.out.includes(k) ? 'sent' : u.inc.includes(k) ? 'got' : 'none' }));
    return send(ws, { t: 'sr', res });
  }
  const t = U(m.name);
  if (!t || t === u) return;
  const tk = t.name.toLowerCase(), uk = ws.user;
  if (m.t === 'freq') {
    if (u.friends.includes(tk) || u.out.includes(tk)) return;
    if (u.inc.includes(tk)) return social(ws, { t: 'facc', name: t.name });
    if (u.out.length >= 30 || t.inc.length >= 50 || u.friends.length >= 50) 
return;
    u.out.push(tk); t.inc.push(uk); saveSoon(); push(u); push(t);
  } else if (m.t === 'facc') {
    if (!u.inc.includes(tk)) return;
    pull(u, 'inc', tk); pull(t, 'out', uk);
    if (!u.friends.includes(tk)) u.friends.push(tk);
    if (!t.friends.includes(uk)) t.friends.push(uk);
    saveSoon(); push(u); push(t);
  } else if (m.t === 'fdec') {
    pull(u, 'inc', tk); pull(t, 'out', uk); pull(u, 'out', tk); pull(t, 'inc', 
uk); saveSoon(); push(u); push(t);
  } else if (m.t === 'frem') {
    pull(u, 'friends', tk); pull(t, 'friends', uk); saveSoon(); push(u); push(t);
  } else if (m.t === 'invite') {
    if (!u.friends.includes(tk)) return;
    send(online.get(tk), { t: 'invited', from: u.name, code: String(m.code || 
'').slice(0, 4) });
  }
}
const wss = new WebSocketServer({ server, maxPayload: 256 * 1024 });
const rooms = new Map();
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const newCode = () => { let c; do { c = Array.from({ length: 4 }, () => 
LETTERS[(Math.random() * LETTERS.length) | 0]).join(''); } while (rooms.has(c)); return c; };
wss.on('connection', (ws) => {
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (data) => {
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (SOCIAL.has(m.t)) return social(ws, m);
    if (m.t === 'create') {
      leave(ws);
      const code = newCode();
      rooms.set(code, { host: ws, guest: null });
      ws.room = code; ws.role = 'host';
      ws.send(JSON.stringify({ t: 'created', code }));
    } else if (m.t === 'join') {
      leave(ws);
      const code = String(m.code || '').toUpperCase(), r = rooms.get(code);
      if (!r) return ws.send(JSON.stringify({ t: 'err', msg: 'No room with that code.' }));
      if (r.guest) return ws.send(JSON.stringify({ t: 'err', msg: 'That room is already full.' }));
      r.guest = ws; ws.room = code; ws.role = 'guest';
      ws.send(JSON.stringify({ t: 'joined' }));
    } else {
      const r = rooms.get(ws.room); if (!r) return;
      const peer = ws.role === 'host' ? r.guest : r.host;
      if (peer && peer.readyState === 1) peer.send(data.toString());
    }
  });
  ws.on('close', () => {
    leave(ws);
    if (ws.user && online.get(ws.user) === ws) { online.delete(ws.user); const u = U(ws.user); if (u) u.friends.forEach((n) => push(U(n))); }
  });
});
function leave(ws) {
  const r = rooms.get(ws.room); if (!r) return;
  const peer = ws.role === 'host' ? r.guest : r.host;
  if (peer && peer.readyState === 1) peer.send(JSON.stringify({ t: 'left' }));
  if (ws.role === 'host') rooms.delete(ws.room); else r.guest = null;
  ws.room = null;
}
setInterval(() => { if (wss.clients.size) wss.clients.forEach((w) => { w.n = 0; }); }, 10000);
setInterval(() => wss.clients.forEach((ws) => { if (!ws.alive) return 
ws.terminate(); ws.alive = false; ws.ping(); }), 20000);
server.listen(PORT, () => console.log('Smash Yard on port ' + PORT));
