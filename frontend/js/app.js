const $ = (s) => document.querySelector(s);
const presetRow = $('#presetRow');
const timerStatus = $('#timerStatus');
const immersive = $('#immersive');
const timerDisplay = $('#timerDisplay');

function formatClock() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmt(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

async function ensureAuth() {
  if (api.token) return;
  const login = await api.request('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@nudge.app', password: 'admin123' }) });
  api.setToken(login.token);
}

function enterImmersive(title) {
  $('#immersiveTitle').textContent = title;
  immersive.classList.remove('hidden');
  immersive.setAttribute('aria-hidden', 'false');
}

function leaveImmersive() {
  immersive.classList.add('hidden');
  immersive.setAttribute('aria-hidden', 'true');
}

function setupTimer() {
  timerEngine.onTick = (remaining, total) => {
    timerDisplay.textContent = fmt(remaining);
    timerStatus.textContent = `${fmt(remaining)} remaining`;
    if (remaining % 60 === 0 && remaining > 0) speech.say(`${Math.ceil(remaining / 60)} minutes remaining`);
  };
  timerEngine.onDone = async () => {
    speech.say(phrases.en.done);
    sounds.stop();
    leaveImmersive();
    timerStatus.textContent = 'Great work! Session complete.';
    await api.request('/timer/session', { method: 'POST', body: JSON.stringify({ name: 'Focus Session', durationSeconds: timerEngine.total }) });
    await refreshStats();
  };

  $('#startTimerBtn').addEventListener('click', () => {
    const minutes = Number($('#customMinutes').value || 25);
    enterImmersive('Focus Session');
    timerDisplay.textContent = fmt(minutes * 60);
    timerEngine.start(minutes * 60);
    sounds.play('brown');
    speech.say(`Let’s get started. ${minutes} minutes on the clock.`);
  });

  $('#just5Btn').addEventListener('click', () => {
    speech.say(phrases.en.just5);
    $('#customMinutes').value = 5;
    $('#startTimerBtn').click();
  });

  $('#pauseTimerBtn').addEventListener('click', (e) => {
    if (timerEngine.running) { timerEngine.pause(); e.target.textContent = 'Resume'; }
    else { timerEngine.resume(); e.target.textContent = 'Pause'; }
  });
  $('#stopTimerBtn').addEventListener('click', () => { timerEngine.stop(); leaveImmersive(); sounds.stop(); timerStatus.textContent = 'Stopped. Ready when you are.'; });
  immersive.addEventListener('click', (e) => { if (e.target === immersive) speech.say(`${fmt(timerEngine.remaining)} remaining`); });
}

async function refreshTasks() {
  const { todos } = await api.request('/todos');
  const list = $('#taskList');
  list.innerHTML = '';
  todos.forEach((t) => {
    const li = document.createElement('li');
    li.innerHTML = `<span style="text-decoration:${t.completed ? 'line-through' : 'none'}">${t.text} <small>(${t.priority})</small></span>`;
    const actions = document.createElement('div');
    const done = document.createElement('button');
    done.textContent = t.completed ? 'Undo' : 'Done';
    done.onclick = async () => { await api.request(`/todos/${t.id}`, { method: 'PUT', body: JSON.stringify({ completed: !t.completed }) }); refreshTasks(); };
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = async () => { await api.request(`/todos/${t.id}`, { method: 'DELETE' }); refreshTasks(); };
    actions.append(done, del);
    li.append(actions);
    list.append(li);
  });
}

async function refreshStats() {
  const [timerStats, workStats, moods] = await Promise.all([
    api.request('/timer/stats'),
    api.request('/work/stats'),
    api.request('/moods/stats'),
  ]);
  $('#statsGrid').innerHTML = `
    <div class="stat">Today: ${timerStats.todayMinutes}m</div>
    <div class="stat">Completed timers: ${timerStats.completedTimers}</div>
    <div class="stat">Pomodoro: ${timerStats.pomodoroSessions}</div>
    <div class="stat">Work: ${workStats.totalWorkMinutes}m</div>
    <div class="stat">Mood logs: ${moods.total}</div>
    <div class="stat">Daily goal: ${(timerStats.todayMinutes / 90 * 100).toFixed(0)}%</div>
  `;
}

function setupTop() {
  const btn = $('#speakTimeBtn');
  const render = () => { btn.textContent = `The time is ${formatClock()}`; };
  render();
  setInterval(render, 30_000);
  btn.addEventListener('click', () => speech.say(phrases.en.time(formatClock())));

  [5, 10, 15, 30, 60].forEach((p) => {
    const b = document.createElement('button');
    b.textContent = `${p}m`;
    b.onclick = () => { $('#customMinutes').value = p; };
    presetRow.append(b);
  });
}

function setupMood() {
  document.querySelectorAll('[data-mood]').forEach((b) => {
    b.addEventListener('click', async () => {
      await api.request('/moods', { method: 'POST', body: JSON.stringify({ value: b.dataset.mood, phase: 'before' }) });
      timerStatus.textContent = 'Thanks for checking in. Take it easy. Slow and steady.';
      refreshStats();
    });
  });
}


function setupShareLink() {
  const input = $('#shareLink');
  const btn = $('#copyLinkBtn');
  input.value = window.location.href;
  btn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(input.value);
    timerStatus.textContent = 'Link copied. You can install this app for offline use too.';
  });
}

function setupOfflineSupport() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

function setupTaskForm() {
  $('#taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await api.request('/todos', { method: 'POST', body: JSON.stringify({ text: $('#taskText').value, priority: $('#taskPriority').value }) });
    $('#taskText').value = '';
    refreshTasks();
  });
}

(async function boot() {
  try {
    await ensureAuth();
    setupTop();
    setupTimer();
    setupMood();
    setupShareLink();
    setupOfflineSupport();
    setupTaskForm();
    await refreshTasks();
    await refreshStats();
  } catch (err) {
    timerStatus.textContent = `Hmm, that doesn't look right. ${err.message}`;
  }
})();
