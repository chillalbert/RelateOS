import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './db';
import dotenv from 'dotenv';

dotenv.config();

// --- Database Migrations ---
try {
  db.exec('ALTER TABLE groups ADD COLUMN target_amount REAL DEFAULT 500');
} catch (e) {
  // Column probably already exists
}

const JWT_SECRET = process.env.JWT_SECRET || 'relateos-secret';
const PORT = 3000;

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json());

  // --- Auth Middleware ---
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // --- Auth Routes ---
  app.post('/api/auth/signup', async (req, res) => {
    const { email, password, name } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)').run(email, hashedPassword, name);
      const token = jwt.sign({ id: result.lastInsertRowid, email, name }, JWT_SECRET);
      res.json({ token, user: { id: result.lastInsertRowid, email, name } });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, personality: user.reminder_personality } });
  });

  app.patch('/api/user/settings', authenticate, (req: any, res) => {
    const { personality } = req.body;
    db.prepare('UPDATE users SET reminder_personality = ? WHERE id = ?').run(personality, req.user.id);
    res.json({ success: true });
  });

  // --- People Routes ---
  app.get('/api/people', authenticate, (req: any, res) => {
    const people = db.prepare(`
      SELECT p.*, (SELECT COUNT(*) FROM memories WHERE person_id = p.id) as memory_count
      FROM people p
      WHERE p.user_id = ?
      ORDER BY p.birthday ASC
    `).all(req.user.id);
    res.json(people);
  });

  app.post('/api/people', authenticate, (req: any, res) => {
    const { name, nickname, birthday, category, importance, photo_url, notes } = req.body;
    const result = db.prepare(`
      INSERT INTO people (user_id, name, nickname, birthday, category, importance, photo_url, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, name, nickname, birthday, category, importance, photo_url, notes);
    res.json({ id: result.lastInsertRowid });
  });

  app.get('/api/people/:id', authenticate, (req: any, res) => {
    const person = db.prepare('SELECT * FROM people WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!person) return res.status(404).json({ error: 'Not found' });
    const memories = db.prepare('SELECT * FROM memories WHERE person_id = ?').all(req.params.id);
    const reflections = db.prepare('SELECT * FROM reflections WHERE person_id = ?').all(req.params.id);
    const tasks = db.prepare('SELECT * FROM tasks WHERE person_id = ?').all(req.params.id);
    res.json({ ...person, memories, reflections, tasks });
  });

  app.patch('/api/people/:id/reminders', authenticate, (req: any, res) => {
    const { reminder_settings } = req.body;
    db.prepare('UPDATE people SET reminder_settings = ? WHERE id = ? AND user_id = ?')
      .run(JSON.stringify(reminder_settings), req.params.id, req.user.id);
    res.json({ success: true });
  });

  app.patch('/api/people/:id', authenticate, (req: any, res) => {
    const { name, nickname, birthday, category, importance, notes, photo_url } = req.body;
    db.prepare(`
      UPDATE people 
      SET name = ?, nickname = ?, birthday = ?, category = ?, importance = ?, notes = ?, photo_url = ?
      WHERE id = ? AND user_id = ?
    `).run(name, nickname, birthday, category, importance, notes, photo_url, req.params.id, req.user.id);
    res.json({ success: true });
  });

  // --- Tasks Routes ---
  app.get('/api/tasks/:personId', authenticate, (req: any, res) => {
    const tasks = db.prepare('SELECT * FROM tasks WHERE person_id = ?').all(req.params.personId);
    res.json(tasks);
  });

  app.post('/api/tasks', authenticate, (req: any, res) => {
    const { person_id, title, due_date } = req.body;
    const result = db.prepare('INSERT INTO tasks (person_id, title, due_date) VALUES (?, ?, ?)')
      .run(person_id, title, due_date);
    res.json({ id: result.lastInsertRowid });
  });

  app.patch('/api/tasks/:id', authenticate, (req: any, res) => {
    const { completed, due_date } = req.body;
    if (completed !== undefined) {
      db.prepare('UPDATE tasks SET completed = ? WHERE id = ?').run(completed ? 1 : 0, req.params.id);
    }
    if (due_date !== undefined) {
      db.prepare('UPDATE tasks SET due_date = ? WHERE id = ?').run(due_date, req.params.id);
    }
    res.json({ success: true });
  });

  // --- Memories Routes ---
  app.post('/api/memories', authenticate, (req: any, res) => {
    const { person_id, year, type, content, metadata } = req.body;
    // Verify ownership
    const person = db.prepare('SELECT id FROM people WHERE id = ? AND user_id = ?').get(person_id, req.user.id);
    if (!person) return res.status(403).json({ error: 'Forbidden' });

    const result = db.prepare(`
      INSERT INTO memories (person_id, year, type, content, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(person_id, year, type, content, JSON.stringify(metadata));
    res.json({ id: result.lastInsertRowid });
  });

  // --- Analytics ---
  app.get('/api/analytics', authenticate, (req: any, res) => {
    const userId = req.user.id;
    const totalPeople = db.prepare('SELECT COUNT(*) as count FROM people WHERE user_id = ?').get(userId) as any;
    const categoryStats = db.prepare('SELECT category, COUNT(*) as count FROM people WHERE user_id = ? GROUP BY category').all(userId);
    const importanceStats = db.prepare('SELECT importance, COUNT(*) as count FROM people WHERE user_id = ? GROUP BY importance').all(userId);
    
    res.json({
      totalPeople: totalPeople.count,
      categoryStats,
      importanceStats
    });
  });

  // --- Groups (Collaboration) ---
  app.post('/api/groups', authenticate, (req: any, res) => {
    const { person_id, name, code_name } = req.body;
    const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const result = db.prepare(`
      INSERT INTO groups (creator_id, person_id, name, code_name, invite_code)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, person_id, name, code_name, invite_code);
    
    db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(result.lastInsertRowid, req.user.id);
    
    res.json({ id: result.lastInsertRowid, invite_code });
  });

  app.get('/api/groups/:id', authenticate, (req: any, res) => {
    const group = db.prepare(`
      SELECT g.*, p.name as person_name, p.birthday as person_birthday, p.notes as person_notes, p.category as person_category
      FROM groups g
      JOIN people p ON g.person_id = p.id
      JOIN group_members gm ON g.id = gm.group_id
      WHERE g.id = ? AND gm.user_id = ?
    `).get(req.params.id, req.user.id) as any;
    
    if (!group) return res.status(404).json({ error: 'Group not found' });
    
    const members = db.prepare(`
      SELECT u.id, u.name, u.email
      FROM users u
      JOIN group_members gm ON u.id = gm.user_id
      WHERE gm.group_id = ?
    `).all(req.params.id);
    
    const ideas = db.prepare('SELECT * FROM group_ideas WHERE group_id = ?').all(req.params.id);
    const contributions = db.prepare('SELECT * FROM group_contributions WHERE group_id = ?').all(req.params.id);
    
    res.json({ ...group, members, ideas, contributions });
  });

  app.post('/api/groups/join', authenticate, (req: any, res) => {
    const { invite_code } = req.body;
    const group = db.prepare('SELECT id FROM groups WHERE invite_code = ?').get(invite_code) as any;
    if (!group) return res.status(404).json({ error: 'Invalid invite code' });
    
    try {
      db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(group.id, req.user.id);
      res.json({ id: group.id });
    } catch (err) {
      res.json({ id: group.id }); // Already a member
    }
  });

  app.post('/api/groups/:id/contribute', authenticate, (req: any, res) => {
    const { amount } = req.body;
    db.prepare('INSERT INTO group_contributions (group_id, user_id, amount, status) VALUES (?, ?, ?, ?)')
      .run(req.params.id, req.user.id, amount, 'completed');
    res.json({ success: true });
  });

  // --- WebSocket for Real-time Collaboration ---
  const clients = new Map<number, Set<WebSocket>>();

  wss.on('connection', (ws, req) => {
    let currentGroupId: number | null = null;
    let userId: number | null = null;

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'join') {
          currentGroupId = data.groupId;
          userId = data.userId;
          if (!clients.has(currentGroupId!)) clients.set(currentGroupId!, new Set());
          clients.get(currentGroupId!)?.add(ws);
        }

        if (data.type === 'idea' || data.type === 'vote' || data.type === 'contribution') {
          // Broadcast to all in group
          const groupClients = clients.get(currentGroupId!);
          groupClients?.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      if (currentGroupId && clients.has(currentGroupId)) {
        clients.get(currentGroupId)?.delete(ws);
      }
    });
  });

  // --- API Catch-all (Prevent HTML fallback for missing API routes) ---
  app.all('/api/*', (req, res) => {
    console.warn(`404 API Route: ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // --- Global Error Handler ---
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('SERVER ERROR:', err);
    res.status(res.statusCode === 200 ? 500 : res.statusCode).json({ 
      error: 'Internal Server Error', 
      message: err.message 
    });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`RelateOS running on http://localhost:${PORT}`);
  });
}

startServer();
