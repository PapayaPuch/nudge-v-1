const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ensureDb, readDb, writeDb, nextId, hashPassword } = require('./db/init');

ensureDb();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '../frontend');

const sessions = new Map();

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); }
    });
  });
}

function authUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || !sessions.has(token)) return null;
  const userId = sessions.get(token);
  return readDb().users.find((u) => u.id === userId) || null;
}

function issueToken(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, userId);
  return token;
}

function publicUser(user) {
  const { passwordHash: _, ...rest } = user;
  return rest;
}

function serveStatic(req, res) {
  const reqPath = req.url === '/' ? '/index.html' : req.url;
  const safePath = path.normalize(reqPath).replace(/^\.+/, '');
  const filePath = path.join(FRONTEND_DIR, safePath);
  if (!filePath.startsWith(FRONTEND_DIR)) return sendJson(res, 403, { error: 'Forbidden' });

  const ext = path.extname(filePath);
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
  const exists = fs.existsSync(filePath);
  const resolved = exists ? filePath : path.join(FRONTEND_DIR, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(resolved)] || 'text/plain' });
  res.end(fs.readFileSync(resolved));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  if (req.url === '/api/health' && req.method === 'GET') return sendJson(res, 200, { ok: true, app: 'nudge', version: '1.1.0' });

  if (req.url === '/api/auth/login' && req.method === 'POST') {
    const body = await parseBody(req);
    const db = readDb();
    const user = db.users.find((u) => u.email.toLowerCase() === String(body.email || '').toLowerCase());
    if (!user || user.passwordHash !== hashPassword(body.password || '')) return sendJson(res, 401, { error: 'Invalid credentials' });
    return sendJson(res, 200, { token: issueToken(user.id), user: publicUser(user) });
  }

  if (req.url === '/api/auth/register' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body.name || !body.email || !body.password || String(body.password).length < 6) return sendJson(res, 400, { error: 'Invalid registration data' });
    const db = readDb();
    if (db.users.some((u) => u.email.toLowerCase() === body.email.toLowerCase())) return sendJson(res, 409, { error: 'Email already in use' });
    const user = { id: nextId(db, 'user'), name: body.name, email: body.email, bio: '', avatarColor: '#F4845F', passwordHash: hashPassword(body.password), role: 'user', totalFocusMinutes: 0, preferences: db.users[0].preferences };
    db.users.push(user);
    writeDb(db);
    return sendJson(res, 201, { token: issueToken(user.id), user: publicUser(user) });
  }

  if (req.url === '/api/todos' && req.method === 'GET') {
    const user = authUser(req); if (!user) return sendJson(res, 401, { error: 'Missing or invalid token' });
    const db = readDb();
    const todos = db.todos.filter((t) => t.userId === user.id).sort((a, b) => (a.completed - b.completed));
    return sendJson(res, 200, { todos });
  }

  if (req.url === '/api/todos' && req.method === 'POST') {
    const user = authUser(req); if (!user) return sendJson(res, 401, { error: 'Missing or invalid token' });
    const body = await parseBody(req);
    const db = readDb();
    const todo = { id: nextId(db, 'todo'), userId: user.id, text: body.text, priority: body.priority || 'normal', estimateMinutes: body.estimateMinutes || null, actualMinutes: null, completed: false, createdAt: new Date().toISOString() };
    db.todos.push(todo); writeDb(db);
    return sendJson(res, 201, { todo });
  }

  if (/^\/api\/todos\/\d+$/.test(req.url) && req.method === 'PUT') {
    const user = authUser(req); if (!user) return sendJson(res, 401, { error: 'Missing or invalid token' });
    const id = Number(req.url.split('/').pop());
    const body = await parseBody(req);
    const db = readDb();
    const todo = db.todos.find((t) => t.id === id && t.userId === user.id);
    if (!todo) return sendJson(res, 404, { error: 'Todo not found' });
    Object.assign(todo, body); writeDb(db);
    return sendJson(res, 200, { todo });
  }

  if (/^\/api\/todos\/\d+$/.test(req.url) && req.method === 'DELETE') {
    const user = authUser(req); if (!user) return sendJson(res, 401, { error: 'Missing or invalid token' });
    const id = Number(req.url.split('/').pop());
    const db = readDb();
    db.todos = db.todos.filter((t) => !(t.id === id && t.userId === user.id)); writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (req.url === '/api/moods' && req.method === 'POST') {
    const user = authUser(req); if (!user) return sendJson(res, 401, { error: 'Missing or invalid token' });
    const body = await parseBody(req); const db = readDb();
    db.moods.push({ id: nextId(db, 'mood'), userId: user.id, value: body.value, phase: body.phase || 'before', createdAt: new Date().toISOString() }); writeDb(db);
    return sendJson(res, 201, { ok: true });
  }

  if (req.url === '/api/moods/stats' && req.method === 'GET') {
    const user = authUser(req); if (!user) return sendJson(res, 401, { error: 'Missing or invalid token' });
    const db = readDb(); const moods = db.moods.filter((m) => m.userId === user.id);
    return sendJson(res, 200, { total: moods.length });
  }

  if (req.url === '/api/timer/session' && req.method === 'POST') {
    const user = authUser(req); if (!user) return sendJson(res, 401, { error: 'Missing or invalid token' });
    const body = await parseBody(req); const db = readDb();
    db.timerSessions.push({ id: nextId(db, 'timer'), userId: user.id, name: body.name || 'Focus Session', durationSeconds: body.durationSeconds || 0, mode: body.mode || 'timer', createdAt: new Date().toISOString() });
    writeDb(db);
    return sendJson(res, 201, { ok: true });
  }

  if (req.url === '/api/timer/stats' && req.method === 'GET') {
    const user = authUser(req); if (!user) return sendJson(res, 401, { error: 'Missing or invalid token' });
    const db = readDb();
    const sessions = db.timerSessions.filter((s) => s.userId === user.id);
    const today = new Date().toISOString().slice(0, 10);
    const todayMinutes = Math.round(sessions.filter((s) => String(s.createdAt).startsWith(today)).reduce((a, b) => a + (b.durationSeconds || 0), 0) / 60);
    return sendJson(res, 200, { todayMinutes, completedTimers: sessions.length, pomodoroSessions: sessions.filter((s) => s.mode === 'pomodoro').length });
  }

  if (req.url === '/api/work/stats' && req.method === 'GET') {
    const user = authUser(req); if (!user) return sendJson(res, 401, { error: 'Missing or invalid token' });
    const db = readDb();
    const totalWorkMinutes = Math.round(db.workSessions.filter((w) => w.userId === user.id && w.status === 'ended').reduce((a, b) => a + (b.durationSeconds || 0), 0) / 60);
    return sendJson(res, 200, { totalWorkMinutes, projectBreakdown: [] });
  }

  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Nudge listening on http://localhost:${PORT}`);
});
