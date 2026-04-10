const express = require('express');
const bcrypt = require('bcryptjs');
const { readDb, writeDb, nextId, defaultPreferences } = require('../db/init');
const { requireAuth, signToken } = require('../middleware/auth');

const router = express.Router();

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) return res.status(400).json({ error: 'Invalid registration data' });
  const db = readDb();
  if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ error: 'Email already in use' });

  const user = {
    id: nextId(db, 'user'),
    name,
    email,
    bio: '',
    avatarColor: '#F4845F',
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'user',
    totalFocusMinutes: 0,
    preferences: { ...defaultPreferences },
  };
  db.users.push(user);
  writeDb(db);
  return res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDb();
  const user = db.users.find((u) => u.email.toLowerCase() === (email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) return res.status(401).json({ error: 'Invalid credentials' });
  return res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.put('/profile', requireAuth, (req, res) => {
  const { name, bio, avatarColor } = req.body;
  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  if (name) user.name = name;
  if (bio !== undefined) user.bio = bio;
  if (avatarColor) user.avatarColor = avatarColor;
  writeDb(db);
  res.json({ user: publicUser(user) });
});

router.put('/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be 6+ chars' });
  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!bcrypt.compareSync(currentPassword || '', user.passwordHash)) return res.status(401).json({ error: 'Current password incorrect' });
  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  writeDb(db);
  res.json({ ok: true });
});

router.put('/preferences', requireAuth, (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  user.preferences = { ...user.preferences, ...req.body };
  writeDb(db);
  res.json({ preferences: user.preferences });
});

module.exports = router;
