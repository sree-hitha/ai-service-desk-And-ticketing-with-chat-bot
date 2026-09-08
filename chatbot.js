const { searchKnowledgeBase } = require('./knowledgeBase');

const GREETING_WORDS = ['hi', 'hello', 'hey', 'good morning', 'good afternoon'];
const TICKET_STATUS_WORDS = ['ticket', 'status', 'my tickets', 'ticket number', 'ticket #'];
const OFF_TOPIC_REFUSAL =
  "I'm the Relay support assistant, so I can only help with account, billing, ticket-status, and support-policy questions here. " +
  'For anything outside that (writing code, general trivia, etc.) please use a different tool. ' +
  'I can help you check ticket status, or answer questions about refunds, SLAs, and escalation — what do you need?';

function isGreeting(lower) {
  return GREETING_WORDS.some((g) => lower.startsWith(g));
}

function mentionsTicketStatus(lower) {
  return TICKET_STATUS_WORDS.some((w) => lower.includes(w));
}

function getTicketSummary(db, userId) {
  const rows = db
    .prepare('SELECT id, subject, status, priority, created_at FROM tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT 5')
    .all(userId);

  if (rows.length === 0) {
    return "You don't have any tickets on file yet. You can raise one using the 'Raise a Support Ticket' form.";
  }

  const lines = rows.map(
    (t) => `#${t.id} — "${t.subject}" (${t.priority} priority) — status: ${t.status}`
  );
  return `Here are your most recent tickets:\n${lines.join('\n')}`;
}

/**
 * Core chatbot response function.
 * Retrieves from the ticket DB (if the user is asking about their tickets)
 * or the static knowledge base (for policy/SLA/refund questions).
 * Falls back to a guardrail refusal for anything out of domain.
 */
async function getChatResponse({ message, userId, db }) {
  const lower = message.trim().toLowerCase();

  if (!lower) {
    return 'Could you tell me a bit more about what you need help with?';
  }

  if (isGreeting(lower) && lower.length < 20) {
    return 'Hello! I can check your ticket status or answer questions about refunds, SLAs, and escalation. What do you need help with?';
  }

  // Ticket-status intent -> query live DB (the "RAG" grounding source for account data)
  if (mentionsTicketStatus(lower)) {
    if (!userId) {
      return 'Please sign in first so I can look up your tickets.';
    }
    try {
      return getTicketSummary(db, userId);
    } catch (err) {
      console.error('Chatbot ticket lookup failed:', err);
      return "I couldn't reach the ticket database just now. Please try again in a moment.";
    }
  }

  // Policy/SLA/refund knowledge-base retrieval
  const kbHit = searchKnowledgeBase(lower);
  if (kbHit) {
    return kbHit.answer;
  }

  // Guardrail: refuse anything outside support scope (coding help, trivia, etc.)
  return OFF_TOPIC_REFUSAL;
}

module.exports = { getChatResponse };
