const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { readDb, writeDb, nextId } = require('../db/init');

const router = express.Router();
router.use(requireAuth);

router.post('/', (req, res) => {
  const { value, phase = 'before', relatedType = 'timer' } = req.body;
  const db = readDb();
  const mood = { id: nextId(db, 'mood'), userId: req.user.id, value, phase, relatedType, createdAt: new Date().toISOString() };
  db.moods.push(mood);
  writeDb(db);
  res.status(201).json({ mood });
});

router.get('/stats', (req, res) => {
  const db = readDb();
  const moods = db.moods.filter((m) => m.userId === req.user.id);
  const counts = { great: 0, okay: 0, rough: 0 };
  moods.forEach((m) => { counts[m.value] = (counts[m.value] || 0) + 1; });
  res.json({ total: moods.length, counts });
});

module.exports = router;
