import os
import sqlite3
import re
import calendar
from datetime import datetime, date, timedelta
from functools import wraps
from flask import (
    Flask, render_template, request, jsonify, redirect,
    url_for, make_response, send_from_directory, session
)
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'orbit-arcade-session-secret-2026-key-!#891')
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'habits.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Create users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT,
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 2. Seed default demo user (player1 / orbit123)
    cursor.execute("SELECT id FROM users WHERE username = 'player1'")
    player_row = cursor.fetchone()
    if not player_row:
        default_hash = generate_password_hash('orbit123')
        cursor.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            ('player1', 'player1@orbit.quest', default_hash)
        )
        conn.commit()
        default_user_id = cursor.lastrowid
    else:
        default_user_id = player_row[0]

    # 3. Create or migrate categories table (user-scoped)
    cursor.execute("PRAGMA table_info(categories)")
    cat_cols = [c[1] for c in cursor.fetchall()]
    if not cat_cols:
        cursor.execute('''
            CREATE TABLE categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#6366f1',
                icon TEXT DEFAULT 'folder',
                user_id INTEGER,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        conn.commit()
    elif 'user_id' not in cat_cols:
        # Recreate without global UNIQUE constraint so different users can have categories with same names
        cursor.execute('''
            CREATE TABLE categories_v2 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#6366f1',
                icon TEXT DEFAULT 'folder',
                user_id INTEGER,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        cursor.execute('''
            INSERT INTO categories_v2 (id, name, color, icon, user_id)
            SELECT id, name, color, icon, ? FROM categories
        ''', (default_user_id,))
        cursor.execute("DROP TABLE categories")
        cursor.execute("ALTER TABLE categories_v2 RENAME TO categories")
        conn.commit()
    
    # 4. Create or migrate tasks table (user-scoped)
    cursor.execute("PRAGMA table_info(tasks)")
    task_cols = [c[1] for c in cursor.fetchall()]
    if not task_cols:
        cursor.execute('''
            CREATE TABLE tasks (
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
            )
        ''')
        conn.commit()
    elif 'user_id' not in task_cols:
        cursor.execute(f"ALTER TABLE tasks ADD COLUMN user_id INTEGER DEFAULT {int(default_user_id)}")
        cursor.execute("UPDATE tasks SET user_id = ? WHERE user_id IS NULL", (default_user_id,))
        conn.commit()

    # 5. Ensure default categories exist for default user if empty
    cursor.execute("SELECT COUNT(*) FROM categories WHERE user_id = ?", (default_user_id,))
    if cursor.fetchone()[0] == 0:
        seed_user_defaults(conn, default_user_id)

    # 6. Create task_completions table for historical calendar tracking
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS task_completions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            completion_date TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(task_id, completion_date),
            FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_completions_task ON task_completions(task_id, completion_date)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_completions_user_date ON task_completions(user_id, completion_date)')
    conn.commit()

    # Seed completions from existing completed tasks if empty
    cursor.execute("SELECT COUNT(*) FROM task_completions")
    if cursor.fetchone()[0] == 0:
        seed_historical_completions(conn)

    conn.close()

def seed_user_defaults(conn, user_id):
    cursor = conn.cursor()
    default_categories = [
        ('Daily Goals', '#10b981', 'target'),
        ('Regular Tasks', '#6366f1', 'check-square'),
        ('Health & Wellness', '#ec4899', 'heart'),
        ('Deep Work', '#8b5cf6', 'zap')
    ]
    for name, color, icon in default_categories:
        cursor.execute(
            'INSERT INTO categories (name, color, icon, user_id) VALUES (?, ?, ?, ?)',
            (name, color, icon, user_id)
        )
    conn.commit()

    cat_ids = {}
    for name, _, _ in default_categories:
        cursor.execute("SELECT id FROM categories WHERE name = ? AND user_id = ?", (name, user_id))
        cat_ids[name] = cursor.fetchone()[0]

    now = datetime.now()
    today_evening = now.replace(hour=18, minute=0, second=0).strftime('%Y-%m-%dT%H:%M')
    today_night = now.replace(hour=22, minute=0, second=0).strftime('%Y-%m-%dT%H:%M')
    tomorrow_morning = (now + timedelta(days=1)).replace(hour=9, minute=0, second=0).strftime('%Y-%m-%dT%H:%M')
    in_2_days = (now + timedelta(days=2)).replace(hour=14, minute=0, second=0).strftime('%Y-%m-%dT%H:%M')
    friday = (now + timedelta(days=(4 - now.weekday()) % 7)).replace(hour=17, minute=0, second=0).strftime('%Y-%m-%dT%H:%M')

    initial_tasks = [
        # Daily Goals
        ('💧 Drink 2.5L water & stay hydrated', cat_ids['Daily Goals'], 1, today_evening, 'high', 7, now.isoformat(), user_id),
        ('☀️ 15-minute morning sunlight & mobility stretch', cat_ids['Daily Goals'], 1, today_evening, 'medium', 5, now.isoformat(), user_id),
        ('📖 Read 15 pages of non-fiction or tech book', cat_ids['Daily Goals'], 0, today_night, 'medium', 3, None, user_id),
        ('📵 Digital sunset: No screens 45 mins before bed', cat_ids['Daily Goals'], 0, today_night, 'low', 2, None, user_id),

        # Health & Wellness
        ('🏃‍♂️ 5km outdoor jog or high-intensity interval run', cat_ids['Health & Wellness'], 1, today_evening, 'high', 4, now.isoformat(), user_id),
        ('🥗 Meal prep nutritious high-protein lunches for the week', cat_ids['Health & Wellness'], 0, tomorrow_morning, 'medium', 1, None, user_id),
        ('🧘 10-minute mindfulness & breathwork session', cat_ids['Health & Wellness'], 0, today_night, 'low', 6, None, user_id),

        # Deep Work
        ('⚡ 2-hour uninterrupted focus block on core feature architecture', cat_ids['Deep Work'], 1, today_evening, 'high', 8, now.isoformat(), user_id),
        ('🧪 Refactor authentication middleware & unit tests', cat_ids['Deep Work'], 0, tomorrow_morning, 'high', 0, None, user_id),
        ('📝 Write comprehensive API documentation & changelog', cat_ids['Deep Work'], 0, friday, 'medium', 0, None, user_id),

        # Regular Tasks
        ('📬 Zero out inbox & clear pending pull request reviews', cat_ids['Regular Tasks'], 1, today_evening, 'medium', 3, now.isoformat(), user_id),
        ('💼 Review quarterly OKR milestones & sprint board', cat_ids['Regular Tasks'], 0, in_2_days, 'high', 0, None, user_id),
        ('🧹 Clean desk workspace & organize backup drive', cat_ids['Regular Tasks'], 0, friday, 'low', 1, None, user_id)
    ]

    cursor.executemany(
        'INSERT INTO tasks (text, category_id, completed, deadline, priority, streak, completed_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        initial_tasks
    )
    conn.commit()

def seed_historical_completions(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT id, user_id, completed, streak, completed_at FROM tasks")
    tasks = cursor.fetchall()
    today = date.today()

    for task_id, user_id, completed, streak, completed_at in tasks:
        if completed:
            comp_date = completed_at[:10] if completed_at else today.isoformat()
            cursor.execute(
                "INSERT OR IGNORE INTO task_completions (task_id, user_id, completion_date) VALUES (?, ?, ?)",
                (task_id, user_id, comp_date)
            )
        if streak and streak > 0:
            if completed and completed_at:
                try:
                    ref_date = datetime.fromisoformat(completed_at[:10]).date()
                except Exception:
                    ref_date = today
            elif completed:
                ref_date = today
            else:
                ref_date = today - timedelta(days=1)

            for day_offset in range(min(streak, 28)):
                past_date = (ref_date - timedelta(days=day_offset)).isoformat()
                cursor.execute(
                    "INSERT OR IGNORE INTO task_completions (task_id, user_id, completion_date) VALUES (?, ?, ?)",
                    (task_id, user_id, past_date)
                )
    conn.commit()

# Initialize DB on start
init_db()

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized', 'message': 'Please log in to continue.'}), 401
            next_param = request.full_path if request.method == 'GET' else None
            return redirect(url_for('login', next=next_param))
        return f(*args, **kwargs)
    return decorated_function

def get_current_user():
    if 'user_id' not in session:
        return None
    conn = get_db_connection()
    user = conn.execute('SELECT id, username, email, created_at FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    conn.close()
    return dict(user) if user else None

def get_stats_data(conn, user_id):
    total = conn.execute('SELECT COUNT(*) FROM tasks WHERE user_id = ?', (user_id,)).fetchone()[0]
    completed = conn.execute('SELECT COUNT(*) FROM tasks WHERE completed = 1 AND user_id = ?', (user_id,)).fetchone()[0]
    pending = total - completed
    rate = round((completed / total * 100), 1) if total > 0 else 0
    max_streak = conn.execute('SELECT COALESCE(MAX(streak), 0) FROM tasks WHERE user_id = ?', (user_id,)).fetchone()[0]
    high_priority = conn.execute('SELECT COUNT(*) FROM tasks WHERE priority = "high" AND completed = 0 AND user_id = ?', (user_id,)).fetchone()[0]
    
    now_str = datetime.now().strftime('%Y-%m-%dT%H:%M')
    overdue = conn.execute(
        'SELECT COUNT(*) FROM tasks WHERE completed = 0 AND deadline != "" AND deadline IS NOT NULL AND deadline < ? AND user_id = ?',
        (now_str, user_id)
    ).fetchone()[0]
    
    circumference = 213.6
    radial_offset = round(circumference - (circumference * (rate / 100)), 2)
    
    return {
        'total': total,
        'completed': completed,
        'pending': pending,
        'completion_rate': rate,
        'best_streak': max_streak,
        'high_priority': high_priority,
        'overdue': overdue,
        'radial_offset': radial_offset
    }

def get_categories_data(conn, user_id):
    categories_rows = conn.execute('''
        SELECT c.*, 
               COUNT(t.id) as total_tasks,
               SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
               SUM(CASE WHEN t.completed = 0 THEN 1 ELSE 0 END) as pending_tasks
        FROM categories c
        LEFT JOIN tasks t ON c.id = t.category_id AND t.user_id = ?
        WHERE c.user_id = ?
        GROUP BY c.id
        ORDER BY c.id ASC
    ''', (user_id, user_id)).fetchall()
    categories = []
    for r in categories_rows:
        cat = dict(r)
        total = cat.get('total_tasks') or 0
        completed = cat.get('completed_tasks') or 0
        pending = cat.get('pending_tasks') or 0
        rate = round((completed / total * 100), 1) if total > 0 else 0
        cat['total_tasks'] = total
        cat['completed_tasks'] = completed
        cat['pending_tasks'] = pending
        cat['completion_rate'] = rate
        categories.append(cat)
    return categories

def format_deadline(deadline_str):
    if not deadline_str:
        return None
    try:
        dt = datetime.fromisoformat(deadline_str)
        now = datetime.now()
        diff_days = (dt.date() - now.date()).days
        time_part = dt.strftime('%I:%M %p').lstrip('0')
        if diff_days == 0:
            return f"Today, {time_part}"
        elif diff_days == 1:
            return f"Tomorrow, {time_part}"
        elif diff_days == -1:
            return f"Yesterday, {time_part}"
        else:
            return dt.strftime('%b %d, ') + time_part
    except Exception:
        return deadline_str

def resolve_deadline(deadline_str, preset_str):
    if deadline_str and deadline_str.strip():
        return deadline_str.strip()
    
    if not preset_str:
        return ''
        
    now = datetime.now()
    if preset_str == 'today_evening':
        return now.replace(hour=18, minute=0, second=0, microsecond=0).strftime('%Y-%m-%dT%H:%M')
    elif preset_str == 'today_night':
        return now.replace(hour=22, minute=0, second=0, microsecond=0).strftime('%Y-%m-%dT%H:%M')
    elif preset_str == 'tomorrow_morning':
        target = now + timedelta(days=1)
        return target.replace(hour=9, minute=0, second=0, microsecond=0).strftime('%Y-%m-%dT%H:%M')
    elif preset_str == 'in_2_days':
        target = now + timedelta(days=2)
        return target.replace(hour=9, minute=0, second=0, microsecond=0).strftime('%Y-%m-%dT%H:%M')
    elif preset_str == 'friday_evening':
        days_ahead = (4 - now.weekday()) % 7
        if days_ahead == 0 and now.hour >= 17:
            days_ahead = 7
        target = now + timedelta(days=days_ahead)
        return target.replace(hour=17, minute=0, second=0, microsecond=0).strftime('%Y-%m-%dT%H:%M')
    elif preset_str == 'next_monday':
        days_ahead = (7 - now.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        target = now + timedelta(days=days_ahead)
        return target.replace(hour=9, minute=0, second=0, microsecond=0).strftime('%Y-%m-%dT%H:%M')
    
    return ''

# =========================================================================
# Authentication Routes (Login, Register, Logout)
# =========================================================================

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        return redirect(url_for('index'))

    error = None
    next_url = request.args.get('next') or url_for('index')
    theme = request.cookies.get('orbit_theme') or request.cookies.get('theme', 'dark')

    if request.method == 'POST':
        # 1-Click Instant Demo Login
        if request.form.get('action') == 'demo':
            conn = get_db_connection()
            user = conn.execute("SELECT * FROM users WHERE username = 'player1'").fetchone()
            conn.close()
            if user:
                session.clear()
                session['user_id'] = user['id']
                session['username'] = user['username']
                return redirect(next_url)

        username_or_email = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        if not username_or_email or not password:
            error = 'Please enter both username/email and passcode.'
        else:
            conn = get_db_connection()
            user = conn.execute(
                'SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)',
                (username_or_email, username_or_email)
            ).fetchone()
            conn.close()

            if user and check_password_hash(user['password_hash'], password):
                session.clear()
                session['user_id'] = user['id']
                session['username'] = user['username']
                return redirect(next_url)
            else:
                error = 'Invalid player tag, email, or passcode.'

    return render_template('auth.html', mode='login', error=error, theme=theme, next_url=next_url)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if 'user_id' in session:
        return redirect(url_for('index'))

    error = None
    theme = request.cookies.get('orbit_theme') or request.cookies.get('theme', 'dark')

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')

        if not username:
            error = 'Player tag is required.'
        elif len(username) < 3 or len(username) > 20:
            error = 'Player tag must be between 3 and 20 characters.'
        elif not re.match(r'^[a-zA-Z0-9_]+$', username):
            error = 'Player tag can only contain letters, numbers, and underscores.'
        elif not password or len(password) < 4:
            error = 'Passcode must be at least 4 characters long.'
        elif password != confirm_password:
            error = 'Passcodes do not match.'
        else:
            conn = get_db_connection()
            existing_user = conn.execute(
                'SELECT id FROM users WHERE LOWER(username) = LOWER(?)', (username,)
            ).fetchone()
            if existing_user:
                conn.close()
                error = f'Player tag "{username}" is already taken.'
            else:
                pw_hash = generate_password_hash(password)
                cursor = conn.cursor()
                cursor.execute(
                    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                    (username, email or None, pw_hash)
                )
                conn.commit()
                new_user_id = cursor.lastrowid

                # Seed personalized starter packs and sample quests for the new player
                seed_user_defaults(conn, new_user_id)
                conn.close()

                # Automatically log in new player
                session.clear()
                session['user_id'] = new_user_id
                session['username'] = username
                return redirect(url_for('index'))

    return render_template('auth.html', mode='register', error=error, theme=theme)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# =========================================================================
# Server-Side Rendered (Zero JavaScript) Main Routes
# =========================================================================

@app.route('/')
@login_required
def index():
    user_id = session['user_id']
    category_filter = request.args.get('category', 'all')
    status_filter = request.args.get('status', 'all')
    search_query = request.args.get('search', '').strip()
    theme = request.cookies.get('orbit_theme') or request.cookies.get('theme', 'dark')

    conn = get_db_connection()
    stats = get_stats_data(conn, user_id)
    
    # Fetch categories for the current user with task counts
    categories = get_categories_data(conn, user_id)

    cat_count_all = stats['total']

    # Build filtered tasks query for the current user
    query = '''
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = ?
    '''
    params = [user_id]
    
    if category_filter and category_filter != 'all':
        query += ' AND t.category_id = ?'
        params.append(category_filter)
        
    if status_filter == 'active':
        query += ' AND t.completed = 0'
    elif status_filter == 'completed':
        query += ' AND t.completed = 1'
        
    if search_query:
        query += ' AND LOWER(t.text) LIKE ?'
        params.append(f"%{search_query.lower()}%")
        
    query += ' ORDER BY t.completed ASC, CASE WHEN t.deadline != "" AND t.deadline IS NOT NULL THEN 0 ELSE 1 END, t.deadline ASC, t.id DESC'
    
    raw_tasks = conn.execute(query, params).fetchall()
    conn.close()

    now_str = datetime.now().strftime('%Y-%m-%dT%H:%M')
    tasks = []
    for row in raw_tasks:
        t = dict(row)
        deadline = t.get('deadline') or ''
        is_overdue = bool(deadline and deadline < now_str and not t['completed'])
        t['is_overdue'] = is_overdue
        t['formatted_deadline'] = format_deadline(deadline)
        tasks.append(t)

    # Group tasks by category
    tasks_by_category = {}
    for t in tasks:
        cat_name = t['category_name'] or 'General Quests'
        cat_color = t['category_color'] or '#a855f7'
        cat_id = t['category_id']
        key = (cat_id, cat_name, cat_color)
        if key not in tasks_by_category:
            tasks_by_category[key] = []
        tasks_by_category[key].append(t)

    current_date_str = datetime.now().strftime('%A, %b %d')

    return render_template(
        'index.html',
        tasks=tasks,
        tasks_by_category=tasks_by_category,
        categories=categories,
        stats=stats,
        current_category=category_filter,
        current_status=status_filter,
        search_query=search_query,
        theme=theme,
        cat_count_all=cat_count_all,
        current_date_str=current_date_str,
        current_user=get_current_user()
    )

@app.after_request
def add_no_cache_headers(response):
    if 'text/html' in response.headers.get('Content-Type', ''):
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
    return response

# PWA Static Assets Routing
@app.route('/sw.js')
def service_worker():
    response = make_response(send_from_directory('static', 'sw.js'))
    response.headers['Content-Type'] = 'application/javascript'
    response.headers['Service-Worker-Allowed'] = '/'
    return response

@app.route('/manifest.json')
def manifest():
    return send_from_directory('static', 'manifest.json')

@app.route('/favicon.ico')
def favicon():
    return send_from_directory('static/icons', 'icon.svg')

@app.route('/set-theme/<theme>')
def set_theme(theme):
    if theme not in ['dark', 'light']:
        theme = 'dark'
        
    category = request.args.get('category', 'all')
    status = request.args.get('status', 'all')
    search = request.args.get('search', '')
    
    referrer = request.referrer
    if referrer and ('/login' in referrer or '/register' in referrer):
        target_url = referrer
    elif referrer and ('/packs/' in referrer or '/habits/' in referrer):
        target_url = referrer
    else:
        target_url = url_for('index', category=category, status=status, search=search)

    resp = make_response(redirect(target_url))
    resp.set_cookie('orbit_theme', theme, max_age=60*60*24*365, path='/', samesite='Lax')
    resp.set_cookie('theme', theme, max_age=60*60*24*365, path='/', samesite='Lax')
    return resp

@app.route('/tasks/add', methods=['POST'])
@login_required
def add_task_form():
    user_id = session['user_id']
    text = request.form.get('text', '').strip()
    category_id = request.form.get('category_id') or None
    deadline_input = request.form.get('deadline', '').strip()
    deadline_preset = request.form.get('deadline_preset', '').strip()
    deadline = resolve_deadline(deadline_input, deadline_preset)
    priority = request.form.get('priority', 'medium')
    
    filter_category = request.form.get('filter_category', 'all')
    filter_status = request.form.get('filter_status', 'all')
    filter_search = request.form.get('filter_search', '')

    if text:
        conn = get_db_connection()
        conn.execute('''
            INSERT INTO tasks (text, category_id, completed, deadline, priority, streak, created_at, user_id)
            VALUES (?, ?, 0, ?, ?, 0, ?, ?)
        ''', (text, category_id, deadline, priority, datetime.now().isoformat(), user_id))
        conn.commit()
        conn.close()

    return redirect(url_for('index', category=filter_category, status=filter_status, search=filter_search))

@app.route('/tasks/<int:task_id>/toggle', methods=['POST'])
@login_required
def toggle_task_form(task_id):
    user_id = session['user_id']
    filter_category = request.form.get('filter_category', 'all')
    filter_status = request.form.get('filter_status', 'all')
    filter_search = request.form.get('filter_search', '')

    conn = get_db_connection()
    task = conn.execute('SELECT * FROM tasks WHERE id = ? AND user_id = ?', (task_id, user_id)).fetchone()
    updated_task = None
    if task:
        new_completed = 0 if task['completed'] else 1
        completed_at = datetime.now().isoformat() if new_completed == 1 else None
        new_streak = task['streak'] + 1 if new_completed == 1 else max(0, task['streak'] - 1)
        
        conn.execute('''
            UPDATE tasks 
            SET completed = ?, streak = ?, completed_at = ?
            WHERE id = ? AND user_id = ?
        ''', (new_completed, new_streak, completed_at, task_id, user_id))

        today_str = date.today().isoformat()
        if new_completed == 1:
            conn.execute('''
                INSERT OR IGNORE INTO task_completions (task_id, user_id, completion_date)
                VALUES (?, ?, ?)
            ''', (task_id, user_id, today_str))
        else:
            conn.execute('''
                DELETE FROM task_completions 
                WHERE task_id = ? AND user_id = ? AND completion_date = ?
            ''', (task_id, user_id, today_str))

        conn.commit()

        updated_task = conn.execute('''
            SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
            FROM tasks t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.id = ? AND t.user_id = ?
        ''', (task_id, user_id)).fetchone()

    is_ajax = (
        request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
        'application/json' in request.headers.get('Accept', '') or
        request.is_json
    )

    if is_ajax:
        stats = get_stats_data(conn, user_id)
        categories = get_categories_data(conn, user_id)
        conn.close()
        return jsonify({
            'success': True,
            'task': dict(updated_task) if updated_task else None,
            'stats': stats,
            'categories': categories
        })

    conn.close()

    return redirect(url_for('index', category=filter_category, status=filter_status, search=filter_search))

@app.route('/tasks/<int:task_id>/edit', methods=['POST'])
@login_required
def edit_task_form(task_id):
    user_id = session['user_id']
    text = request.form.get('text', '').strip()
    category_id = request.form.get('category_id') or None
    deadline_input = request.form.get('deadline', '').strip()
    deadline_preset = request.form.get('deadline_preset', '').strip()
    deadline = resolve_deadline(deadline_input, deadline_preset)
    priority = request.form.get('priority', 'medium')
    
    filter_category = request.form.get('filter_category', 'all')
    filter_status = request.form.get('filter_status', 'all')
    filter_search = request.form.get('filter_search', '')

    if text:
        conn = get_db_connection()
        conn.execute('''
            UPDATE tasks 
            SET text = ?, category_id = ?, deadline = ?, priority = ?
            WHERE id = ? AND user_id = ?
        ''', (text, category_id, deadline, priority, task_id, user_id))
        conn.commit()
        conn.close()

    return redirect(url_for('index', category=filter_category, status=filter_status, search=filter_search))

@app.route('/tasks/<int:task_id>/delete', methods=['POST'])
@login_required
def delete_task_form(task_id):
    user_id = session['user_id']
    filter_category = request.form.get('filter_category', 'all')
    filter_status = request.form.get('filter_status', 'all')
    filter_search = request.form.get('filter_search', '')

    conn = get_db_connection()
    conn.execute('DELETE FROM tasks WHERE id = ? AND user_id = ?', (task_id, user_id))
    conn.commit()

    is_ajax = (
        request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
        'application/json' in request.headers.get('Accept', '') or
        request.is_json
    )

    if is_ajax:
        stats = get_stats_data(conn, user_id)
        categories = get_categories_data(conn, user_id)
        conn.close()
        return jsonify({
            'success': True,
            'task_id': task_id,
            'stats': stats,
            'categories': categories
        })

    conn.close()

    return redirect(url_for('index', category=filter_category, status=filter_status, search=filter_search))

@app.route('/categories/add', methods=['POST'])
@login_required
def add_category_form():
    user_id = session['user_id']
    name = request.form.get('name', '').strip()
    color = request.form.get('color', '#39ff14')
    icon = request.form.get('icon', 'folder')
    
    filter_category = request.form.get('filter_category', 'all')
    filter_status = request.form.get('filter_status', 'all')
    filter_search = request.form.get('filter_search', '')

    if name:
        conn = get_db_connection()
        # Verify user doesn't already have a category with same name
        existing = conn.execute('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND user_id = ?', (name, user_id)).fetchone()
        if not existing:
            conn.execute('INSERT INTO categories (name, color, icon, user_id) VALUES (?, ?, ?, ?)', (name, color, icon, user_id))
            conn.commit()
        conn.close()

    return redirect(url_for('index', category=filter_category, status=filter_status, search=filter_search))

@app.route('/categories/<int:cat_id>/delete', methods=['POST'])
@login_required
def delete_category_form(cat_id):
    user_id = session['user_id']
    filter_status = request.form.get('filter_status', 'all')
    filter_search = request.form.get('filter_search', '')

    conn = get_db_connection()
    conn.execute('UPDATE tasks SET category_id = NULL WHERE category_id = ? AND user_id = ?', (cat_id, user_id))
    conn.execute('DELETE FROM categories WHERE id = ? AND user_id = ?', (cat_id, user_id))
    conn.commit()
    conn.close()

    return redirect(url_for('index', category='all', status=filter_status, search=filter_search))

# =========================================================================
# Habit / Pack Calendar & History Routes
# =========================================================================

@app.route('/habits/<int:category_id>')
@app.route('/packs/<int:category_id>')
@login_required
def pack_detail(category_id):
    user_id = session['user_id']
    theme = request.cookies.get('orbit_theme') or request.cookies.get('theme', 'dark')
    conn = get_db_connection()

    if category_id == 0:
        category = {
            'id': 0,
            'name': 'General Quests',
            'color': '#a855f7',
            'icon': 'folder'
        }
        tasks_rows = conn.execute(
            'SELECT * FROM tasks WHERE (category_id IS NULL OR category_id = 0) AND user_id = ? ORDER BY id ASC',
            (user_id,)
        ).fetchall()
    else:
        category_row = conn.execute(
            'SELECT * FROM categories WHERE id = ? AND user_id = ?',
            (category_id, user_id)
        ).fetchone()
        if not category_row:
            conn.close()
            return redirect(url_for('index'))
        category = dict(category_row)
        tasks_rows = conn.execute(
            'SELECT * FROM tasks WHERE category_id = ? AND user_id = ? ORDER BY id ASC',
            (category_id, user_id)
        ).fetchall()

    now_str = datetime.now().strftime('%Y-%m-%dT%H:%M')
    tasks = []
    for r in tasks_rows:
        t = dict(r)
        deadline = t.get('deadline') or ''
        t['is_overdue'] = bool(deadline and deadline < now_str and not t['completed'])
        t['formatted_deadline'] = format_deadline(deadline)
        tasks.append(t)

    today = date.today()
    try:
        year = int(request.args.get('year', today.year))
        month = int(request.args.get('month', today.month))
        if month < 1:
            month = 12
            year -= 1
        elif month > 12:
            month = 1
            year += 1
    except (ValueError, TypeError):
        year, month = today.year, today.month

    prev_month = 12 if month == 1 else month - 1
    prev_year = year - 1 if month == 1 else year
    next_month = 1 if month == 12 else month + 1
    next_year = year + 1 if month == 12 else year

    month_name = calendar.month_name[month]
    month_cal = calendar.monthcalendar(year, month)
    days_in_month = calendar.monthrange(year, month)[1]

    # Fetch completions for tasks in this pack
    task_ids = [t['id'] for t in tasks]
    month_prefix = f"{year:04d}-{month:02d}"
    completions_by_date = {}
    if task_ids:
        placeholders = ','.join('?' for _ in task_ids)
        query = f'''
            SELECT task_id, completion_date 
            FROM task_completions 
            WHERE task_id IN ({placeholders}) 
              AND user_id = ? 
              AND completion_date LIKE ?
        '''
        comp_rows = conn.execute(query, (*task_ids, user_id, f"{month_prefix}%")).fetchall()
        for row in comp_rows:
            d = row['completion_date']
            if d not in completions_by_date:
                completions_by_date[d] = set()
            completions_by_date[d].add(row['task_id'])

    conn.close()

    today_str = today.isoformat()
    total_tasks_count = len(tasks)

    # Build calendar matrix
    calendar_weeks = []
    total_completed_days_in_month = 0
    total_completions_count = 0

    for week in month_cal:
        week_days = []
        for day in week:
            if day == 0:
                week_days.append({'day': 0})
            else:
                date_str = f"{year:04d}-{month:02d}-{day:02d}"
                completed_task_ids = completions_by_date.get(date_str, set())
                completed_count = len(completed_task_ids)
                total_completions_count += completed_count

                is_today = (date_str == today_str)
                is_future = (date_str > today_str)

                if is_future:
                    status = 'future'
                elif total_tasks_count > 0 and completed_count == total_tasks_count:
                    status = 'fully_completed'
                    total_completed_days_in_month += 1
                elif completed_count > 0:
                    status = 'partially_completed'
                    total_completed_days_in_month += 1
                else:
                    status = 'missed'

                day_tasks = []
                for t in tasks:
                    day_tasks.append({
                        'id': t['id'],
                        'text': t['text'],
                        'priority': t['priority'],
                        'streak': t['streak'],
                        'formatted_deadline': t['formatted_deadline'],
                        'completed_on_day': (t['id'] in completed_task_ids)
                    })

                week_days.append({
                    'day': day,
                    'date_str': date_str,
                    'is_today': is_today,
                    'is_future': is_future,
                    'status': status,
                    'completed_count': completed_count,
                    'total_count': total_tasks_count,
                    'completed_task_ids': list(completed_task_ids),
                    'day_tasks': day_tasks
                })
        calendar_weeks.append(week_days)

    # Build per-task streak & consistency rows
    task_histories = []
    for t in tasks:
        task_id = t['id']
        day_logs = []
        task_completed_days = 0
        for d in range(1, days_in_month + 1):
            d_str = f"{year:04d}-{month:02d}-{d:02d}"
            is_comp = task_id in completions_by_date.get(d_str, set())
            if is_comp:
                task_completed_days += 1
            day_logs.append({
                'day': d,
                'date_str': d_str,
                'completed': is_comp,
                'is_today': (d_str == today_str),
                'is_future': (d_str > today_str)
            })

        past_days = min(today.day if year == today.year and month == today.month else days_in_month, days_in_month)
        if year > today.year or (year == today.year and month > today.month):
            past_days = 0
        consistency_pct = round((task_completed_days / past_days * 100), 1) if past_days > 0 else 0

        task_histories.append({
            'task': t,
            'day_logs': day_logs,
            'completed_days': task_completed_days,
            'consistency_pct': consistency_pct
        })

    completed_today_count = len([t for t in tasks if t['completed']])
    days_elapsed = min(today.day if year == today.year and month == today.month else days_in_month, days_in_month)
    if year > today.year or (year == today.year and month > today.month):
        days_elapsed = 0

    possible_completions = total_tasks_count * days_elapsed
    pack_consistency_pct = round((total_completions_count / possible_completions * 100), 1) if possible_completions > 0 else 0

    pack_stats = {
        'total_tasks': total_tasks_count,
        'completed_today': completed_today_count,
        'total_completed_days': total_completed_days_in_month,
        'total_completions_count': total_completions_count,
        'consistency_pct': pack_consistency_pct,
        'max_streak': max([t['streak'] for t in tasks], default=0),
        'days_in_month': days_in_month
    }

    return render_template(
        'pack_calendar.html',
        category=category,
        tasks=tasks,
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

@app.route('/api/tasks/<int:task_id>/toggle-date', methods=['POST'])
@login_required
def toggle_task_date(task_id):
    user_id = session['user_id']
    data = request.get_json(silent=True) or request.form
    date_str = data.get('date') or date.today().isoformat()

    conn = get_db_connection()
    task = conn.execute('SELECT * FROM tasks WHERE id = ? AND user_id = ?', (task_id, user_id)).fetchone()
    if not task:
        conn.close()
        return jsonify({'error': 'Task not found'}), 404

    existing = conn.execute(
        'SELECT id FROM task_completions WHERE task_id = ? AND user_id = ? AND completion_date = ?',
        (task_id, user_id, date_str)
    ).fetchone()

    today_str = date.today().isoformat()
    if existing:
        conn.execute(
            'DELETE FROM task_completions WHERE task_id = ? AND user_id = ? AND completion_date = ?',
            (task_id, user_id, date_str)
        )
        is_completed = False
        if date_str == today_str:
            new_streak = max(0, task['streak'] - 1)
            conn.execute('UPDATE tasks SET completed = 0, streak = ? WHERE id = ?', (new_streak, task_id))
    else:
        conn.execute(
            'INSERT OR IGNORE INTO task_completions (task_id, user_id, completion_date) VALUES (?, ?, ?)',
            (task_id, user_id, date_str)
        )
        is_completed = True
        if date_str == today_str:
            new_streak = task['streak'] + 1
            conn.execute('UPDATE tasks SET completed = 1, streak = ?, completed_at = ? WHERE id = ?',
                         (new_streak, datetime.now().isoformat(), task_id))

    conn.commit()
    conn.close()
    return jsonify({
        'success': True,
        'task_id': task_id,
        'date': date_str,
        'completed': is_completed
    })

# =========================================================================
# JSON REST API Endpoints (For client apps & integrations)
# =========================================================================

@app.route('/api/categories', methods=['GET'])
@login_required
def get_categories():
    user_id = session['user_id']
    conn = get_db_connection()
    categories = conn.execute('''
        SELECT c.*, 
               COUNT(t.id) as total_tasks,
               SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
               SUM(CASE WHEN t.completed = 0 THEN 1 ELSE 0 END) as pending_tasks
        FROM categories c
        LEFT JOIN tasks t ON c.id = t.category_id AND t.user_id = ?
        WHERE c.user_id = ?
        GROUP BY c.id
        ORDER BY c.id ASC
    ''', (user_id, user_id)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in categories])

@app.route('/api/categories', methods=['POST'])
@login_required
def add_category():
    user_id = session['user_id']
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    color = data.get('color', '#6366f1')
    icon = data.get('icon', 'folder')
    
    if not name:
        return jsonify({'error': 'Category name is required'}), 400
        
    conn = get_db_connection()
    existing = conn.execute('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND user_id = ?', (name, user_id)).fetchone()
    if existing:
        conn.close()
        return jsonify({'error': 'Category already exists'}), 409

    cursor = conn.cursor()
    cursor.execute('INSERT INTO categories (name, color, icon, user_id) VALUES (?, ?, ?, ?)', (name, color, icon, user_id))
    conn.commit()
    cat_id = cursor.lastrowid
    conn.close()
    return jsonify({'id': cat_id, 'name': name, 'color': color, 'icon': icon}), 201

@app.route('/api/categories/<int:cat_id>', methods=['DELETE'])
@login_required
def delete_category(cat_id):
    user_id = session['user_id']
    conn = get_db_connection()
    conn.execute('UPDATE tasks SET category_id = NULL WHERE category_id = ? AND user_id = ?', (cat_id, user_id))
    conn.execute('DELETE FROM categories WHERE id = ? AND user_id = ?', (cat_id, user_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/tasks', methods=['GET'])
@login_required
def get_tasks():
    user_id = session['user_id']
    category_id = request.args.get('category_id')
    status = request.args.get('status')
    search = request.args.get('search')
    
    query = '''
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = ?
    '''
    params = [user_id]
    
    if category_id:
        query += ' AND t.category_id = ?'
        params.append(category_id)
        
    if status == 'active':
        query += ' AND t.completed = 0'
    elif status == 'completed':
        query += ' AND t.completed = 1'
        
    if search:
        query += ' AND LOWER(t.text) LIKE ?'
        params.append(f"%{search.lower()}%")
        
    query += ' ORDER BY t.completed ASC, CASE WHEN t.deadline != "" AND t.deadline IS NOT NULL THEN 0 ELSE 1 END, t.deadline ASC, t.id DESC'
    
    conn = get_db_connection()
    tasks = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(row) for row in tasks])

@app.route('/api/tasks', methods=['POST'])
@login_required
def add_task():
    user_id = session['user_id']
    data = request.get_json() or {}
    text = data.get('text', '').strip()
    category_id = data.get('category_id')
    deadline = data.get('deadline', '')
    priority = data.get('priority', 'medium')
    
    if not text:
        return jsonify({'error': 'Task text is required'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO tasks (text, category_id, completed, deadline, priority, streak, created_at, user_id)
        VALUES (?, ?, 0, ?, ?, 0, ?, ?)
    ''', (text, category_id, deadline, priority, datetime.now().isoformat(), user_id))
    conn.commit()
    task_id = cursor.lastrowid
    
    new_task = conn.execute('''
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.id = ? AND t.user_id = ?
    ''', (task_id, user_id)).fetchone()
    conn.close()
    
    return jsonify(dict(new_task)), 201

@app.route('/api/tasks/<int:task_id>/toggle', methods=['POST'])
@login_required
def toggle_task(task_id):
    user_id = session['user_id']
    conn = get_db_connection()
    task = conn.execute('SELECT * FROM tasks WHERE id = ? AND user_id = ?', (task_id, user_id)).fetchone()
    if not task:
        conn.close()
        return jsonify({'error': 'Task not found'}), 404
        
    new_completed = 0 if task['completed'] else 1
    new_streak = task['streak'] + 1 if new_completed == 1 else max(0, task['streak'] - 1)
    completed_at = datetime.now().isoformat() if new_completed == 1 else None
        
    conn.execute('''
        UPDATE tasks 
        SET completed = ?, streak = ?, completed_at = ?
        WHERE id = ? AND user_id = ?
    ''', (new_completed, new_streak, completed_at, task_id, user_id))

    today_str = date.today().isoformat()
    if new_completed == 1:
        conn.execute('''
            INSERT OR IGNORE INTO task_completions (task_id, user_id, completion_date)
            VALUES (?, ?, ?)
        ''', (task_id, user_id, today_str))
    else:
        conn.execute('''
            DELETE FROM task_completions 
            WHERE task_id = ? AND user_id = ? AND completion_date = ?
        ''', (task_id, user_id, today_str))

    conn.commit()
    
    updated_task = conn.execute('''
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.id = ? AND t.user_id = ?
    ''', (task_id, user_id)).fetchone()
    conn.close()
    
    return jsonify(dict(updated_task))

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
@login_required
def delete_task(task_id):
    user_id = session['user_id']
    conn = get_db_connection()
    conn.execute('DELETE FROM tasks WHERE id = ? AND user_id = ?', (task_id, user_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/stats', methods=['GET'])
@login_required
def get_stats():
    user_id = session['user_id']
    conn = get_db_connection()
    stats = get_stats_data(conn, user_id)
    conn.close()
    return jsonify(stats)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
