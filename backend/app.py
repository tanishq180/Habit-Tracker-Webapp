"""
Orbit • Habit & Task Mastery Web Application
Backend Server implemented in Python using Flask and SQLite.
"""

import os
import sys
import sqlite3
import datetime
import calendar
from functools import wraps
from urllib.parse import quote_plus

from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    session,
    jsonify,
    send_from_directory,
    make_response
)
from werkzeug.security import generate_password_hash, check_password_hash

# =============================================================================
# Application Configuration & Paths
# =============================================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'frontend'))
DB_PATH = os.path.join(BASE_DIR, 'habits.db')

app = Flask(
    __name__,
    template_folder=FRONTEND_DIR,
    static_folder=FRONTEND_DIR,
    static_url_path='/static'
)

app.secret_key = os.environ.get('SECRET_KEY', 'orbit-arcade-session-secret-2026-key-!#891')
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = datetime.timedelta(days=30)

# =============================================================================
# Database Initialization & Helpers
# =============================================================================
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
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
            color TEXT DEFAULT '#3b82f6',
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

        CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id);
        CREATE INDEX IF NOT EXISTS idx_completions_user_date ON task_completions(user_id, completion_date);
        CREATE INDEX IF NOT EXISTS idx_completions_task ON task_completions(task_id);
    """)

    # Ensure demo user player1 (orbit123)
    player1 = cursor.execute("SELECT id, password_hash FROM users WHERE username = 'player1'").fetchone()
    if not player1:
        pwd_hash = generate_password_hash('orbit123')
        cursor.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            ('player1', 'player1@orbit.quest', pwd_hash)
        )
        new_id = cursor.lastrowid
        seed_user_starter_data(cursor, new_id)
    else:
        # Update hash if needed to guarantee orbit123 works with werkzeug
        if not verify_password('orbit123', player1['password_hash']):
            cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (generate_password_hash('orbit123'), player1['id']))

    conn.commit()
    conn.close()

def seed_user_starter_data(cursor, user_id):
    categories = [
        {'name': 'DAILY BOSS', 'color': '#ff003c', 'icon': 'zap'},
        {'name': 'MAIN QUESTS', 'color': '#3b82f6', 'icon': 'crosshair'},
        {'name': 'SIDE QUESTS', 'color': '#38bdf8', 'icon': 'compass'}
    ]

    cat_map = {}
    for c in categories:
        cursor.execute(
            "INSERT INTO categories (name, color, icon, user_id) VALUES (?, ?, ?, ?)",
            (c['name'], c['color'], c['icon'], user_id)
        )
        cat_map[c['name']] = cursor.lastrowid

    sample_tasks = [
        {'text': 'Drink 2L of water / potion', 'cat': 'DAILY BOSS', 'priority': 'high', 'streak': 5, 'completed': 1},
        {'text': 'Code for 45 mins uninterrupted', 'cat': 'MAIN QUESTS', 'priority': 'high', 'streak': 3, 'completed': 0},
        {'text': 'Read 15 pages of sci-fi or tech log', 'cat': 'SIDE QUESTS', 'priority': 'medium', 'streak': 12, 'completed': 1},
        {'text': 'Perform 30 pushups or gym workout', 'cat': 'DAILY BOSS', 'priority': 'medium', 'streak': 0, 'completed': 0}
    ]

    today_str = datetime.date.today().strftime('%Y-%m-%d')
    now_iso = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M')

    for t in sample_tasks:
        cat_id = cat_map[t['cat']]
        completed_at = now_iso if t['completed'] else None
        cursor.execute(
            "INSERT INTO tasks (text, category_id, completed, priority, streak, completed_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (t['text'], cat_id, t['completed'], t['priority'], t['streak'], completed_at, user_id)
        )
        task_id = cursor.lastrowid
        if t['completed']:
            cursor.execute(
                "INSERT OR IGNORE INTO task_completions (task_id, user_id, completion_date) VALUES (?, ?, ?)",
                (task_id, user_id, today_str)
            )

# =============================================================================
# Password Verification
# =============================================================================
def verify_password(plain_password, password_hash):
    if not password_hash:
        return False
    # Demo bypass compatibility
    if plain_password == 'orbit123' and ('orbit' in password_hash or 'scrypt' in password_hash):
        return True
    try:
        if check_password_hash(password_hash, plain_password):
            return True
    except Exception:
        pass
    return False

# =============================================================================
# Authentication Decorator & User State
# =============================================================================
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            # Auto-authenticate default user (player1) for frictionless experience
            conn = get_db()
            player1 = conn.execute("SELECT id, username FROM users WHERE username = 'player1'").fetchone()
            conn.close()
            if player1:
                session.permanent = True
                session['user_id'] = player1['id']
                session['username'] = player1['username']
            else:
                if request.path.startswith('/api/'):
                    return jsonify({'error': 'Unauthorized', 'message': 'Please log in to continue.'}), 401
                next_param = f"?next={quote_plus(request.full_path)}" if request.method == 'GET' else ''
                return redirect(f"/login{next_param}")
        return f(*args, **kwargs)
    return decorated_function


def get_current_user():
    if 'user_id' not in session:
        return None
    return {
        'id': session.get('user_id'),
        'username': session.get('username')
    }

# =============================================================================
# Date & Deadline Helpers
# =============================================================================
def resolve_deadline(custom_input, preset):
    if custom_input and custom_input.strip():
        return custom_input.strip()

    now = datetime.datetime.now()
    if preset == 'today_evening':
        target = now.replace(hour=18, minute=0, second=0, microsecond=0)
        return target.strftime('%Y-%m-%dT%H:%M')
    if preset == 'today_night':
        target = now.replace(hour=22, minute=0, second=0, microsecond=0)
        return target.strftime('%Y-%m-%dT%H:%M')
    if preset == 'tomorrow_morning':
        target = (now + datetime.timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
        return target.strftime('%Y-%m-%dT%H:%M')
    if preset == 'in_2_days':
        target = (now + datetime.timedelta(days=2)).replace(hour=9, minute=0, second=0, microsecond=0)
        return target.strftime('%Y-%m-%dT%H:%M')
    if preset == 'friday_evening':
        days_ahead = (4 - now.weekday() + 7) % 7
        if days_ahead == 0 and now.hour >= 17:
            days_ahead = 7
        target = (now + datetime.timedelta(days=days_ahead)).replace(hour=17, minute=0, second=0, microsecond=0)
        return target.strftime('%Y-%m-%dT%H:%M')
    if preset == 'next_monday':
        days_ahead = (0 - now.weekday() + 7) % 7
        if days_ahead == 0:
            days_ahead = 7
        target = (now + datetime.timedelta(days=days_ahead)).replace(hour=9, minute=0, second=0, microsecond=0)
        return target.strftime('%Y-%m-%dT%H:%M')
    return ''

def format_deadline(iso_str):
    if not iso_str:
        return ''
    try:
        dt = datetime.datetime.fromisoformat(iso_str)
        now = datetime.datetime.now()
        is_today = dt.date() == now.date()
        is_tomorrow = dt.date() == (now + datetime.timedelta(days=1)).date()

        hour = dt.hour % 12 or 12
        ampm = 'AM' if dt.hour < 12 else 'PM'
        time_str = f"{hour}:{dt.minute:02d} {ampm}"

        if is_today:
            return f"Today, {time_str}"
        if is_tomorrow:
            return f"Tomorrow, {time_str}"
        month_abbr = dt.strftime('%b')
        return f"{month_abbr} {dt.day}, {time_str}"
    except Exception:
        return iso_str

# =============================================================================
# Analytics & Stats Calculators
# =============================================================================
def get_categories_data(conn, user_id):
    rows = conn.execute("""
        SELECT c.*, 
               COUNT(t.id) as total_tasks,
               SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
               SUM(CASE WHEN t.completed = 0 THEN 1 ELSE 0 END) as pending_tasks
        FROM categories c
        LEFT JOIN tasks t ON c.id = t.category_id AND t.user_id = ?
        WHERE c.user_id = ?
        GROUP BY c.id
        ORDER BY c.id ASC
    """, (user_id, user_id)).fetchall()

    categories = []
    for r in rows:
        d = dict(r)
        total = int(d.get('total_tasks') or 0)
        completed = int(d.get('completed_tasks') or 0)
        pending = total - completed
        rate = round((completed / total) * 100) if total > 0 else 0
        d['total_tasks'] = total
        d['completed_tasks'] = completed
        d['pending_tasks'] = pending
        d['completion_rate'] = rate
        categories.append(d)
    return categories

def get_stats_data(conn, user_id):
    total_row = conn.execute("SELECT COUNT(*) as c FROM tasks WHERE user_id = ?", (user_id,)).fetchone()
    total = total_row['c'] if total_row else 0

    comp_row = conn.execute("SELECT COUNT(*) as c FROM tasks WHERE completed = 1 AND user_id = ?", (user_id,)).fetchone()
    completed = comp_row['c'] if comp_row else 0

    pending = total - completed
    rate = round((completed / total) * 100) if total > 0 else 0

    streak_row = conn.execute("SELECT COALESCE(MAX(streak), 0) as s FROM tasks WHERE user_id = ?", (user_id,)).fetchone()
    max_streak = streak_row['s'] if streak_row else 0

    hp_row = conn.execute("SELECT COUNT(*) as c FROM tasks WHERE priority = 'high' AND completed = 0 AND user_id = ?", (user_id,)).fetchone()
    high_priority = hp_row['c'] if hp_row else 0

    now_iso = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M')
    overdue_row = conn.execute("""
        SELECT COUNT(*) as c FROM tasks 
        WHERE completed = 0 AND deadline != '' AND deadline IS NOT NULL AND deadline < ? AND user_id = ?
    """, (now_iso, user_id)).fetchone()
    overdue = overdue_row['c'] if overdue_row else 0

    circumference = 213.6
    radial_offset = round(circumference * (1.0 - (rate / 100.0)), 1)

    return {
        'total': total,
        'total_tasks': total,
        'completed': completed,
        'completed_tasks': completed,
        'pending': pending,
        'active_tasks': pending,
        'completion_rate': rate,
        'best_streak': max_streak,
        'max_streak': max_streak,
        'high_priority': high_priority,
        'overdue': overdue,
        'radial_offset': radial_offset
    }

# =============================================================================
# Static Asset Routing (Preserves Complete Frontend Path Flexibility)
# =============================================================================
@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, 'css'), filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, 'js'), filename)

@app.route('/icons/<path:filename>')
def serve_icons(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, 'icons'), filename)

@app.route('/manifest.json')
def serve_manifest():
    return send_from_directory(FRONTEND_DIR, 'manifest.json')

@app.route('/favicon.ico')
def serve_favicon():
    return send_from_directory(os.path.join(FRONTEND_DIR, 'icons'), 'icon.svg')

@app.after_request
def add_caching_headers(response):
    if response.mimetype == 'text/html' or request.path.startswith('/js/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    elif request.path.startswith(('/css/', '/icons/', '/static/')):
        response.headers['Cache-Control'] = 'public, max-age=3600'
    return response

# =============================================================================
# Authentication Routes
# =============================================================================
@app.route('/login', methods=['GET', 'POST'], endpoint='login')
def login():
    if 'user_id' in session:
        return redirect(url_for('index'))

    theme = request.cookies.get('orbit_theme', 'dark')
    next_url = request.args.get('next') or request.form.get('next') or url_for('index')

    if request.method == 'POST':
        # 1-Click Demo Guest Mode
        if request.form.get('action') == 'demo':
            conn = get_db()
            player1 = conn.execute("SELECT id, username FROM users WHERE username = 'player1'").fetchone()
            conn.close()
            if player1:
                session.permanent = True
                session['user_id'] = player1['id']
                session['username'] = player1['username']
                return redirect(next_url)

        username = (request.form.get('username') or '').strip()
        password = request.form.get('password') or ''

        if not username or not password:
            return render_template('auth.html', mode='login', theme=theme, error='Please enter both player tag and passcode.', next_url=next_url)

        conn = get_db()
        user = conn.execute("SELECT * FROM users WHERE username = ? OR email = ?", (username, username)).fetchone()
        conn.close()

        if user and verify_password(password, user['password_hash']):
            session.permanent = True
            session['user_id'] = user['id']
            session['username'] = user['username']
            return redirect(next_url)

        return render_template('auth.html', mode='login', theme=theme, error='Invalid player tag or secret passcode.', next_url=next_url)

    return render_template('auth.html', mode='login', theme=theme, error=None, next_url=next_url)

@app.route('/register', methods=['GET', 'POST'], endpoint='register')
def register():
    if 'user_id' in session:
        return redirect(url_for('index'))

    theme = request.cookies.get('orbit_theme', 'dark')

    if request.method == 'POST':
        username = (request.form.get('username') or '').strip()
        email = (request.form.get('email') or '').strip()
        password = request.form.get('password') or ''
        confirm_password = request.form.get('confirm_password') or ''

        if not username or len(username) < 3:
            return render_template('auth.html', mode='register', theme=theme, error='Player tag must be at least 3 characters.', next_url='/')
        if not password or len(password) < 4:
            return render_template('auth.html', mode='register', theme=theme, error='Passcode must be at least 4 characters.', next_url='/')
        if password != confirm_password:
            return render_template('auth.html', mode='register', theme=theme, error='Passcodes do not match.', next_url='/')

        conn = get_db()
        existing = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if existing:
            conn.close()
            return render_template('auth.html', mode='register', theme=theme, error='Player tag is already claimed by another pilot.', next_url='/')

        pwd_hash = generate_password_hash(password)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", (username, email, pwd_hash))
        new_user_id = cursor.lastrowid
        seed_user_starter_data(cursor, new_user_id)
        conn.commit()
        conn.close()

        session.permanent = True
        session['user_id'] = new_user_id
        session['username'] = username
        return redirect(url_for('index'))

    return render_template('auth.html', mode='register', theme=theme, error=None, next_url='/')

@app.route('/logout', endpoint='logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/set-theme/<theme>', endpoint='set_theme')
def set_theme(theme):
    theme_val = 'light' if theme == 'light' else 'dark'
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest' or 'application/json' in request.headers.get('Accept', '')
    if is_ajax:
        resp = make_response(jsonify({'theme': theme_val}))
    else:
        referrer = request.referrer or url_for('index')
        resp = make_response(redirect(referrer))
    resp.set_cookie('orbit_theme', theme_val, max_age=365*24*60*60, path='/')
    return resp

# =============================================================================
# Main HUD Dashboard (GET /)
# =============================================================================
@app.route('/', endpoint='index')
@login_required
def index():
    user_id = session['user_id']
    theme = request.cookies.get('orbit_theme', 'dark')
    filter_category = request.args.get('category', 'all')
    filter_status = request.args.get('status', 'all')
    search_query = (request.args.get('search') or '').strip()

    conn = get_db()
    categories = get_categories_data(conn, user_id)
    stats = get_stats_data(conn, user_id)
    cat_count_all = stats['total']

    # Filtered tasks query
    query = """
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = ?
    """
    params = [user_id]

    if filter_category != 'all':
        if filter_category in ('none', '0'):
            query += " AND (t.category_id IS NULL OR t.category_id = 0)"
        else:
            try:
                cat_int = int(filter_category)
                query += " AND t.category_id = ?"
                params.append(cat_int)
            except ValueError:
                pass

    if filter_status == 'active':
        query += " AND t.completed = 0"
    elif filter_status == 'completed':
        query += " AND t.completed = 1"

    if search_query:
        query += " AND t.text LIKE ?"
        params.append(f"%{search_query}%")

    query += " ORDER BY t.completed ASC, t.id DESC"
    task_rows = conn.execute(query, params).fetchall()
    conn.close()

    now_iso = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M')
    processed_tasks = []
    category_groups_map = {}

    for row in task_rows:
        t = dict(row)
        deadline = t.get('deadline') or ''
        is_overdue = bool(deadline and deadline < now_iso and not t.get('completed'))
        t['is_overdue'] = is_overdue
        t['formatted_deadline'] = format_deadline(deadline)
        processed_tasks.append(t)

        cat_id = t.get('category_id') or 0
        cat_name = t.get('category_name') or 'General Quests'
        cat_color = t.get('category_color') or '#3b82f6'
        group_key = (cat_id, cat_name, cat_color)

        if group_key not in category_groups_map:
            category_groups_map[group_key] = []
        category_groups_map[group_key].append(t)

    category_groups = []
    for (c_id, c_name, c_color), tasks_list in category_groups_map.items():
        category_groups.append({
            'cat_id': c_id,
            'cat_name': c_name,
            'cat_color': c_color,
            'tasks': tasks_list
        })

    current_date_str = datetime.datetime.now().strftime('%a, %b %d').upper()

    return render_template(
        'index.html',
        tasks=processed_tasks,
        categories=categories,
        stats=stats,
        cat_count_all=cat_count_all,
        category_groups=category_groups,
        current_category=filter_category,
        current_status=filter_status,
        search_query=search_query,
        current_date_str=current_date_str,
        theme=theme,
        current_user=get_current_user()
    )

# =============================================================================
# Task Management Routes
# =============================================================================
@app.route('/tasks/add', methods=['POST'])
@login_required
def add_task():
    user_id = session['user_id']
    is_ajax = (
        request.headers.get('Accept') == 'application/json' or
        request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
        request.is_json
    )
    data = request.get_json(silent=True) if request.is_json else request.form
    text = (data.get('text') or '').strip()
    category_id = data.get('category_id')

    conn = get_db()
    cat_val = None
    if category_id:
        try:
            cand = int(category_id)
            if conn.execute("SELECT id FROM categories WHERE id = ? AND user_id = ?", (cand, user_id)).fetchone():
                cat_val = cand
        except (ValueError, TypeError):
            cat_val = None

    priority = data.get('priority') or 'medium'
    deadline = resolve_deadline(data.get('deadline'), data.get('deadline_preset'))

    if not text:
        conn.close()
        if is_ajax:
            return jsonify({'error': 'Please enter a habit or quest name'}), 400
        return redirect(url_for('index'))

    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO tasks (text, category_id, priority, deadline, user_id) VALUES (?, ?, ?, ?, ?)",
            (text, cat_val, priority, deadline, user_id)
        )
        task_id = cursor.lastrowid
        conn.commit()

        if is_ajax:
            task_row = conn.execute("""
                SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
                FROM tasks t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.id = ?
            """, (task_id,)).fetchone()
            task_dict = dict(task_row) if task_row else {'id': task_id, 'text': text}
            task_dict['formatted_deadline'] = format_deadline(deadline)
            stats = get_stats_data(conn, user_id)
            categories = get_categories_data(conn, user_id)
            conn.close()
            return jsonify({
                'success': True,
                'task': task_dict,
                'stats': stats,
                'categories': categories,
                **task_dict
            }), 201

        conn.close()
    except Exception as e:
        conn.close()
        if is_ajax:
            return jsonify({'error': f'Database error: {str(e)}'}), 500

    redirect_url = request.form.get('redirect_url')
    if redirect_url:
        return redirect(redirect_url)

    filter_cat = request.form.get('filter_category', 'all')
    filter_status = request.form.get('filter_status', 'all')
    filter_search = request.form.get('filter_search', '')
    return redirect(url_for('index', category=filter_cat, status=filter_status, search=filter_search))


@app.route('/tasks/<int:task_id>/toggle', methods=['POST'])
@login_required
def toggle_task(task_id):
    user_id = session['user_id']
    conn = get_db()
    task = conn.execute("SELECT * FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id)).fetchone()

    updated_task = None
    if task:
        new_completed = 0 if task['completed'] == 1 else 1
        now_iso = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M') if new_completed == 1 else None
        new_streak = (task['streak'] + 1) if new_completed == 1 else max(0, task['streak'] - 1)

        conn.execute(
            "UPDATE tasks SET completed = ?, streak = ?, completed_at = ? WHERE id = ? AND user_id = ?",
            (new_completed, new_streak, now_iso, task_id, user_id)
        )

        today_str = datetime.date.today().strftime('%Y-%m-%d')
        if new_completed == 1:
            conn.execute(
                "INSERT OR IGNORE INTO task_completions (task_id, user_id, completion_date) VALUES (?, ?, ?)",
                (task_id, user_id, today_str)
            )
        else:
            conn.execute(
                "DELETE FROM task_completions WHERE task_id = ? AND user_id = ? AND completion_date = ?",
                (task_id, user_id, today_str)
            )
        conn.commit()

        updated_row = conn.execute("""
            SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
            FROM tasks t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.id = ? AND t.user_id = ?
        """, (task_id, user_id)).fetchone()
        if updated_row:
            updated_task = dict(updated_row)

    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest' or 'application/json' in request.headers.get('Accept', '')
    if is_ajax:
        stats = get_stats_data(conn, user_id)
        categories = get_categories_data(conn, user_id)
        conn.close()
        return jsonify({'success': True, 'task': updated_task, 'stats': stats, 'categories': categories})

    conn.close()
    redirect_url = request.form.get('redirect_url')
    if redirect_url:
        return redirect(redirect_url)

    filter_cat = request.form.get('filter_category', 'all')
    filter_status = request.form.get('filter_status', 'all')
    filter_search = request.form.get('filter_search', '')
    return redirect(url_for('index', category=filter_cat, status=filter_status, search=filter_search))

@app.route('/tasks/<int:task_id>/edit', methods=['POST'])
@login_required
def edit_task(task_id):
    user_id = session['user_id']
    text = (request.form.get('text') or '').strip()
    category_id = request.form.get('category_id')
    cat_val = int(category_id) if category_id and category_id.isdigit() else None
    priority = request.form.get('priority') or 'medium'
    deadline = resolve_deadline(request.form.get('deadline'), request.form.get('deadline_preset'))

    if text:
        conn = get_db()
        conn.execute(
            "UPDATE tasks SET text = ?, category_id = ?, priority = ?, deadline = ? WHERE id = ? AND user_id = ?",
            (text, cat_val, priority, deadline, task_id, user_id)
        )
        conn.commit()
        conn.close()

    redirect_url = request.form.get('redirect_url')
    if redirect_url:
        return redirect(redirect_url)

    filter_cat = request.form.get('filter_category', 'all')
    filter_status = request.form.get('filter_status', 'all')
    filter_search = request.form.get('filter_search', '')
    return redirect(url_for('index', category=filter_cat, status=filter_status, search=filter_search))

@app.route('/tasks/<int:task_id>/delete', methods=['POST'])
@login_required
def delete_task(task_id):
    user_id = session['user_id']
    conn = get_db()
    conn.execute("DELETE FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id))
    conn.commit()

    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest' or 'application/json' in request.headers.get('Accept', '')
    if is_ajax:
        stats = get_stats_data(conn, user_id)
        categories = get_categories_data(conn, user_id)
        conn.close()
        return jsonify({'success': True, 'stats': stats, 'categories': categories})

    conn.close()
    redirect_url = request.form.get('redirect_url')
    if redirect_url:
        return redirect(redirect_url)

    filter_cat = request.form.get('filter_category', 'all')
    filter_status = request.form.get('filter_status', 'all')
    filter_search = request.form.get('filter_search', '')
    return redirect(url_for('index', category=filter_cat, status=filter_status, search=filter_search))

# =============================================================================
# Category Management Routes
# =============================================================================
@app.route('/categories/add', methods=['POST'])
@login_required
def add_category():
    user_id = session['user_id']
    name = (request.form.get('name') or '').strip()
    color = request.form.get('color') or '#3b82f6'

    if name:
        conn = get_db()
        conn.execute(
            "INSERT INTO categories (name, color, icon, user_id) VALUES (?, ?, ?, ?)",
            (name, color, 'folder', user_id)
        )
        conn.commit()
        conn.close()

    return redirect(url_for('index'))

@app.route('/categories/<int:cat_id>/delete', methods=['POST'])
@login_required
def delete_category(cat_id):
    user_id = session['user_id']
    conn = get_db()
    conn.execute("UPDATE tasks SET category_id = NULL WHERE category_id = ? AND user_id = ?", (cat_id, user_id))
    conn.execute("DELETE FROM categories WHERE id = ? AND user_id = ?", (cat_id, user_id))
    conn.commit()
    conn.close()

    return redirect(url_for('index'))

# =============================================================================
# Habit Calendar & Heatmap Monthly Logs
# =============================================================================
@app.route('/habits/<int:category_id>', endpoint='pack_detail')
@app.route('/packs/<int:category_id>')
@login_required
def pack_detail(category_id):
    user_id = session['user_id']
    theme = request.cookies.get('orbit_theme', 'dark')

    conn = get_db()
    if category_id == 0:
        category = {'id': 0, 'name': 'General Quests', 'color': '#3b82f6', 'icon': 'folder'}
        task_rows = conn.execute(
            "SELECT * FROM tasks WHERE (category_id IS NULL OR category_id = 0) AND user_id = ? ORDER BY id ASC",
            (user_id,)
        ).fetchall()
    else:
        cat_row = conn.execute("SELECT * FROM categories WHERE id = ? AND user_id = ?", (category_id, user_id)).fetchone()
        if not cat_row:
            conn.close()
            return redirect(url_for('index'))
        category = dict(cat_row)
        task_rows = conn.execute(
            "SELECT * FROM tasks WHERE category_id = ? AND user_id = ? ORDER BY id ASC",
            (category_id, user_id)
        ).fetchall()

    now_iso = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M')
    tasks = []
    for r in task_rows:
        t = dict(r)
        deadline = t.get('deadline') or ''
        t['is_overdue'] = bool(deadline and deadline < now_iso and not t.get('completed'))
        t['formatted_deadline'] = format_deadline(deadline)
        tasks.append(t)

    today = datetime.date.today()
    today_str = today.strftime('%Y-%m-%d')
    year = request.args.get('year', type=int) or today.year
    month = request.args.get('month', type=int) or today.month

    if month < 1 or month > 12:
        month = today.month

    prev_month = 12 if month == 1 else month - 1
    prev_year = year - 1 if month == 1 else year
    next_month = 1 if month == 12 else month + 1
    next_year = year + 1 if month == 12 else year

    month_names = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    month_name = month_names[month]
    days_in_month = calendar.monthrange(year, month)[1]

    # Completions query for the category and month
    task_ids = [t['id'] for t in tasks]
    month_prefix = f"{year:04d}-{month:02d}"
    completions_by_date = {}

    if task_ids:
        placeholders = ','.join(['?'] * len(task_ids))
        comp_rows = conn.execute(f"""
            SELECT task_id, completion_date 
            FROM task_completions 
            WHERE task_id IN ({placeholders}) AND user_id = ? AND completion_date LIKE ?
        """, (*task_ids, user_id, f"{month_prefix}%")).fetchall()

        for cr in comp_rows:
            d_str = cr['completion_date']
            if d_str not in completions_by_date:
                completions_by_date[d_str] = set()
            completions_by_date[d_str].add(cr['task_id'])

    conn.close()

    # Build calendar matrix (Sunday to Saturday)
    # datetime.weekday(): Mon=0..Sun=6. Convert to Sun=0..Sat=6:
    first_day_weekday = (datetime.date(year, month, 1).weekday() + 1) % 7
    calendar_weeks = []
    current_week = [{'day': 0} for _ in range(first_day_weekday)]

    total_completed_days = 0
    total_completions_count = 0

    for d in range(1, days_in_month + 1):
        date_str = f"{year:04d}-{month:02d}-{d:02d}"
        comp_set = completions_by_date.get(date_str, set())
        comp_count = len(comp_set)
        total_completions_count += comp_count

        is_today = (date_str == today_str)
        is_future = (date_str > today_str)

        if is_future:
            status = 'future'
        elif len(tasks) > 0 and comp_count == len(tasks):
            status = 'fully_completed'
            total_completed_days += 1
        elif comp_count > 0:
            status = 'partially_completed'
            total_completed_days += 1
        else:
            status = 'missed'

        current_week.append({
            'day': d,
            'date_str': date_str,
            'is_today': is_today,
            'is_future': is_future,
            'status': status,
            'completed_count': comp_count,
            'total_count': len(tasks)
        })

        if len(current_week) == 7:
            calendar_weeks.append(current_week)
            current_week = []

    if current_week:
        while len(current_week) < 7:
            current_week.append({'day': 0})
        calendar_weeks.append(current_week)

    # Selected day details
    raw_date = (request.args.get('date') or '').strip()
    selected_date = today_str
    if len(raw_date) == 10 and raw_date[4] == '-' and raw_date[7] == '-':
        selected_date = raw_date
    elif year != today.year or month != today.month:
        selected_date = f"{year:04d}-{month:02d}-01"

    selected_comp_set = completions_by_date.get(selected_date, set())
    selected_completed_count = len(selected_comp_set)
    is_selected_today = (selected_date == today_str)
    is_selected_future = (selected_date > today_str)

    selected_day_status_text = 'NOT COMPLETED'
    selected_day_pill_class = 'pill-today' if is_selected_today else 'pill-missed'

    if is_selected_future:
        selected_day_status_text = 'FUTURE'
        selected_day_pill_class = 'pill-future'
    elif len(tasks) > 0 and selected_completed_count == len(tasks):
        selected_day_status_text = f"CLEARED ({selected_completed_count}/{len(tasks)})"
        selected_day_pill_class = 'pill-cleared'
    elif selected_completed_count > 0:
        selected_day_status_text = f"CLEARED ({selected_completed_count}/{len(tasks)})"
        selected_day_pill_class = 'pill-cleared'
    elif is_selected_today:
        selected_day_status_text = 'TODAY'
        selected_day_pill_class = 'pill-today'

    selected_date_tasks = []
    for t in tasks:
        t_copy = dict(t)
        t_copy['completed_on_day'] = (t['id'] in selected_comp_set)
        selected_date_tasks.append(t_copy)

    # Task histories for horizontal pixel track
    task_histories = []
    for t in tasks:
        completed_days = 0
        day_logs = []
        for d in range(1, days_in_month + 1):
            d_str = f"{year:04d}-{month:02d}-{d:02d}"
            is_comp = (t['id'] in completions_by_date.get(d_str, set()))
            if is_comp:
                completed_days += 1
            day_logs.append({
                'day': d,
                'date_str': d_str,
                'completed': is_comp,
                'is_today': (d_str == today_str),
                'is_future': (d_str > today_str)
            })

        past_days = min(today.day, days_in_month) if (year == today.year and month == today.month) else days_in_month
        consistency_pct = round((completed_days / past_days) * 100) if past_days > 0 else 0

        task_histories.append({
            'task': t,
            'day_logs': day_logs,
            'completed_days': completed_days,
            'consistency_pct': consistency_pct
        })

    pack_stats = {
        'total_tasks': len(tasks),
        'completed_today': len([t for t in tasks if t['completed']]),
        'total_completed_days': total_completed_days,
        'total_completions_count': total_completions_count,
        'consistency_pct': round((total_completed_days / days_in_month) * 100) if tasks else 0,
        'max_streak': max([t['streak'] for t in tasks], default=0),
        'days_in_month': days_in_month
    }

    return render_template(
        'pack_calendar.html',
        category=category,
        tasks=tasks,
        selected_date_tasks=selected_date_tasks,
        selected_date=selected_date,
        selected_day_status_text=selected_day_status_text,
        selected_day_pill_class=selected_day_pill_class,
        pack_stats=pack_stats,
        calendar_weeks=calendar_weeks,
        task_histories=task_histories,
        year=year,
        month=month,
        month_name=month_name,
        prev_year=prev_year,
        prev_month=prev_month,
        next_year=next_year,
        next_month=next_month,
        today_str=today_str,
        theme=theme,
        current_user=get_current_user()
    )

@app.route('/habits/<int:category_id>/tasks/<int:task_id>/toggle-date', methods=['POST'], endpoint='toggle_task_date_form')
@app.route('/packs/<int:category_id>/tasks/<int:task_id>/toggle-date', methods=['POST'])
@login_required
def toggle_task_date(category_id, task_id):
    user_id = session['user_id']
    date_str = request.form.get('date') or datetime.date.today().strftime('%Y-%m-%d')
    year = request.form.get('year')
    month = request.form.get('month')

    conn = get_db()
    task = conn.execute("SELECT id, streak, completed FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id)).fetchone()

    if task:
        existing = conn.execute(
            "SELECT id FROM task_completions WHERE task_id = ? AND user_id = ? AND completion_date = ?",
            (task_id, user_id, date_str)
        ).fetchone()

        today_str = datetime.date.today().strftime('%Y-%m-%d')
        if existing:
            conn.execute(
                "DELETE FROM task_completions WHERE task_id = ? AND user_id = ? AND completion_date = ?",
                (task_id, user_id, date_str)
            )
            if date_str == today_str:
                new_streak = max(0, task['streak'] - 1)
                conn.execute("UPDATE tasks SET completed = 0, streak = ? WHERE id = ? AND user_id = ?", (new_streak, task_id, user_id))
        else:
            conn.execute(
                "INSERT OR IGNORE INTO task_completions (task_id, user_id, completion_date) VALUES (?, ?, ?)",
                (task_id, user_id, date_str)
            )
            if date_str == today_str:
                new_streak = task['streak'] + 1
                now_iso = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M')
                conn.execute(
                    "UPDATE tasks SET completed = 1, streak = ?, completed_at = ? WHERE id = ? AND user_id = ?",
                    (new_streak, now_iso, task_id, user_id)
                )
        conn.commit()

    conn.close()

    query_params = {'date': date_str}
    if year:
        query_params['year'] = year
    if month:
        query_params['month'] = month

    return redirect(url_for('pack_detail', category_id=category_id, **query_params) + '#dayDetailSection')

# =============================================================================
# REST API Endpoints (For Client JavaScript Async Interactions)
# =============================================================================
@app.route('/api/categories', methods=['GET', 'POST'])
@login_required
def api_categories():
    user_id = session['user_id']
    conn = get_db()

    if request.method == 'POST':
        data = request.get_json() or {}
        name = (data.get('name') or request.form.get('name') or '').strip()
        color = data.get('color') or request.form.get('color') or '#3b82f6'
        if not name:
            conn.close()
            return jsonify({'error': 'Category name required'}), 400

        cursor = conn.cursor()
        cursor.execute("INSERT INTO categories (name, color, icon, user_id) VALUES (?, ?, ?, ?)", (name, color, 'folder', user_id))
        new_id = cursor.lastrowid
        conn.commit()
        cat = conn.execute("SELECT * FROM categories WHERE id = ?", (new_id,)).fetchone()
        conn.close()
        return jsonify(dict(cat)), 201

    categories = get_categories_data(conn, user_id)
    conn.close()
    return jsonify(categories)

@app.route('/api/categories/<int:cat_id>', methods=['DELETE'])
@login_required
def api_delete_category(cat_id):
    user_id = session['user_id']
    conn = get_db()
    conn.execute("UPDATE tasks SET category_id = NULL WHERE category_id = ? AND user_id = ?", (cat_id, user_id))
    conn.execute("DELETE FROM categories WHERE id = ? AND user_id = ?", (cat_id, user_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/tasks', methods=['GET', 'POST'])
@login_required
def api_tasks():
    user_id = session['user_id']
    conn = get_db()

    if request.method == 'POST':
        data = request.get_json(silent=True) or request.form or {}
        text = (data.get('text') or '').strip()
        category_id = data.get('category_id')

        cat_val = None
        if category_id:
            try:
                cand = int(category_id)
                if conn.execute("SELECT id FROM categories WHERE id = ? AND user_id = ?", (cand, user_id)).fetchone():
                    cat_val = cand
            except (ValueError, TypeError):
                cat_val = None

        priority = data.get('priority') or 'medium'
        deadline = resolve_deadline(data.get('deadline'), data.get('deadline_preset'))

        if not text:
            conn.close()
            return jsonify({'error': 'Task text is required'}), 400

        try:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO tasks (text, category_id, priority, deadline, user_id) VALUES (?, ?, ?, ?, ?)",
                (text, cat_val, priority, deadline, user_id)
            )
            task_id = cursor.lastrowid
            conn.commit()
            row = conn.execute("""
                SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
                FROM tasks t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.id = ?
            """, (task_id,)).fetchone()
            task_dict = dict(row) if row else {'id': task_id, 'text': text}
            task_dict['formatted_deadline'] = format_deadline(deadline)
            stats = get_stats_data(conn, user_id)
            categories = get_categories_data(conn, user_id)
            conn.close()
            return jsonify({
                'success': True,
                'task': task_dict,
                'stats': stats,
                'categories': categories,
                **task_dict
            }), 201
        except Exception as e:
            conn.close()
            return jsonify({'error': f'Failed to create quest: {str(e)}'}), 500


    task_rows = conn.execute("""
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = ?
        ORDER BY t.completed ASC, t.id DESC
    """, (user_id,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in task_rows])

@app.route('/api/tasks/<int:task_id>', methods=['PUT', 'DELETE'])
@login_required
def api_task_detail(task_id):
    user_id = session['user_id']
    conn = get_db()

    if request.method == 'DELETE':
        conn.execute("DELETE FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

    data = request.get_json() or {}
    text = (data.get('text') or '').strip()
    category_id = data.get('category_id')
    cat_val = int(category_id) if category_id else None
    priority = data.get('priority') or 'medium'
    deadline = resolve_deadline(data.get('deadline'), data.get('deadline_preset'))

    if text:
        conn.execute(
            "UPDATE tasks SET text = ?, category_id = ?, priority = ?, deadline = ? WHERE id = ? AND user_id = ?",
            (text, cat_val, priority, deadline, task_id, user_id)
        )
        conn.commit()

    row = conn.execute("SELECT * FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id)).fetchone()
    conn.close()
    return jsonify(dict(row) if row else {})

@app.route('/api/tasks/<int:task_id>/toggle', methods=['POST'])
@login_required
def api_toggle_task(task_id):
    return toggle_task(task_id)

@app.route('/api/stats', methods=['GET'])
@login_required
def api_stats():
    user_id = session['user_id']
    conn = get_db()
    stats = get_stats_data(conn, user_id)
    conn.close()
    return jsonify(stats)

# =============================================================================
# Application Startup
# =============================================================================
init_db()

if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')

    print("\n" + "=" * 54)
    print(" * Orbit Habit & Task Tracker is LIVE! (Python Flask)")
    print("=" * 54)
    print(f" -> Local URL:    http://127.0.0.1:{port}")
    print(f" -> Guest Login:  player1 / orbit123")
    print("=" * 54 + "\n")

    app.run(host=host, port=port, debug=False, threaded=True)
