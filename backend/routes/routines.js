const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { readDb, writeDb, nextId } = require('../db/init');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const db = readDb();
  res.json({ routines: db.routines.filter((r) => r.userId === req.user.id) });
});

router.post('/', (req, res) => {
  const { name, steps = [] } = req.body;
  const db = readDb();
  const routine = { id: nextId(db, 'routine'), userId: req.user.id, name, steps, usageCount: 0, createdAt: new Date().toISOString() };
  db.routines.push(routine);
  writeDb(db);
  res.status(201).json({ routine });
});

router.post('/:id/use', (req, res) => {
  const db = readDb();
  const routine = db.routines.find((r) => r.id === Number(req.params.id) && r.userId === req.user.id);
  if (!routine) return res.status(404).json({ error: 'Routine not found' });
  routine.usageCount += 1;
  writeDb(db);
  res.json({ routine });
});

router.delete('/:id', (req, res) => {
  const db = readDb();
  db.routines = db.routines.filter((r) => !(r.id === Number(req.params.id) && r.userId === req.user.id));
  writeDb(db);
  res.json({ ok: true });
});

module.exports = router;
