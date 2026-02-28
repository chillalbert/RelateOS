import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './db';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// --- Database Migrations ---
try {
  db.exec('ALTER TABLE groups ADD COLUMN target_amount REAL DEFAULT 500');
} catch (e) {}

try {
  db.exec('ALTER TABLE users ADD COLUMN appearance TEXT DEFAULT "light"');
} catch (e) {}

try {
  db.exec('ALTER TABLE users ADD COLUMN notification_settings TEXT DEFAULT \'{"birthdays":true,"tasks":true,"groups":true}\'');
} catch (e) {}

const JWT_SECRET = process.env.JWT_SECRET || 'relateos-secret';
const PORT = 3000;

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json());

  // --- Request Logging ---
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // --- Favicon Handler ---
  app.get('/favicon.ico', (req, res) => res.status(204).end());

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
      res.json({ token, user: { id: result.lastInsertRowid, email, name, appearance: 'light', notification_settings: { birthdays: true, tasks: true, groups: true } } });
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
    res.json({ token, user: { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      personality: user.reminder_personality,
      appearance: user.appearance,
      notification_settings: JSON.parse(user.notification_settings || '{"birthdays":true,"tasks":true,"groups":true}')
    } });
  });

  app.patch('/api/user/settings', authenticate, (req: any, res) => {
    const { personality } = req.body;
    db.prepare('UPDATE users SET reminder_personality = ? WHERE id = ?').run(personality, req.user.id);
    res.json({ success: true });
  });

  app.patch('/api/user/password', authenticate, async (req: any, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id) as any;
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid current password' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashedPassword, req.user.id);
    res.json({ success: true });
  });

  app.patch('/api/user/appearance', authenticate, (req: any, res) => {
    const { appearance } = req.body;
    db.prepare('UPDATE users SET appearance = ? WHERE id = ?').run(appearance, req.user.id);
    res.json({ success: true });
  });

  app.patch('/api/user/notification-settings', authenticate, (req: any, res) => {
    const { notification_settings } = req.body;
    db.prepare('UPDATE users SET notification_settings = ? WHERE id = ?').run(JSON.stringify(notification_settings), req.user.id);
    res.json({ success: true });
  });

  // --- Notifications Routes ---
  app.get('/api/notifications', authenticate, (req: any, res) => {
    // Check for birthdays first
    const today = new Date();
    const people = db.prepare('SELECT id, name, birthday FROM people WHERE user_id = ?').all(req.user.id) as any[];
    
    people.forEach(person => {
      const bday = new Date(person.birthday);
      if (bday.getMonth() === today.getMonth() && bday.getDate() === today.getDate()) {
        // Check if notification already exists for today
        const existing = db.prepare(`
          SELECT id FROM notifications 
          WHERE user_id = ? AND type = 'birthday' AND link = ? 
          AND date(created_at) = date('now')
        `).get(req.user.id, `/person/${person.id}`);
        
        if (!existing) {
          db.prepare(`
            INSERT INTO notifications (user_id, type, title, message, link)
            VALUES (?, 'birthday', 'Birthday Today!', ?, ?)
          `).run(req.user.id, `It's ${person.name}'s birthday today! Don't forget to reach out.`, `/person/${person.id}`);
        }
      }
    });

    const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
    res.json(notifications);
  });

  app.patch('/api/notifications/:id/read', authenticate, (req: any, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
  });

  app.delete('/api/notifications/:id', authenticate, (req: any, res) => {
    db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
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

  // --- AI Routes ---
  app.post('/api/ai/birthday-message', authenticate, async (req: any, res) => {
    const { relationship, yearsKnown, memories, tone, length } = req.body;
    const prompt = `
      Generate a birthday message for a ${relationship} I've known for ${yearsKnown} years.
      Context/Memories: ${memories.join(', ')}
      Tone: ${tone}
      Length: ${length}
      
      Provide the response in JSON format with the following fields:
      - shortText: A quick SMS style message.
      - instagramCaption: A caption for a post.
      - cardMessage: A longer, more thoughtful message for a physical card.
      - voiceScript: A script for a voice message.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              shortText: { type: Type.STRING },
              instagramCaption: { type: Type.STRING },
              cardMessage: { type: Type.STRING },
              voiceScript: { type: Type.STRING },
            },
            required: ["shortText", "instagramCaption", "cardMessage", "voiceScript"]
          }
        }
      });
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai/recovery-plan', authenticate, async (req: any, res) => {
    const { daysLate, relationship } = req.body;
    const prompt = `
      I missed a birthday for a ${relationship} by ${daysLate} days.
      Generate a "Late but Legendary" recovery plan.
      
      Provide the response in JSON format with:
      - apologyMessage: A sincere but charming apology.
      - recoveryGiftIdeas: 3 gift ideas that make up for being late.
      - followUpPlan: A 48-hour checklist to fix the relationship.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              apologyMessage: { type: Type.STRING },
              recoveryGiftIdeas: { type: Type.ARRAY, items: { type: Type.STRING } },
              followUpPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["apologyMessage", "recoveryGiftIdeas", "followUpPlan"]
          }
        }
      });
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error("AI Recovery Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai/gift-suggestions', authenticate, async (req: any, res) => {
    const { interests, budget, relationship } = req.body;
    const prompt = `
      Find the best gift ideas for a ${relationship} with these interests: ${interests}.
      The current budget is $${budget}.
      
      Provide the response in JSON format with:
      - suggestions: An array of objects, each with:
        - title: Name of the product.
        - price: Estimated price.
        - reason: Why it's a good fit.
        - searchUrl: A Google Search URL to find/buy this product.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    price: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    searchUrl: { type: Type.STRING },
                  },
                  required: ["title", "price", "reason", "searchUrl"]
                }
              }
            },
            required: ["suggestions"]
          }
        }
      });
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error("AI Gift Suggestion Error:", error);
      res.status(500).json({ error: error.message });
    }
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
    if (res.headersSent) return next(err);
    console.error('SERVER ERROR:', err);
    res.status(res.statusCode === 200 ? 500 : res.statusCode).json({ 
      error: 'Internal Server Error', 
      message: err.message 
    });
  });

  // --- Vite / Static / SPA Fallback ---
  const isProduction = process.env.NODE_ENV === 'production';
  console.log(`[SERVER] Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  
  if (!isProduction) {
    console.log('[SERVER] Initializing Vite middleware...');
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
        root: process.cwd(),
      });
      app.use(vite.middlewares);
      console.log('[SERVER] Vite middleware initialized.');
    } catch (viteErr) {
      console.error('[SERVER] FAILED TO INITIALIZE VITE:', viteErr);
    }
    
    // Fallback for SPA in development
    app.get('*', (req, res, next) => {
      if (req.url.startsWith('/api/') || req.url.startsWith('/src/') || req.url.startsWith('/@vite')) return next();
      console.log(`[SERVER] Development SPA Fallback: ${req.url}`);
      res.sendFile(path.join(process.cwd(), 'index.html'));
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    const indexPath = path.join(distPath, 'index.html');
    console.log(`[SERVER] Serving static files from: ${distPath}`);
    console.log(`[SERVER] Checking for index.html at: ${indexPath}`);
    
    if (!fs.existsSync(indexPath)) {
      console.warn(`[SERVER] WARNING: index.html NOT FOUND at ${indexPath}. SPA fallback will fail.`);
      // If index.html is missing in dist, maybe we are in a weird state.
      // Let's try to serve the root index.html as a last resort?
      // No, that would cause the MIME type error.
    }

    app.use(express.static(distPath, {
      setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css');
        } else if (path.endsWith('.svg')) {
          res.setHeader('Content-Type', 'image/svg+xml');
        } else if (path.endsWith('.png')) {
          res.setHeader('Content-Type', 'image/png');
        } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
          res.setHeader('Content-Type', 'image/jpeg');
        } else if (path.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/json');
        }
      }
    }));
    app.get('*', (req, res, next) => {
      if (req.url.startsWith('/api/')) return next();
      console.log(`[SERVER] Production SPA Fallback: ${req.url}`);
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Not Found (Production Build Missing)');
      }
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] RelateOS started on http://localhost:${PORT} [${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}]`);
    console.log(`[SERVER] Time: ${new Date().toISOString()}`);
    console.log(`[SERVER] CWD: ${process.cwd()}`);
    console.log(`[SERVER] __dirname: ${__dirname}`);
    console.log(`[SERVER] NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`[SERVER] PORT: ${PORT}`);
    console.log(`[SERVER] GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET'}`);
    console.log(`[SERVER] JWT_SECRET: ${process.env.JWT_SECRET ? 'SET' : 'NOT SET'}`);
    console.log(`[SERVER] APP_URL: ${process.env.APP_URL || 'NOT SET'}`);
    console.log(`[SERVER] DISABLE_HMR: ${process.env.DISABLE_HMR || 'NOT SET'}`);
    console.log(`[SERVER] AISTUDIO_API_KEY: ${process.env.AISTUDIO_API_KEY ? 'SET' : 'NOT SET'}`);
    console.log(`[SERVER] API_KEY: ${process.env.API_KEY ? 'SET' : 'NOT SET'}`);
    console.log(`[SERVER] USER_EMAIL: ${process.env.USER_EMAIL || 'NOT SET'}`);
    console.log(`[SERVER] SHARED_APP_URL: ${process.env.SHARED_APP_URL || 'NOT SET'}`);
    console.log(`[SERVER] NODE_VERSION: ${process.version}`);
    console.log(`[SERVER] PLATFORM: ${process.platform}`);
    console.log(`[SERVER] MEMORY_USAGE: ${JSON.stringify(process.memoryUsage())}`);
    console.log(`[SERVER] UPTIME: ${process.uptime()}`);
    console.log(`[SERVER] PID: ${process.pid}`);
    console.log(`[SERVER] ARCH: ${process.arch}`);
    console.log(`[SERVER] EXEC_PATH: ${process.execPath}`);
    console.log(`[SERVER] ARGV: ${JSON.stringify(process.argv)}`);
    console.log(`[SERVER] ENV_KEYS: ${JSON.stringify(Object.keys(process.env))}`);
    console.log(`[SERVER] FILES: ${fs.readdirSync(process.cwd())}`);
    console.log(`[SERVER] DIST_FILES: ${fs.existsSync('dist') ? fs.readdirSync('dist') : 'NOT FOUND'}`);
    console.log(`[SERVER] SRC_FILES: ${fs.existsSync('src') ? fs.readdirSync('src') : 'NOT FOUND'}`);
    console.log(`[SERVER] PUBLIC_FILES: ${fs.existsSync('public') ? fs.readdirSync('public') : 'NOT FOUND'}`);
    console.log(`[SERVER] NODE_MODULES: ${fs.existsSync('node_modules') ? 'FOUND' : 'NOT FOUND'}`);
    console.log(`[SERVER] PACKAGE_JSON: ${fs.existsSync('package.json') ? 'FOUND' : 'NOT FOUND'}`);
    console.log(`[SERVER] VITE_CONFIG: ${fs.existsSync('vite.config.ts') ? 'FOUND' : 'NOT FOUND'}`);
  });
}

startServer().catch(err => {
  console.error('CRITICAL SERVER START ERROR:', err);
  process.exit(1);
});
