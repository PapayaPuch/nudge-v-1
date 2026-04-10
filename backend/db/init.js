const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'data.json');

const defaultPreferences = {
  theme: 'cozy',
  language: 'en',
  voice: null,
  voiceRate: 1,
  ambientSound: 'rain',
  ambientVolume: 0.4,
  fontSize: 'normal',
  reduceAnimations: false,
  transitionWarnings: true,
  breakReminders: 45,
  motivationalMessages: true,
  vibration: true,
  pomodoro: { focus: 25, shortBreak: 5, longBreak: 15 },
  dailyGoalMinutes: 90,
};

function hashPassword(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function baseDb() {
  return {
    users: [
      {
        id: 1,
        name: 'Admin',
        email: 'admin@nudge.app',
        bio: 'Nudge administrator',
        avatarColor: '#F4845F',
        passwordHash: hashPassword('admin123'),
        role: 'admin',
        totalFocusMinutes: 0,
        preferences: defaultPreferences,
      },
    ],
    timerSessions: [],
    workSessions: [],
    todos: [],
    presets: [],
    moods: [],
    routines: [],
    counters: { user: 2, timer: 1, work: 1, todo: 1, preset: 1, mood: 1, routine: 1 },
  };
}

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(baseDb(), null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function nextId(db, key) {
  const current = db.counters[key] || 1;
  db.counters[key] = current + 1;
  return current;
}

module.exports = { readDb, writeDb, nextId, defaultPreferences, DB_PATH, ensureDb, hashPassword };
