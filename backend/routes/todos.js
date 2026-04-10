const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { readDb, writeDb, nextId } = require('../db/init');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const db = readDb();
  const todos = db.todos.filter((t) => t.userId === req.user.id).sort((a, b) => (a.completed - b.completed) || ({ high: 0, normal: 1, low: 2 }[a.priority] - { high: 0, normal: 1, low: 2 }[b.priority]));
  res.json({ todos });
});

router.post('/', (req, res) => {
  const { text, priority = 'normal', estimateMinutes = null } = req.body;
  if (!text) return res.status(400).json({ error: 'Task text required' });
  const db = readDb();
  const todo = { id: nextId(db, 'todo'), userId: req.user.id, text, priority, estimateMinutes, actualMinutes: null, completed: false, createdAt: new Date().toISOString() };
  db.todos.push(todo);
  writeDb(db);
  res.status(201).json({ todo });
});

router.put('/:id', (req, res) => {
  const db = readDb();
  const todo = db.todos.find((t) => t.id === Number(req.params.id) && t.userId === req.user.id);
  if (!todo) return res.status(404).json({ error: 'Todo not found' });
  Object.assign(todo, req.body);
  writeDb(db);
  res.json({ todo });
});

router.delete('/:id', (req, res) => {
  const db = readDb();
  db.todos = db.todos.filter((t) => !(t.id === Number(req.params.id) && t.userId === req.user.id));
  writeDb(db);
  res.json({ ok: true });
});

router.get('/estimation-stats', (req, res) => {
  const db = readDb();
  const samples = db.todos.filter((t) => t.userId === req.user.id && t.estimateMinutes && t.actualMinutes);
  const avg = samples.length ? Math.round((samples.reduce((sum, s) => sum + (s.actualMinutes / s.estimateMinutes), 0) / samples.length) * 100) : 100;
  res.json({ samples, accuracyPercent: avg, message: avg > 115 ? 'You tend to underestimate' : avg < 85 ? 'You tend to overestimate' : 'Your estimates are getting close' });
});

module.exports = router;
