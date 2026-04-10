const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { readDb, writeDb, nextId } = require('../db/init');

const router = express.Router();
router.use(requireAuth);

router.post('/session', (req, res) => {
  const { name = 'Focus Session', durationSeconds = 0, mode = 'timer', startedAt, endedAt } = req.body;
  const db = readDb();
  const session = {
    id: nextId(db, 'timer'),
    userId: req.user.id,
    name,
    durationSeconds,
    mode,
    startedAt: startedAt || new Date().toISOString(),
    endedAt: endedAt || new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  db.timerSessions.push(session);
  const user = db.users.find((u) => u.id === req.user.id);
  user.totalFocusMinutes += Math.round(durationSeconds / 60);
  writeDb(db);
  res.status(201).json({ session });
});

router.get('/history', (req, res) => {
  const db = readDb();
  res.json({ sessions: db.timerSessions.filter((s) => s.userId === req.user.id).slice(-50).reverse() });
});

router.get('/stats', (req, res) => {
  const db = readDb();
  const sessions = db.timerSessions.filter((s) => s.userId === req.user.id);
  const today = new Date().toISOString().slice(0, 10);
  const todaySeconds = sessions.filter((s) => s.createdAt.startsWith(today)).reduce((a, b) => a + b.durationSeconds, 0);
  const weekly = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().slice(0, 10);
    return {
      date: ds,
      seconds: sessions.filter((s) => s.createdAt.startsWith(ds)).reduce((a, b) => a + b.durationSeconds, 0),
    };
  });
  res.json({
    todayMinutes: Math.round(todaySeconds / 60),
    completedTimers: sessions.length,
    pomodoroSessions: sessions.filter((s) => s.mode === 'pomodoro').length,
    weekly,
  });
});

router.get('/timeline/:date', (req, res) => {
  const db = readDb();
  const { date } = req.params;
  const events = [];
  db.timerSessions.filter((s) => s.userId === req.user.id && s.createdAt.startsWith(date)).forEach((s) => events.push({ type: 'timer', time: s.createdAt, title: s.name, meta: `${Math.round(s.durationSeconds / 60)} min` }));
  db.workSessions.filter((w) => w.userId === req.user.id && w.createdAt.startsWith(date)).forEach((w) => events.push({ type: 'work', time: w.createdAt, title: w.project, meta: `${Math.round((w.durationSeconds || 0) / 60)} min` }));
  db.moods.filter((m) => m.userId === req.user.id && m.createdAt.startsWith(date)).forEach((m) => events.push({ type: 'mood', time: m.createdAt, title: m.phase, meta: m.value }));
  res.json({ events: events.sort((a, b) => a.time.localeCompare(b.time)) });
});

module.exports = router;
