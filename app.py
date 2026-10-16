import os
import sqlite3
from datetime import datetime, date, timedelta
from flask import Flask, render_template, request, jsonify

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

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/manifest.json')
def manifest():
    return app.send_static_file('manifest.json')

@app.route('/sw.js')
def service_worker():
    response = app.send_static_file('sw.js')
    response.headers['Content-Type'] = 'application/javascript'
    response.headers['Service-Worker-Allowed'] = '/'
    response.headers['Cache-Control'] = 'no-cache'
    return response

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

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.get_json() or {}
    text = data.get('text')
    category_id = data.get('category_id')
    deadline = data.get('deadline')
    priority = data.get('priority')
    
    conn = get_db_connection()
    task = conn.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
    if not task:
        conn.close()
        return jsonify({'error': 'Task not found'}), 404
        
    new_text = text if text is not None else task['text']
    new_cat = category_id if category_id is not None else task['category_id']
    new_deadline = deadline if deadline is not None else task['deadline']
    new_priority = priority if priority is not None else task['priority']
    
    conn.execute('''
        UPDATE tasks 
        SET text = ?, category_id = ?, deadline = ?, priority = ?
        WHERE id = ?
    ''', (new_text, new_cat, new_deadline, new_priority, task_id))
    conn.commit()
    
    updated_task = conn.execute('''
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.id = ?
    ''', (task_id,)).fetchone()
    conn.close()
    
    return jsonify(dict(updated_task))

@app.route('/api/tasks/<int:task_id>/toggle', methods=['POST'])
def toggle_task(task_id):
    conn = get_db_connection()
    task = conn.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
    if not task:
        conn.close()
        return jsonify({'error': 'Task not found'}), 404
        
    new_completed = 0 if task['completed'] else 1
    new_streak = task['streak']
    completed_at = None
    
    if new_completed == 1:
        new_streak = task['streak'] + 1
        completed_at = datetime.now().isoformat()
    else:
        new_streak = max(0, task['streak'] - 1)
        
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
    total = conn.execute('SELECT COUNT(*) FROM tasks').fetchone()[0]
    completed = conn.execute('SELECT COUNT(*) FROM tasks WHERE completed = 1').fetchone()[0]
    pending = total - completed
    rate = round((completed / total * 100), 1) if total > 0 else 0
    
    max_streak = conn.execute('SELECT COALESCE(MAX(streak), 0) FROM tasks').fetchone()[0]
    
    # Priority counts
    high_priority = conn.execute('SELECT COUNT(*) FROM tasks WHERE priority = "high" AND completed = 0').fetchone()[0]
    
    # Overdue count
    now_str = datetime.now().strftime('%Y-%m-%dT%H:%M')
    overdue = conn.execute(
        'SELECT COUNT(*) FROM tasks WHERE completed = 0 AND deadline != "" AND deadline IS NOT NULL AND deadline < ?',
        (now_str,)
    ).fetchone()[0]
    
    conn.close()
    return jsonify({
        'total': total,
        'completed': completed,
        'pending': pending,
        'completion_rate': rate,
        'best_streak': max_streak,
        'high_priority': high_priority,
        'overdue': overdue
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
