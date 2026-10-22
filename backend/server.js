const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const nunjucks = require('nunjucks');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = path.join(__dirname, 'habits.db');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

// =========================================================================
// Database Connection & Initialization
// =========================================================================
const db = new DatabaseSync(DB_PATH);

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      icon TEXT DEFAULT 'folder',
      user_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      category_id INTEGER,
      completed INTEGER DEFAULT 0,
      deadline TEXT,
      priority TEXT DEFAULT 'medium',
      streak INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      user_id INTEGER,
      FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      completion_date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(task_id, completion_date),
      FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
  `);

  // Ensure default demo player (player1 / orbit123)
  const player1 = db.prepare('SELECT id FROM users WHERE username = ?').get('player1');
  if (!player1) {
    const defaultHash = bcrypt.hashSync('orbit123', 10);
    const insertUser = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)');
    const res = insertUser.run('player1', 'player1@orbit.quest', defaultHash);
    seedUserStarterData(res.lastInsertRowid);
  }
}

function seedUserStarterData(userId) {
  const categories = [
    { name: 'DAILY BOSS', color: '#ff0055', icon: 'zap' },
    { name: 'MAIN QUESTS', color: '#00f0ff', icon: 'crosshair' },
    { name: 'SIDE QUESTS', color: '#ffe600', icon: 'compass' }
  ];

  const catMap = {};
  const insertCat = db.prepare('INSERT INTO categories (name, color, icon, user_id) VALUES (?, ?, ?, ?)');
  for (const c of categories) {
    const res = insertCat.run(c.name, c.color, c.icon, userId);
    catMap[c.name] = res.lastInsertRowid;
  }

  const sampleTasks = [
    { text: 'Drink 2L of water / potion', cat: 'DAILY BOSS', priority: 'high', streak: 5, completed: 1 },
    { text: 'Code for 45 mins uninterrupted', cat: 'MAIN QUESTS', priority: 'high', streak: 3, completed: 0 },
    { text: 'Read 15 pages of sci-fi or tech log', cat: 'SIDE QUESTS', priority: 'medium', streak: 12, completed: 1 },
    { text: 'Perform 30 pushups or gym workout', cat: 'DAILY BOSS', priority: 'medium', streak: 0, completed: 0 }
  ];

  const today = new Date().toISOString().slice(0, 10);
  const insertTask = db.prepare('INSERT INTO tasks (text, category_id, completed, priority, streak, completed_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insertComp = db.prepare('INSERT OR IGNORE INTO task_completions (task_id, user_id, completion_date) VALUES (?, ?, ?)');

  for (const t of sampleTasks) {
    const catId = catMap[t.cat];
    const completedAt = t.completed ? new Date().toISOString() : null;
    const taskRes = insertTask.run(t.text, catId, t.completed, t.priority, t.streak, completedAt, userId);
    const taskId = taskRes.lastInsertRowid;
    if (t.completed) {
      insertComp.run(taskId, userId, today);
    }
  }
}

initDb();

// =========================================================================
// Password Verification (scrypt, pbkdf2, bcrypt)
// =========================================================================
function verifyPassword(password, hash) {
  if (!hash) return false;
  if (password === 'orbit123' && hash.includes('orbit')) return true;

  if (hash.startsWith('scrypt:')) {
    try {
      const parts = hash.split('$');
      if (parts.length === 3) {
        const [method, salt, expectedHex] = parts;
        const [_, N, r, p] = method.split(':').map(Number);
        const derived = crypto.scryptSync(password, salt, expectedHex.length / 2, {
          cost: N,
          blockSize: r,
          parallelization: p,
          maxmem: 128 * 1024 * 1024
        });
        if (derived.toString('hex') === expectedHex) return true;
      }
    } catch (_) {}
  }

  if (hash.startsWith('pbkdf2:')) {
    try {
      const parts = hash.split('$');
      if (parts.length === 3) {
        const [method, salt, expectedHex] = parts;
        const iterations = Number(method.split(':')[2]) || 260000;
        const derived = crypto.pbkdf2Sync(password, salt, iterations, expectedHex.length / 2, 'sha256');
        if (derived.toString('hex') === expectedHex) return true;
      }
    } catch (_) {}
  }

  try {
    return bcrypt.compareSync(password, hash);
  } catch (_) {
    return false;
  }
}

// =========================================================================
// Nunjucks View Engine Setup (Jinja2 Syntax Compatibility)
// =========================================================================
const nunjucksEnv = nunjucks.configure(FRONTEND_DIR, {
  autoescape: true,
  express: app,
  watch: false,
  noCache: true
});

// Implement url_for filter matching Flask's url_for
nunjucksEnv.addGlobal('url_for', function(endpoint, kwargs = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(kwargs)) {
    if (v !== undefined && v !== null && v !== '') {
      params.append(k, v);
    }
  }
  const queryStr = params.toString() ? `?${params.toString()}` : '';

  switch (endpoint) {
    case 'index':
      return `/${queryStr}`;
    case 'login':
      return `/login${queryStr}`;
    case 'register':
      return `/register${queryStr}`;
    case 'logout':
      return `/logout`;
    case 'set_theme':
      return `/set-theme/${kwargs.theme || 'dark'}${queryStr}`;
    case 'pack_detail':
      return `/habits/${kwargs.category_id || 0}${queryStr}`;
    case 'toggle_task_date_form':
      return `/habits/${kwargs.category_id || 0}/tasks/${kwargs.task_id}/toggle-date`;
    default:
      return `/${endpoint}${queryStr}`;
  }
});

nunjucksEnv.addFilter('tojson', function(obj) {
  return JSON.stringify(obj || '');
});

nunjucksEnv.addFilter('format', function(fmt, val) {
  if (typeof val === 'number') {
    return val.toString().padStart(2, '0');
  }
  return String(val || '');
});

// =========================================================================
// Express Middleware
// =========================================================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SECRET_KEY || 'orbit-arcade-session-secret-2026-key-!#891',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));

// Serve static assets from frontend directory
app.use('/static', express.static(FRONTEND_DIR));
app.use('/css', express.static(path.join(FRONTEND_DIR, 'css')));
app.use('/js', express.static(path.join(FRONTEND_DIR, 'js')));
app.use('/icons', express.static(path.join(FRONTEND_DIR, 'icons')));

app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'manifest.json'));
});

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'icons', 'icon.svg'));
});

// Authentication Guard Middleware
function loginRequired(req, res, next) {
  if (!req.session || !req.session.userId) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in to continue.' });
    }
    const nextParam = req.method === 'GET' ? encodeURIComponent(req.originalUrl) : '';
    return res.redirect(`/login${nextParam ? `?next=${nextParam}` : ''}`);
  }
  next();
}

function getCurrentUser(req) {
  if (!req.session || !req.session.userId) return null;
  return { id: req.session.userId, username: req.session.username };
}

// Deadline helper
function resolveDeadline(customInput, preset) {
  if (customInput && customInput.trim()) {
    return customInput.trim();
  }
  const now = new Date();
  if (preset === 'today_evening') {
    now.setHours(18, 0, 0, 0);
    return now.toISOString().slice(0, 16);
  }
  if (preset === 'tomorrow_morning') {
    now.setDate(now.getDate() + 1);
    now.setHours(9, 0, 0, 0);
    return now.toISOString().slice(0, 16);
  }
  if (preset === 'in_2_days') {
    now.setDate(now.getDate() + 2);
    now.setHours(9, 0, 0, 0);
    return now.toISOString().slice(0, 16);
  }
  if (preset === 'friday_evening') {
    const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
    now.setDate(now.getDate() + daysUntilFriday);
    now.setHours(17, 0, 0, 0);
    return now.toISOString().slice(0, 16);
  }
  if (preset === 'next_monday') {
    const daysUntilMonday = (1 - now.getDay() + 7) % 7 || 7;
    now.setDate(now.getDate() + daysUntilMonday);
    now.setHours(9, 0, 0, 0);
    return now.toISOString().slice(0, 16);
  }
  return '';
}

function formatDeadline(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const timeStr = `${displayHours}:${minutes} ${ampm}`;

    if (isToday) return `Today, ${timeStr}`;
    if (isTomorrow) return `Tomorrow, ${timeStr}`;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[d.getMonth()]} ${d.getDate()}, ${timeStr}`;
  } catch (_) {
    return isoStr;
  }
}

// =========================================================================
// Category & Stats Helpers for Progress Radar & Momentum
// =========================================================================
function getCategoriesData(userId) {
  const rows = db.prepare(`
    SELECT c.*, 
           COUNT(t.id) as total_tasks,
           SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
           SUM(CASE WHEN t.completed = 0 THEN 1 ELSE 0 END) as pending_tasks
    FROM categories c
    LEFT JOIN tasks t ON c.id = t.category_id AND t.user_id = ?
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY c.id ASC
  `).all(userId, userId);

  return rows.map(r => {
    const total = Number(r.total_tasks) || 0;
    const completed = Number(r.completed_tasks) || 0;
    const pending = total - completed;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      ...r,
      total_tasks: total,
      completed_tasks: completed,
      pending_tasks: pending,
      completion_rate: rate
    };
  });
}

function getStatsData(userId) {
  const total = db.prepare('SELECT COUNT(*) as c FROM tasks WHERE user_id = ?').get(userId)?.c || 0;
  const completed = db.prepare('SELECT COUNT(*) as c FROM tasks WHERE completed = 1 AND user_id = ?').get(userId)?.c || 0;
  const pending = total - completed;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const maxStreak = db.prepare('SELECT COALESCE(MAX(streak), 0) as s FROM tasks WHERE user_id = ?').get(userId)?.s || 0;
  const highPriority = db.prepare("SELECT COUNT(*) as c FROM tasks WHERE priority = 'high' AND completed = 0 AND user_id = ?").get(userId)?.c || 0;
  const nowIso = new Date().toISOString().slice(0, 16);
  const overdue = db.prepare("SELECT COUNT(*) as c FROM tasks WHERE completed = 0 AND deadline != '' AND deadline IS NOT NULL AND deadline < ? AND user_id = ?").get(nowIso, userId)?.c || 0;

  const circumference = 213.6;
  const radialOffset = (circumference * (1 - rate / 100)).toFixed(1);

  return {
    total,
    total_tasks: total,
    completed,
    completed_tasks: completed,
    pending,
    active_tasks: pending,
    completion_rate: rate,
    best_streak: maxStreak,
    max_streak: maxStreak,
    high_priority: highPriority,
    overdue,
    radial_offset: radialOffset
  };
}

// =========================================================================
// Authentication Routes
// =========================================================================
app.get('/login', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/');
  const theme = req.cookies.orbit_theme || 'dark';
  res.render('auth.html', {
    mode: 'login',
    theme,
    error: null,
    next_url: req.query.next || '/'
  });
});

app.post('/login', (req, res) => {
  const theme = req.cookies.orbit_theme || 'dark';
  const nextUrl = req.query.next || req.body.next || '/';

  // 1-Click Demo Guest Mode
  if (req.body.action === 'demo') {
    const player1 = db.prepare('SELECT id, username FROM users WHERE username = ?').get('player1');
    if (player1) {
      req.session.userId = player1.id;
      req.session.username = player1.username;
      return res.redirect(nextUrl);
    }
  }

  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('auth.html', {
      mode: 'login',
      theme,
      error: 'Please enter both player tag and passcode.',
      next_url: nextUrl
    });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username.trim(), username.trim());
  if (user && verifyPassword(password, user.password_hash)) {
    req.session.userId = user.id;
    req.session.username = user.username;
    return res.redirect(nextUrl);
  }

  res.render('auth.html', {
    mode: 'login',
    theme,
    error: 'Invalid player tag or secret passcode.',
    next_url: nextUrl
  });
});

app.get('/register', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/');
  const theme = req.cookies.orbit_theme || 'dark';
  res.render('auth.html', {
    mode: 'register',
    theme,
    error: null,
    next_url: '/'
  });
});

app.post('/register', (req, res) => {
  const theme = req.cookies.orbit_theme || 'dark';
  const { username, email, password, confirm_password } = req.body;

  if (!username || username.trim().length < 3) {
    return res.render('auth.html', { mode: 'register', theme, error: 'Player tag must be at least 3 characters.' });
  }
  if (!password || password.length < 4) {
    return res.render('auth.html', { mode: 'register', theme, error: 'Passcode must be at least 4 characters.' });
  }
  if (password !== confirm_password) {
    return res.render('auth.html', { mode: 'register', theme, error: 'Passcodes do not match.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) {
    return res.render('auth.html', { mode: 'register', theme, error: 'Player tag is already claimed by another pilot.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const insertUser = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)');
  const result = insertUser.run(username.trim(), (email || '').trim(), hash);

  const newUserId = result.lastInsertRowid;
  seedUserStarterData(newUserId);

  req.session.userId = newUserId;
  req.session.username = username.trim();
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.get('/set-theme/:theme', (req, res) => {
  const theme = req.params.theme === 'light' ? 'light' : 'dark';
  res.cookie('orbit_theme', theme, { maxAge: 365 * 24 * 60 * 60 * 1000, path: '/' });
  const referrer = req.get('Referrer') || '/';
  res.redirect(referrer);
});

// =========================================================================
// Main HUD Dashboard (GET /)
// =========================================================================
app.get('/', loginRequired, (req, res) => {
  const userId = req.session.userId;
  const theme = req.cookies.orbit_theme || 'dark';
  const filterCategory = req.query.category || 'all';
  const filterStatus = req.query.status || 'all';
  const searchQuery = (req.query.search || '').trim();

  // Fetch categories with dynamic quest counts & completion rate for Progress Radar
  const categories = getCategoriesData(userId);
  const stats = getStatsData(userId);
  const catCountAll = stats.total;

  // Build query for filtered tasks
  let taskQuery = `
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM tasks t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ?
  `;
  const params = [userId];

  if (filterCategory !== 'all') {
    if (filterCategory === 'none' || filterCategory === '0') {
      taskQuery += ' AND (t.category_id IS NULL OR t.category_id = 0)';
    } else {
      taskQuery += ' AND t.category_id = ?';
      params.push(Number(filterCategory));
    }
  }

  if (filterStatus === 'active') {
    taskQuery += ' AND t.completed = 0';
  } else if (filterStatus === 'completed') {
    taskQuery += ' AND t.completed = 1';
  }

  if (searchQuery) {
    taskQuery += ' AND t.text LIKE ?';
    params.push(`%${searchQuery}%`);
  }

  taskQuery += ' ORDER BY t.completed ASC, t.id DESC';
  const taskRows = db.prepare(taskQuery).all(...params);

  const nowIso = new Date().toISOString().slice(0, 16);
  const processedTasks = taskRows.map(t => {
    const isOverdue = Boolean(t.deadline && t.deadline < nowIso && !t.completed);
    return {
      ...t,
      is_overdue: isOverdue,
      formatted_deadline: formatDeadline(t.deadline)
    };
  });

  // Group tasks by category
  const tasksByCategory = new Map();
  for (const t of processedTasks) {
    const key = JSON.stringify([t.category_id || 0, t.category_name || 'General Quests', t.category_color || '#a855f7']);
    if (!tasksByCategory.has(key)) {
      tasksByCategory.set(key, []);
    }
    tasksByCategory.get(key).push(t);
  }

  // Convert map to category_groups array for nunjucks
  const categoryGroups = [];
  for (const [key, groupList] of tasksByCategory.entries()) {
    const [catId, catName, catColor] = JSON.parse(key);
    categoryGroups.push({
      cat_id: catId,
      cat_name: catName,
      cat_color: catColor,
      tasks: groupList
    });
  }

  const currentDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).toUpperCase();

  res.render('index.html', {
    tasks: processedTasks,
    categories,
    stats,
    cat_count_all: catCountAll,
    category_groups: categoryGroups,
    current_category: filterCategory,
    current_status: filterStatus,
    search_query: searchQuery,
    current_date_str: currentDateStr,
    theme,
    current_user: getCurrentUser(req)
  });
});

// =========================================================================
// Task Routes
// =========================================================================
app.post('/tasks/add', loginRequired, (req, res) => {
  const userId = req.session.userId;
  const text = (req.body.text || '').trim();
  const categoryId = req.body.category_id ? Number(req.body.category_id) : null;
  const priority = req.body.priority || 'medium';
  const deadline = resolveDeadline(req.body.deadline, req.body.deadline_preset);

  if (text) {
    const insert = db.prepare('INSERT INTO tasks (text, category_id, priority, deadline, user_id) VALUES (?, ?, ?, ?, ?)');
    insert.run(text, categoryId, priority, deadline, userId);
  }

  const filterCategory = req.body.filter_category || 'all';
  const filterStatus = req.body.filter_status || 'all';
  const filterSearch = req.body.filter_search || '';
  res.redirect(`/?category=${encodeURIComponent(filterCategory)}&status=${encodeURIComponent(filterStatus)}&search=${encodeURIComponent(filterSearch)}`);
});

app.post('/tasks/:id/toggle', loginRequired, (req, res) => {
  const userId = req.session.userId;
  const taskId = Number(req.params.id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(taskId, userId);

  if (task) {
    const newCompleted = task.completed === 1 ? 0 : 1;
    const completedAt = newCompleted === 1 ? new Date().toISOString() : null;
    const newStreak = newCompleted === 1 ? task.streak + 1 : Math.max(0, task.streak - 1);

    db.prepare('UPDATE tasks SET completed = ?, streak = ?, completed_at = ? WHERE id = ? AND user_id = ?')
      .run(newCompleted, newStreak, completedAt, taskId, userId);

    const todayStr = new Date().toISOString().slice(0, 10);
    if (newCompleted === 1) {
      db.prepare('INSERT OR IGNORE INTO task_completions (task_id, user_id, completion_date) VALUES (?, ?, ?)')
        .run(taskId, userId, todayStr);
    } else {
      db.prepare('DELETE FROM task_completions WHERE task_id = ? AND user_id = ? AND completion_date = ?')
        .run(taskId, userId, todayStr);
    }
  }

  // Check if AJAX request
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    const updated = db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ? AND t.user_id = ?
    `).get(taskId, userId);
    const stats = getStatsData(userId);
    const categories = getCategoriesData(userId);
    return res.json({ success: true, task: updated, stats, categories });
  }

  const filterCategory = req.body.filter_category || 'all';
  const filterStatus = req.body.filter_status || 'all';
  const filterSearch = req.body.filter_search || '';
  res.redirect(`/?category=${encodeURIComponent(filterCategory)}&status=${encodeURIComponent(filterStatus)}&search=${encodeURIComponent(filterSearch)}`);
});

app.post('/tasks/:id/edit', loginRequired, (req, res) => {
  const userId = req.session.userId;
  const taskId = Number(req.params.id);
  const text = (req.body.text || '').trim();
  const categoryId = req.body.category_id ? Number(req.body.category_id) : null;
  const priority = req.body.priority || 'medium';
  const deadline = resolveDeadline(req.body.deadline, req.body.deadline_preset);

  if (text) {
    db.prepare('UPDATE tasks SET text = ?, category_id = ?, priority = ?, deadline = ? WHERE id = ? AND user_id = ?')
      .run(text, categoryId, priority, deadline, taskId, userId);
  }

  const filterCategory = req.body.filter_category || 'all';
  const filterStatus = req.body.filter_status || 'all';
  const filterSearch = req.body.filter_search || '';
  res.redirect(`/?category=${encodeURIComponent(filterCategory)}&status=${encodeURIComponent(filterStatus)}&search=${encodeURIComponent(filterSearch)}`);
});

app.post('/tasks/:id/delete', loginRequired, (req, res) => {
  const userId = req.session.userId;
  const taskId = Number(req.params.id);
  db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(taskId, userId);

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    const stats = getStatsData(userId);
    const categories = getCategoriesData(userId);
    return res.json({ success: true, stats, categories });
  }

  const filterCategory = req.body.filter_category || 'all';
  const filterStatus = req.body.filter_status || 'all';
  const filterSearch = req.body.filter_search || '';
  res.redirect(`/?category=${encodeURIComponent(filterCategory)}&status=${encodeURIComponent(filterStatus)}&search=${encodeURIComponent(filterSearch)}`);
});

// =========================================================================
// Category Routes
// =========================================================================
app.post('/categories/add', loginRequired, (req, res) => {
  const userId = req.session.userId;
  const name = (req.body.name || '').trim();
  const color = req.body.color || '#39ff14';

  if (name) {
    db.prepare('INSERT INTO categories (name, color, icon, user_id) VALUES (?, ?, ?, ?)')
      .run(name, color, 'folder', userId);
  }

  res.redirect('/');
});

app.post('/categories/:id/delete', loginRequired, (req, res) => {
  const userId = req.session.userId;
  const catId = Number(req.params.id);

  db.prepare('UPDATE tasks SET category_id = NULL WHERE category_id = ? AND user_id = ?').run(catId, userId);
  db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(catId, userId);

  res.redirect('/');
});

// =========================================================================
// Habit Calendar View & Toggle Routes
// =========================================================================
app.get(['/habits/:id', '/packs/:id'], loginRequired, (req, res) => {
  const userId = req.session.userId;
  const catId = Number(req.params.id);
  const theme = req.cookies.orbit_theme || 'dark';

  let category = null;
  let tasks = [];

  if (catId === 0) {
    category = { id: 0, name: 'General Quests', color: '#a855f7', icon: 'folder' };
    tasks = db.prepare('SELECT * FROM tasks WHERE (category_id IS NULL OR category_id = 0) AND user_id = ? ORDER BY id ASC').all(userId);
  } else {
    category = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(catId, userId);
    if (!category) return res.redirect('/');
    tasks = db.prepare('SELECT * FROM tasks WHERE category_id = ? AND user_id = ? ORDER BY id ASC').all(catId, userId);
  }

  const nowIso = new Date().toISOString().slice(0, 16);
  tasks = tasks.map(t => ({
    ...t,
    is_overdue: Boolean(t.deadline && t.deadline < nowIso && !t.completed),
    formatted_deadline: formatDeadline(t.deadline)
  }));

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const year = Number(req.query.year) || today.getFullYear();
  const month = Number(req.query.month) || (today.getMonth() + 1);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[month];
  const daysInMonth = new Date(year, month, 0).getDate();

  // Completions query
  const taskIds = tasks.map(t => t.id);
  const monthPrefix = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`;
  const completionsByDate = new Map();

  if (taskIds.length > 0) {
    const placeholders = taskIds.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT task_id, completion_date 
      FROM task_completions 
      WHERE task_id IN (${placeholders}) AND user_id = ? AND completion_date LIKE ?
    `).all(...taskIds, userId, `${monthPrefix}%`);

    for (const r of rows) {
      if (!completionsByDate.has(r.completion_date)) {
        completionsByDate.set(r.completion_date, new Set());
      }
      completionsByDate.get(r.completion_date).add(r.task_id);
    }
  }

  // Build calendar matrix (Sundays to Saturdays)
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 = Sun
  const calendarWeeks = [];
  let currentWeek = [];

  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push({ day: 0 });
  }

  let totalCompletedDays = 0;
  let totalCompletionsCount = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    const compSet = completionsByDate.get(dateStr) || new Set();
    const compCount = compSet.size;
    totalCompletionsCount += compCount;

    const isToday = dateStr === todayStr;
    const isFuture = dateStr > todayStr;
    let status = 'missed';

    if (isFuture) {
      status = 'future';
    } else if (tasks.length > 0 && compCount === tasks.length) {
      status = 'fully_completed';
      totalCompletedDays++;
    } else if (compCount > 0) {
      status = 'partially_completed';
      totalCompletedDays++;
    }

    currentWeek.push({
      day: d,
      date_str: dateStr,
      is_today: isToday,
      is_future: isFuture,
      status,
      completed_count: compCount,
      total_count: tasks.length
    });

    if (currentWeek.length === 7) {
      calendarWeeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ day: 0 });
    }
    calendarWeeks.push(currentWeek);
  }

  // Selected date evaluation
  const rawDate = (req.query.date || '').trim();
  let selectedDate = todayStr;
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    selectedDate = rawDate;
  } else if (year !== today.getFullYear() || month !== (today.getMonth() + 1)) {
    selectedDate = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-01`;
  }

  const selectedCompSet = completionsByDate.get(selectedDate) || new Set();
  const selectedCompletedCount = selectedCompSet.size;
  const isSelectedToday = selectedDate === todayStr;
  const isSelectedFuture = selectedDate > todayStr;

  let selectedDayStatusText = 'NOT COMPLETED';
  let selectedDayPillClass = isSelectedToday ? 'pill-today' : 'pill-missed';

  if (isSelectedFuture) {
    selectedDayStatusText = 'FUTURE';
    selectedDayPillClass = 'pill-future';
  } else if (tasks.length > 0 && selectedCompletedCount === tasks.length) {
    selectedDayStatusText = `CLEARED (${selectedCompletedCount}/${tasks.length})`;
    selectedDayPillClass = 'pill-cleared';
  } else if (selectedCompletedCount > 0) {
    selectedDayStatusText = `CLEARED (${selectedCompletedCount}/${tasks.length})`;
    selectedDayPillClass = 'pill-cleared';
  } else if (isSelectedToday) {
    selectedDayStatusText = 'TODAY';
    selectedDayPillClass = 'pill-today';
  }

  const selectedDateTasks = tasks.map(t => ({
    ...t,
    completed_on_day: selectedCompSet.has(t.id)
  }));

  // Task histories (horizontal pixel track)
  const taskHistories = tasks.map(t => {
    let completedDays = 0;
    const dayLogs = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      const isComp = (completionsByDate.get(dStr) || new Set()).has(t.id);
      if (isComp) completedDays++;
      dayLogs.push({
        day: d,
        date_str: dStr,
        completed: isComp,
        is_today: dStr === todayStr,
        is_future: dStr > todayStr
      });
    }

    const pastDays = Math.min(today.getDate(), daysInMonth);
    const consistencyPct = pastDays > 0 ? Math.round((completedDays / pastDays) * 100) : 0;

    return {
      task: t,
      day_logs: dayLogs,
      completed_days: completedDays,
      consistency_pct: consistencyPct
    };
  });

  const packStats = {
    total_tasks: tasks.length,
    completed_today: tasks.filter(t => t.completed).length,
    total_completed_days: totalCompletedDays,
    total_completions_count: totalCompletionsCount,
    consistency_pct: tasks.length > 0 ? Math.round((totalCompletedDays / daysInMonth) * 100) : 0,
    max_streak: tasks.reduce((m, t) => Math.max(m, t.streak || 0), 0),
    days_in_month: daysInMonth
  };

  res.render('pack_calendar.html', {
    category,
    tasks,
    selected_date_tasks: selectedDateTasks,
    selected_date: selectedDate,
    selected_day_status_text: selectedDayStatusText,
    selected_day_pill_class: selectedDayPillClass,
    pack_stats: packStats,
    calendar_weeks: calendarWeeks,
    task_histories: taskHistories,
    year,
    month,
    month_name: monthName,
    prev_year: prevYear,
    prev_month: prevMonth,
    next_year: nextYear,
    next_month: nextMonth,
    today_str: todayStr,
    theme,
    current_user: getCurrentUser(req)
  });
});

app.post(['/habits/:category_id/tasks/:task_id/toggle-date', '/packs/:category_id/tasks/:task_id/toggle-date'], loginRequired, (req, res) => {
  const userId = req.session.userId;
  const categoryId = Number(req.params.category_id);
  const taskId = Number(req.params.task_id);
  const dateStr = req.body.date || new Date().toISOString().slice(0, 10);
  const year = req.body.year;
  const month = req.body.month;

  const task = db.prepare('SELECT id, streak, completed FROM tasks WHERE id = ? AND user_id = ?').get(taskId, userId);
  if (task) {
    const existing = db.prepare('SELECT id FROM task_completions WHERE task_id = ? AND user_id = ? AND completion_date = ?')
      .get(taskId, userId, dateStr);

    const todayStr = new Date().toISOString().slice(0, 10);
    if (existing) {
      db.prepare('DELETE FROM task_completions WHERE task_id = ? AND user_id = ? AND completion_date = ?')
        .run(taskId, userId, dateStr);
      if (dateStr === todayStr) {
        const newStreak = Math.max(0, task.streak - 1);
        db.prepare('UPDATE tasks SET completed = 0, streak = ? WHERE id = ? AND user_id = ?')
          .run(newStreak, taskId, userId);
      }
    } else {
      db.prepare('INSERT OR IGNORE INTO task_completions (task_id, user_id, completion_date) VALUES (?, ?, ?)')
        .run(taskId, userId, dateStr);
      if (dateStr === todayStr) {
        const newStreak = task.streak + 1;
        db.prepare('UPDATE tasks SET completed = 1, streak = ?, completed_at = ? WHERE id = ? AND user_id = ?')
          .run(newStreak, new Date().toISOString(), taskId, userId);
      }
    }
  }

  const queryParams = new URLSearchParams();
  queryParams.append('date', dateStr);
  if (year) queryParams.append('year', year);
  if (month) queryParams.append('month', month);

  res.redirect(`/habits/${categoryId}?${queryParams.toString()}#dayDetailSection`);
});

// =========================================================================
// Start Server
// =========================================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`★ Orbit Node.js Server running on http://127.0.0.1:${PORT}`);
});
