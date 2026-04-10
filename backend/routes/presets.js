const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { readDb, writeDb, nextId } = require('../db/init');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const db = readDb();
  res.json({ presets: db.presets.filter((p) => p.userId === req.user.id) });
});

router.post('/', (req, res) => {
  const { name, durationMinutes, color = '#F4845F' } = req.body;
  const db = readDb();
  const preset = { id: nextId(db, 'preset'), userId: req.user.id, name, durationMinutes, color, usageCount: 0 };
  db.presets.push(preset);
  writeDb(db);
  res.status(201).json({ preset });
});

router.post('/:id/use', (req, res) => {
  const db = readDb();
  const preset = db.presets.find((p) => p.id === Number(req.params.id) && p.userId === req.user.id);
  if (!preset) return res.status(404).json({ error: 'Preset not found' });
  preset.usageCount += 1;
  writeDb(db);
  res.json({ preset });
});

router.delete('/:id', (req, res) => {
  const db = readDb();
  db.presets = db.presets.filter((p) => !(p.id === Number(req.params.id) && p.userId === req.user.id));
  writeDb(db);
  res.json({ ok: true });
});

module.exports = router;
