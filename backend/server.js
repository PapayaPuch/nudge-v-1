const express = require('express');
const cors = require('cors');
const path = require('path');
const { ensureDb } = require('./db/init');

ensureDb();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'nudge', version: '1.0.0' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/timer', require('./routes/timer'));
app.use('/api/work', require('./routes/work'));
app.use('/api/todos', require('./routes/todos'));
app.use('/api/presets', require('./routes/presets'));
app.use('/api/moods', require('./routes/moods'));
app.use('/api/routines', require('./routes/routines'));
app.use('/api/admin', require('./routes/admin'));

app.use(express.static(path.join(__dirname, '../frontend')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Nudge listening on http://localhost:${PORT}`));
