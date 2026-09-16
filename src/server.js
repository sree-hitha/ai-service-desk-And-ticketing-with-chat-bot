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

// ============================================================
// FRONTEND PATH
// server.js is inside /src
// index.html is inside /public
// Therefore: ../public
// ============================================================

const publicPath = path.join(__dirname, '../public');

console.log('Frontend path:', publicPath);

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve index.html, app.js and styles.css from /public
app.use(express.static(publicPath));

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

function requireAuth(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({
      error: 'Not authenticated',
    });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    console.error('Authentication error:', err);

    return res.status(401).json({
      error: 'Invalid or expired session',
    });
  }
}

// ============================================================
// AUTH COOKIE
// ============================================================

function setAuthCookie(res, user) {
  const token = jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    JWT_SECRET,
    {
      expiresIn: '7d',
    }
  );

  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// ============================================================
// SIGNUP
// ============================================================

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      error: 'Name, email, and password are required.',
    });
  }

  try {
    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    if (cleanName.length < 2) {
      return res.status(400).json({
        error: 'Name must contain at least 2 characters.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must contain at least 6 characters.',
      });
    }

    const existing = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(cleanEmail);

    if (existing) {
      return res.status(409).json({
        error: 'An account with that email already exists.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const info = db
      .prepare(
        `
        INSERT INTO users
        (name, email, password_hash)
        VALUES (?, ?, ?)
        `
      )
      .run(cleanName, cleanEmail, passwordHash);

    const user = {
      id: Number(info.lastInsertRowid),
      name: cleanName,
      email: cleanEmail,
    };

    setAuthCookie(res, user);

    // Email should not prevent account creation if email service fails
    sendWelcomeEmail(user.email, user.name).catch((err) => {
      console.error('Welcome email error:', err);
    });

    return res.status(201).json({
      user,
    });
  } catch (err) {
    console.error('Signup error:', err);

    return res.status(500).json({
      error: 'Signup failed.',
    });
  }
});

// ============================================================
// LOGIN
// ============================================================

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required.',
    });
  }

  try {
    const cleanEmail = String(email).trim().toLowerCase();

    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(cleanEmail);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password.',
      });
    }

    const match = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!match) {
      return res.status(401).json({
        error: 'Invalid email or password.',
      });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    setAuthCookie(res, safeUser);

    return res.json({
      user: safeUser,
    });
  } catch (err) {
    console.error('Login error:', err);

    return res.status(500).json({
      error: 'Login failed.',
    });
  }
});

// ============================================================
// LOGOUT
// ============================================================

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');

  return res.json({
    ok: true,
  });
});

// ============================================================
// CURRENT USER
// ============================================================

app.get('/api/auth/me', requireAuth, (req, res) => {
  return res.json({
    user: req.user,
  });
});

// ============================================================
// CREATE TICKET
// ============================================================

app.post('/api/tickets', requireAuth, (req, res) => {
  const {
    subject,
    category,
    priority,
    description,
  } = req.body;

  if (!subject || !category || !description) {
    return res.status(400).json({
      error: 'Subject, category, and description are required.',
    });
  }

  try {
    const info = db
      .prepare(
        `
        INSERT INTO tickets
        (
          user_id,
          subject,
          category,
          priority,
          description
        )
        VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(
        req.user.id,
        subject,
        category,
        priority || 'Medium',
        description
      );

    const ticket = db
      .prepare(
        'SELECT * FROM tickets WHERE id = ?'
      )
      .get(info.lastInsertRowid);

    return res.status(201).json({
      ticket,
    });
  } catch (err) {
    console.error('Create ticket error:', err);

    return res.status(500).json({
      error: 'Could not create ticket.',
    });
  }
});

// ============================================================
// GET USER TICKETS
// ============================================================

app.get('/api/tickets', requireAuth, (req, res) => {
  try {
    const tickets = db
      .prepare(
        `
        SELECT *
        FROM tickets
        WHERE user_id = ?
        ORDER BY created_at DESC
        `
      )
      .all(req.user.id);

    return res.json({
      tickets,
    });
  } catch (err) {
    console.error('Fetch tickets error:', err);

    return res.status(500).json({
      error: 'Could not fetch tickets.',
    });
  }
});

// ============================================================
// CHATBOT
// ============================================================

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  if (!message || !String(message).trim()) {
    return res.status(400).json({
      error: 'Message is required.',
    });
  }

  let userId = null;

  const token = req.cookies.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.id;
    } catch (err) {
      userId = null;
    }
  }

  try {
    const reply = await getChatResponse({
      message: String(message).trim(),
      userId,
      db,
    });

    return res.json({
      reply,
    });
  } catch (err) {
    console.error('Chat error:', err);

    return res.status(500).json({
      error: 'Chat assistant is temporarily unavailable.',
    });
  }
});

// ============================================================
// STATS
// ============================================================

app.get('/api/stats', requireAuth, (req, res) => {
  try {
    const users = db
      .prepare('SELECT id FROM users')
      .all();

    const tickets = db
      .prepare('SELECT * FROM tickets')
      .all();

    return res.json({
      total_users: users.length,
      users,
      total_tickets: tickets.length,
      tickets,
    });
  } catch (err) {
    console.error('Stats error:', err);

    return res.status(500).json({
      error: err.message,
    });
  }
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/api/health', (req, res) => {
  return res.json({
    status: 'ok',
    message: 'Relay Service Desk API is running',
  });
});

// ============================================================
// FRONTEND FALLBACK
// ============================================================

// This sends public/index.html for browser page requests.
// It intentionally comes AFTER all /api routes.
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }

  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'API endpoint not found.',
    });
  }

  return res.sendFile(
    path.join(publicPath, 'index.html')
  );
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {
  console.error('Server error:', err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    error: 'Internal server error.',
  });
});

// ============================================================
// DATABASE + SERVER START
// ============================================================

try {
  initDB();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Relay Service Desk running at http://localhost:${PORT}`
    );

    console.log(
      `Serving frontend from: ${publicPath}`
    );
  });
} catch (err) {
  console.error('Failed to start server:', err);
  process.exit(1);
}