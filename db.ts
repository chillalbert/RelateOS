import Database from 'better-sqlite3';
import path from 'path';

const db = new Database('relateos.db');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    reminder_personality TEXT DEFAULT 'chill',
    appearance TEXT DEFAULT 'light',
    notification_settings TEXT DEFAULT '{"birthdays":true,"tasks":true,"groups":true}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'birthday', 'task', 'group'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    nickname TEXT,
    birthday TEXT NOT NULL,
    category TEXT NOT NULL,
    importance INTEGER DEFAULT 3,
    photo_url TEXT,
    notes TEXT,
    reminder_settings TEXT DEFAULT '{"30_days":true,"7_days":true,"morning":true}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    due_date TEXT,
    completed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES people (id)
  );

  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'gift', 'reaction', 'joke', 'milestone', 'idea'
    content TEXT NOT NULL,
    metadata TEXT, -- JSON string for extra data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES people (id)
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    person_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code_name TEXT,
    invite_code TEXT UNIQUE NOT NULL,
    target_amount REAL DEFAULT 500,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users (id),
    FOREIGN KEY (person_id) REFERENCES people (id)
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES groups (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS group_ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    votes TEXT DEFAULT '[]', -- JSON array of user_ids
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS group_contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS reflections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    content TEXT NOT NULL, -- JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES people (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  );
`);

export default db;
