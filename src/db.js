const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Uses Node's BUILT-IN SQLite module (available unflagged since Node 22.13 / 23.4+).
// No npm package, no native compilation, no Visual Studio / build tools required.
const dbPath = path.join(__dirname, '..', 'relay.db');
const db = new DatabaseSync(dbPath);

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Medium',
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  console.log('Database schema ready (users, tickets) — SQLite file at', dbPath);
}

module.exports = { db, initDB };
