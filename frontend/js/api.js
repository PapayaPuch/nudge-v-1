const localStore = {
  key: 'nudgeLocalData',
  read() {
    return JSON.parse(localStorage.getItem(this.key) || '{"todos":[],"moods":[],"timerSessions":[]}');
  },
  write(data) {
    localStorage.setItem(this.key, JSON.stringify(data));
  },
};

const api = {
  token: localStorage.getItem('nudgeToken') || '',
  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    try {
      const res = await fetch(`/api${path}`, { ...options, headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    } catch {
      return this.localFallback(path, options);
    }
  },
  localFallback(path, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : {};
    const db = localStore.read();

    if (path === '/auth/login' && method === 'POST') return { token: 'offline-token', user: { id: 0, name: 'Offline User' } };
    if (path === '/todos' && method === 'GET') return { todos: db.todos || [] };
    if (path === '/todos' && method === 'POST') {
      const todo = { id: Date.now(), text: body.text, priority: body.priority || 'normal', completed: false };
      db.todos = [...(db.todos || []), todo];
      localStore.write(db);
      return { todo };
    }
    if (/^\/todos\/\d+$/.test(path) && method === 'PUT') {
      const id = Number(path.split('/').pop());
      db.todos = (db.todos || []).map((t) => (t.id === id ? { ...t, ...body } : t));
      localStore.write(db);
      return { ok: true };
    }
    if (/^\/todos\/\d+$/.test(path) && method === 'DELETE') {
      const id = Number(path.split('/').pop());
      db.todos = (db.todos || []).filter((t) => t.id !== id);
      localStore.write(db);
      return { ok: true };
    }
    if (path === '/moods' && method === 'POST') {
      db.moods = [...(db.moods || []), { ...body, id: Date.now() }];
      localStore.write(db);
      return { ok: true };
    }
    if (path === '/moods/stats' && method === 'GET') return { total: (db.moods || []).length };
    if (path === '/timer/session' && method === 'POST') {
      db.timerSessions = [...(db.timerSessions || []), { ...body, id: Date.now(), createdAt: new Date().toISOString() }];
      localStore.write(db);
      return { ok: true };
    }
    if (path === '/timer/stats' && method === 'GET') {
      const today = new Date().toISOString().slice(0, 10);
      const sessions = (db.timerSessions || []).filter((s) => String(s.createdAt).startsWith(today));
      return { todayMinutes: Math.round(sessions.reduce((a, b) => a + (b.durationSeconds || 0), 0) / 60), completedTimers: (db.timerSessions || []).length, pomodoroSessions: 0 };
    }
    if (path === '/work/stats' && method === 'GET') return { totalWorkMinutes: 0, projectBreakdown: [] };

    throw new Error('Offline action unavailable');
  },
  setToken(token) {
    this.token = token;
    localStorage.setItem('nudgeToken', token);
  },
};
