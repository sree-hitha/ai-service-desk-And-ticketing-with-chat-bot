require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { db, initDB } = require('./db');
const { sendWelcomeEmail } = require('./email');
const { getChatResponse } = require('./chatbot');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// --- Auth middleware ---
function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function setAuthCookie(res, user) {
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, {
    expiresIn: '7d',
  });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// --- Auth routes ---
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const info = db
      .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run(name, email, passwordHash);
    const user = { id: info.lastInsertRowid, name, email };
    setAuthCookie(res, user);
    sendWelcomeEmail(user.email, user.name).catch((e) => console.error('Welcome email error:', e));
    res.status(201).json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Signup failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

    setAuthCookie(res, user);
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// --- Ticket routes ---
app.post('/api/tickets', requireAuth, (req, res) => {
  const { subject, category, priority, description } = req.body;
  if (!subject || !category || !description) {
    return res.status(400).json({ error: 'Subject, category, and description are required.' });
  }
  try {
    const info = db
      .prepare(
        `INSERT INTO tickets (user_id, subject, category, priority, description)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(req.user.id, subject, category, priority || 'Medium', description);
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ ticket });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create ticket.' });
  }
});

app.get('/api/tickets', requireAuth, (req, res) => {
  try {
    const tickets = db
      .prepare('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.user.id);
    res.json({ tickets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch tickets.' });
  }
});

// --- Chatbot route ---
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required.' });

  // Chat works for logged-out users too (policy questions), but ticket
  // lookups require auth — chatbot.js handles that check internally.
  let userId = null;
  const token = req.cookies.token;
  if (token) {
    try {
      userId = jwt.verify(token, JWT_SECRET).id;
    } catch (_) {
      userId = null;
    }
  }

  try {
    const reply = await getChatResponse({ message, userId, db });
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat assistant is temporarily unavailable.' });
  }
});

// Admin/stats endpoint (used internally, kept simple)
app.get('/api/stats', requireAuth, (req, res) => {
  try {
    const users = db.prepare('SELECT id FROM users').all();
    const tickets = db.prepare('SELECT * FROM tickets').all();
    res.json({
      total_users: users.length,
      users,
      total_tickets: tickets.length,
      tickets,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Server
initDB();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Relay Service Desk running at http://localhost:${PORT}`);
});
