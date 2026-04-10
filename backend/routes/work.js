const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { readDb, writeDb, nextId } = require('../db/init');

const router = express.Router();
router.use(requireAuth);

router.post('/start', (req, res) => {
  const { project = 'Untitled project', note = '' } = req.body;
  const db = readDb();
  const existing = db.workSessions.find((w) => w.userId === req.user.id && w.status === 'active');
  if (existing) return res.status(409).json({ error: 'Active work session already exists' });
  const session = { id: nextId(db, 'work'), userId: req.user.id, project, note, status: 'active', startedAt: new Date().toISOString(), pausedAt: null, durationSeconds: 0, createdAt: new Date().toISOString() };
  db.workSessions.push(session);
  writeDb(db);
  res.status(201).json({ session });
});

router.get('/active', (req, res) => {
  const db = readDb();
  res.json({ session: db.workSessions.find((w) => w.userId === req.user.id && (w.status === 'active' || w.status === 'paused')) || null });
});

router.post('/:id/pause', (req, res) => {
  const db = readDb();
  const session = db.workSessions.find((w) => w.id === Number(req.params.id) && w.userId === req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  session.status = session.status === 'active' ? 'paused' : 'active';
  writeDb(db);
  res.json({ session });
});

router.post('/:id/end', (req, res) => {
  const db = readDb();
  const session = db.workSessions.find((w) => w.id === Number(req.params.id) && w.userId === req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  session.status = 'ended';
  session.endedAt = new Date().toISOString();
  session.durationSeconds = Math.max(0, Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 1000));
  writeDb(db);
  res.json({ session });
});

router.get('/history', (req, res) => {
  const db = readDb();
  res.json({ sessions: db.workSessions.filter((w) => w.userId === req.user.id).slice(-50).reverse() });
});

router.get('/stats', (req, res) => {
  const db = readDb();
  const sessions = db.workSessions.filter((w) => w.userId === req.user.id && w.status === 'ended');
  const projects = {};
  let totalSeconds = 0;
  sessions.forEach((s) => {
    totalSeconds += s.durationSeconds || 0;
    projects[s.project] = (projects[s.project] || 0) + (s.durationSeconds || 0);
  });
  res.json({ totalWorkMinutes: Math.round(totalSeconds / 60), projectBreakdown: Object.entries(projects).map(([project, seconds]) => ({ project, minutes: Math.round(seconds / 60) })) });
});

module.exports = router;
