import os
import sqlite3
from datetime import datetime, date, timedelta
from flask import Flask, render_template, request, jsonify, redirect, url_for, make_response, send_from_directory

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'habits.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create categories table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#6366f1',
            icon TEXT DEFAULT 'folder'
        )
    ''')
    
    # Create tasks table
    cursor.execute('''
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
            FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
        )
    ''')
    
    # Seed default categories if empty
    cursor.execute('SELECT COUNT(*) FROM categories')
    if cursor.fetchone()[0] == 0:
        default_categories = [
            ('Daily Goals', '#10b981', 'target'),
            ('Regular Tasks', '#6366f1', 'check-square'),
            ('Health & Wellness', '#ec4899', 'heart'),
            ('Deep Work', '#8b5cf6', 'zap')
        ]
        cursor.executemany(
            'INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)',
            default_categories
        )
        conn.commit()

        # Seed initial sample tasks
        cursor.execute("SELECT id FROM categories WHERE name = 'Daily Goals'")
        daily_id = cursor.fetchone()[0]
        cursor.execute("SELECT id FROM categories WHERE name = 'Regular Tasks'")
        regular_id = cursor.fetchone()[0]
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%dT10:00')
        initial_tasks = [
            ('Drink 2.5L of water & stay hydrated', daily_id, 1, '', 'high', 4, datetime.now().isoformat()),
            ('Review quarterly sprint progress & roadmap', regular_id, 0, tomorrow, 'high', 0, None),
            ('30-minute afternoon mindfulness or run', daily_id, 0, '', 'medium', 2, None)
        ]
        cursor.executemany(
            'INSERT INTO tasks (text, category_id, completed, deadline, priority, streak, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            initial_tasks
        )
        conn.commit()

    conn.close()

# Initialize DB on start
init_db()

def get_stats_data(conn):
    total = conn.execute('SELECT COUNT(*) FROM tasks').fetchone()[0]
    completed = conn.execute('SELECT COUNT(*) FROM tasks WHERE completed = 1').fetchone()[0]
    pending = total - completed
    rate = round((completed / total * 100), 1) if total > 0 else 0
    max_streak = conn.execute('SELECT COALESCE(MAX(streak), 0) FROM tasks').fetchone()[0]
    high_priority = conn.execute('SELECT COUNT(*) FROM tasks WHERE priority = "high" AND completed = 0').fetchone()[0]
    
    now_str = datetime.now().strftime('%Y-%m-%dT%H:%M')
    overdue = conn.execute(
        'SELECT COUNT(*) FROM tasks WHERE completed = 0 AND deadline != "" AND deadline IS NOT NULL AND deadline < ?',
        (now_str,)
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
# Server-Side Rendered (Zero JavaScript) Main Routes
# =========================================================================

@app.route('/')
def index():
    category_filter = request.args.get('category', 'all')
    status_filter = request.args.get('status', 'all')
    search_query = request.args.get('search', '').strip()
    theme = request.cookies.get('orbit_theme') or request.cookies.get('theme', 'dark')

    conn = get_db_connection()
    stats = get_stats_data(conn)
    
    # Fetch categories with task counts
    categories_rows = conn.execute('''
        SELECT c.*, 
               COUNT(t.id) as total_tasks,
               SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
               SUM(CASE WHEN t.completed = 0 THEN 1 ELSE 0 END) as pending_tasks
        FROM categories c
        LEFT JOIN tasks t ON c.id = t.category_id
        GROUP BY c.id
        ORDER BY c.id ASC
    ''').fetchall()
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

    cat_count_all = stats['total']

    # Build filtered tasks query
    query = '''
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE 1=1
    '''
    params = []
    
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
        current_date_str=current_date_str
    )

@app.after_request
def add_no_cache_headers(response):
    if 'text/html' in response.headers.get('Content-Type', ''):
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

@app.route('/sw.js')
def service_worker():
    resp = make_response(send_from_directory('static', 'sw.js'))
    resp.headers['Content-Type'] = 'application/javascript'
    resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
    return resp

@app.route('/manifest.json')
def manifest():
    return send_from_directory('static', 'manifest.json')

@app.route('/favicon.ico')
def favicon():
    return send_from_directory('static/icons', 'icon.svg', mimetype='image/svg+xml')

@app.route('/set-theme/<theme>')
def set_theme(theme):
    if theme not in ['dark', 'light']:
        theme = 'dark'
    
    category = request.args.get('category', 'all')
    status = request.args.get('status', 'all')
    search = request.args.get('search', '')
    
    target_url = url_for('index', category=category, status=status, search=search)
    resp = make_response(redirect(target_url))
    resp.set_cookie('orbit_theme', theme, max_age=60*60*24*365, path='/', samesite='Lax')
    resp.set_cookie('theme', theme, max_age=60*60*24*365, path='/', samesite='Lax')
    return resp

@app.route('/tasks/add', methods=['POST'])
def add_task_form():
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
            INSERT INTO tasks (text, category_id, completed, deadline, priority, streak, created_at)
            VALUES (?, ?, 0, ?, ?, 0, ?)
        ''', (text, category_id, deadline, priority, datetime.now().isoformat()))
        conn.commit()
        conn.close()

    return redirect(url_for('index', category=filter_category, status=filter_status, search=filter_search))

@app.route('/tasks/<int:task_id>/toggle', methods=['POST'])
def toggle_task_form(task_id):
    filter_category = request.form.get('filter_category', 'all')
    filter_status = request.form.get('filter_status', 'all')
    filter_search = request.form.get('filter_search', '')

    conn = get_db_connection()
    task = conn.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
    if task:
        new_completed = 0 if task['completed'] else 1
        completed_at = datetime.now().isoformat() if new_completed == 1 else None
        new_streak = task['streak'] + 1 if new_completed == 1 else max(0, task['streak'] - 1)
        
        conn.execute('''
            UPDATE tasks 
            SET completed = ?, streak = ?, completed_at = ?
            WHERE id = ?
        ''', (new_completed, new_streak, completed_at, task_id))
        conn.commit()
    conn.close()

    return redirect(url_for('index', category=filter_category, status=filter_status, search=filter_search))

@app.route('/tasks/<int:task_id>/edit', methods=['POST'])
def edit_task_form(task_id):
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
            WHERE id = ?
        ''', (text, category_id, deadline, priority, task_id))
        conn.commit()
        conn.close()

    return redirect(url_for('index', category=filter_category, status=filter_status, search=filter_search))

@app.route('/tasks/<int:task_id>/delete', methods=['POST'])
def delete_task_form(task_id):
    filter_category = request.form.get('filter_category', 'all')
    filter_status = request.form.get('filter_status', 'all')
    filter_search = request.form.get('filter_search', '')

    conn = get_db_connection()
    conn.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
    conn.commit()
    conn.close()

    return redirect(url_for('index', category=filter_category, status=filter_status, search=filter_search))

@app.route('/categories/add', methods=['POST'])
def add_category_form():
    name = request.form.get('name', '').strip()
    color = request.form.get('color', '#39ff14')
    icon = request.form.get('icon', 'folder')
    
    filter_category = request.form.get('filter_category', 'all')
    filter_status = request.form.get('filter_status', 'all')
    filter_search = request.form.get('filter_search', '')

    if name:
        try:
            conn = get_db_connection()
            conn.execute('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)', (name, color, icon))
            conn.commit()
            conn.close()
        except sqlite3.IntegrityError:
            pass

    return redirect(url_for('index', category=filter_category, status=filter_status, search=filter_search))

@app.route('/categories/<int:cat_id>/delete', methods=['POST'])
def delete_category_form(cat_id):
    filter_status = request.form.get('filter_status', 'all')
    filter_search = request.form.get('filter_search', '')

    conn = get_db_connection()
    conn.execute('DELETE FROM categories WHERE id = ?', (cat_id,))
    conn.commit()
    conn.close()

    return redirect(url_for('index', category='all', status=filter_status, search=filter_search))

# =========================================================================
# JSON REST API Endpoints (For backwards compatibility or integrations)
# =========================================================================

@app.route('/api/categories', methods=['GET'])
def get_categories():
    conn = get_db_connection()
    categories = conn.execute('''
        SELECT c.*, 
               COUNT(t.id) as total_tasks,
               SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
               SUM(CASE WHEN t.completed = 0 THEN 1 ELSE 0 END) as pending_tasks
        FROM categories c
        LEFT JOIN tasks t ON c.id = t.category_id
        GROUP BY c.id
        ORDER BY c.id ASC
    ''').fetchall()
    conn.close()
    return jsonify([dict(row) for row in categories])

@app.route('/api/categories', methods=['POST'])
def add_category():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    color = data.get('color', '#6366f1')
    icon = data.get('icon', 'folder')
    
    if not name:
        return jsonify({'error': 'Category name is required'}), 400
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)', (name, color, icon))
        conn.commit()
        cat_id = cursor.lastrowid
        conn.close()
        return jsonify({'id': cat_id, 'name': name, 'color': color, 'icon': icon}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Category already exists'}), 409

@app.route('/api/categories/<int:cat_id>', methods=['DELETE'])
def delete_category(cat_id):
    conn = get_db_connection()
    conn.execute('DELETE FROM categories WHERE id = ?', (cat_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    category_id = request.args.get('category_id')
    status = request.args.get('status')
    search = request.args.get('search')
    
    query = '''
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE 1=1
    '''
    params = []
    
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
def add_task():
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
        INSERT INTO tasks (text, category_id, completed, deadline, priority, streak, created_at)
        VALUES (?, ?, 0, ?, ?, 0, ?)
    ''', (text, category_id, deadline, priority, datetime.now().isoformat()))
    conn.commit()
    task_id = cursor.lastrowid
    
    new_task = conn.execute('''
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.id = ?
    ''', (task_id,)).fetchone()
    conn.close()
    
    return jsonify(dict(new_task)), 201

@app.route('/api/tasks/<int:task_id>/toggle', methods=['POST'])
def toggle_task(task_id):
    conn = get_db_connection()
    task = conn.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
    if not task:
        conn.close()
        return jsonify({'error': 'Task not found'}), 404
        
    new_completed = 0 if task['completed'] else 1
    new_streak = task['streak'] + 1 if new_completed == 1 else max(0, task['streak'] - 1)
    completed_at = datetime.now().isoformat() if new_completed == 1 else None
        
    conn.execute('''
        UPDATE tasks 
        SET completed = ?, streak = ?, completed_at = ?
        WHERE id = ?
    ''', (new_completed, new_streak, completed_at, task_id))
    conn.commit()
    
    updated_task = conn.execute('''
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.id = ?
    ''', (task_id,)).fetchone()
    conn.close()
    
    return jsonify(dict(updated_task))

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    conn = get_db_connection()
    conn.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    stats = get_stats_data(conn)
    conn.close()
    return jsonify(stats)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
