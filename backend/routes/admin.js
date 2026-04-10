const express = require('express');
const bcrypt = require('bcryptjs');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { readDb, writeDb } = require('../db/init');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/users', (req, res) => {
  const db = readDb();
  const users = db.users.map(({ passwordHash, ...u }) => u);
  res.json({ users });
});

router.delete('/users/:id', (req, res) => {
  const db = readDb();
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.users = db.users.filter((u) => u.id !== id);
  writeDb(db);
  res.json({ ok: true });
});

router.put('/users/:id/reset-password', (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.passwordHash = bcrypt.hashSync('changeme123', 10);
  writeDb(db);
  res.json({ ok: true, temporaryPassword: 'changeme123' });
});

router.put('/users/:id/role', (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.role = req.body.role === 'admin' ? 'admin' : 'user';
  writeDb(db);
  res.json({ ok: true, role: user.role });
});

router.get('/stats', (req, res) => {
  const db = readDb();
  const totalTime = db.timerSessions.reduce((sum, s) => sum + s.durationSeconds, 0) + db.workSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
  res.json({
    totalUsers: db.users.length,
    totalSessions: db.timerSessions.length + db.workSessions.length,
    totalTimeMinutes: Math.round(totalTime / 60),
    totalMoods: db.moods.length,
  });
});

module.exports = router;
