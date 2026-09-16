# ⚡ Relay Service Desk

A customer support portal with account authentication, a ticket system, and a
support chatbot that answers policy questions and looks up ticket status —
built with a lightweight retrieval (RAG-style) approach instead of an
external AI API.

![Node](https://img.shields.io/badge/node-%3E%3D22.13-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Features

- 🔐 **Authentication** — signup/login with bcrypt-hashed passwords and JWT sessions stored in HttpOnly cookies (not readable by client-side JS, which mitigates XSS-based token theft)
- 🎫 **Ticketing** — customers can raise tickets with a subject, category, priority, and description, and view their own ticket history
- 🤖 **Support chatbot** — answers policy/SLA/refund questions from a knowledge base and looks up a signed-in user's live ticket status; politely declines anything outside that scope (a basic guardrail)
- 📧 **Welcome emails** — sent via Nodemailer on signup, with a console-log fallback if SMTP isn't configured (handy for local dev)
- 🗄️ **Zero-setup database** — uses Node's built-in `node:sqlite` module, so there's no database server to install, configure, or authenticate against

## Why no external AI API or database server?

This project is intentionally dependency-light so it's easy to clone and run
anywhere:

- The chatbot uses simple keyword matching against a static knowledge base
  (see [`src/knowledgeBase.js`](src/knowledgeBase.js)) plus direct database
  queries for ticket status — no API key required. Swapping in a real LLM
  call (e.g. the Anthropic API) later only means editing
  [`src/chatbot.js`](src/chatbot.js).
- The database is SQLite via Node's built-in `node:sqlite` module (stable,
  no-flag-needed since Node 22.13 / 23.4+) — a single file (`relay.db`)
  created automatically on first run. No Postgres/MySQL install, no service
  to manage, no password to configure.

## Tech stack

| Layer      | Choice                                    |
|------------|--------------------------------------------|
| Backend    | Node.js + Express                          |
| Database   | SQLite (`node:sqlite`, built into Node.js) |
| Auth       | JWT in HttpOnly cookies, bcrypt password hashing |
| Email      | Nodemailer (console-log fallback if unconfigured) |
| Frontend   | Vanilla HTML/CSS/JS (no build step)        |

## Project structure

```
relay-service-desk/
├── .env                     # Port, JWT secret, email config
├── package.json             # Dependencies & start scripts
├── README.md
├── src/
│   ├── db.js                # SQLite connection + schema (users, tickets tables)
│   ├── email.js              # Welcome email sender (Nodemailer), with console fallback
│   ├── knowledgeBase.js      # Static policy/SLA/refund knowledge base for the chatbot
│   ├── chatbot.js            # Chatbot engine: DB lookups + KB retrieval + guardrail
│   └── server.js             # Express app: auth, ticket, and chat API routes
└── public/
    ├── index.html            # Customer UI + floating support chat widget
    ├── styles.css             # Styling
    └── app.js                 # Client-side logic (auth forms, ticket list, chat)
```

## Getting started

**Requirements:** Node.js **22.13+** or **24+** (check with `node --version`
— SQLite support is built into Node itself starting at that version, no
extra install needed).

```bash
git clone <this-repo-url>
cd relay-service-desk
npm install
npm start
```

Open **http://localhost:3000**. That's the entire setup — no database
server, no `createdb`, no passwords to configure. The first run
auto-creates `relay.db` and the required tables.

### Environment variables (`.env`)

```env
PORT=3000
JWT_SECRET=replace_with_a_long_random_string

# Optional — leave blank to just log "sent" emails to the console
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=support@relay.local
```

> ⚠️ `.env` is committed here for local convenience, but in a real deployment
> it should be excluded via `.gitignore` and injected as environment
> variables instead — especially `JWT_SECRET`.

## Using the app

1. **Sign up** or **log in**.
2. **Raise a ticket** — subject, category, priority, and description.
3. **Chat with the assistant** (bottom-right "Need Help?" button):
   - *"What is your refund policy?"*
   - *"What are your SLAs for urgent issues?"*
   - *"How do I escalate my issue?"*
   - *"What is the status of my ticket?"* (pulls your live ticket data)
   - Try something off-topic like *"write a python script"* — the bot
     declines and redirects you to support topics. This is the guardrail
     in action.

## Database schema

```
users
├── id             INTEGER PRIMARY KEY
├── name           TEXT
├── email          TEXT UNIQUE
├── password_hash  TEXT
└── created_at     TEXT

tickets
├── id             INTEGER PRIMARY KEY
├── user_id        INTEGER  → references users.id
├── subject        TEXT
├── category       TEXT
├── priority       TEXT   (Low / Medium / High / Urgent)
├── description    TEXT
├── status         TEXT   (Open / In Progress / Resolved, etc.)
├── created_at     TEXT
└── updated_at     TEXT
```

Inspect the data directly any time with Node itself — no separate database
client needed:

```bash
node -e "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync('./relay.db'); console.log(db.prepare('SELECT * FROM users').all()); console.log(db.prepare('SELECT * FROM tickets').all());"
```

## Extending the chatbot into full RAG

Right now [`src/knowledgeBase.js`](src/knowledgeBase.js) is a small static
array of policy topics matched by keyword. To grow this into a fuller
retrieval-augmented setup:

1. Add more entries to `knowledgeBase.js` (or load them from external
   `.md`/`.txt` policy documents at startup).
2. For better matching than keyword search, swap the matcher in
   `searchKnowledgeBase()` for embeddings-based similarity search.
3. To use a real LLM for the final answer generation (instead of returning
   the raw KB entry), call an AI API from `getChatResponse()` in
   `src/chatbot.js`, passing in the retrieved KB entries as context.

The guardrail (declining off-topic requests) and the live ticket-status
lookup are already structured to keep working unchanged if you make this
swap.

## Resetting local data

Delete `relay.db` from the project root and restart the app — a fresh
empty database is created automatically.

## License

MIT — feel free to fork and adapt.
