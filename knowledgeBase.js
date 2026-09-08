// Simple in-memory "knowledge base" the chatbot retrieves from.
// Each entry has keywords used for matching + the answer text.
const knowledgeBase = [
  {
    topic: 'Refund Policy',
    keywords: ['refund', 'money back', 'reimburse', 'return payment'],
    answer:
      'Refunds are available within 30 days of purchase for unused services. ' +
      'Submit a ticket under the "Billing & Refunds" category with your order details, and our billing team will respond within 2 business days.',
  },
  {
    topic: 'SLA - Urgent',
    keywords: ['urgent sla', 'urgent response', 'urgent priority', 'critical issue time'],
    answer:
      'Urgent priority tickets receive an initial response within 1 hour and are worked continuously until resolved or a workaround is provided.',
  },
  {
    topic: 'SLA - High',
    keywords: ['high priority sla', 'high priority response'],
    answer: 'High priority tickets receive an initial response within 4 business hours.',
  },
  {
    topic: 'SLA - Medium',
    keywords: ['medium priority sla', 'medium priority response'],
    answer: 'Medium priority tickets receive an initial response within 1 business day.',
  },
  {
    topic: 'SLA - Low',
    keywords: ['low priority sla', 'low priority response'],
    answer: 'Low priority tickets receive an initial response within 3 business days.',
  },
  {
    topic: 'SLA General',
    keywords: ['sla', 'response time', 'how fast', 'turnaround'],
    answer:
      'Response times depend on ticket priority: Urgent (1 hour), High (4 business hours), Medium (1 business day), Low (3 business days).',
  },
  {
    topic: 'Escalation',
    keywords: ['escalate', 'escalation', 'speak to manager', 'not resolved'],
    answer:
      'To escalate a ticket, reply on the ticket asking for escalation, or raise a new ticket with category "Account & Security" and mention the original ticket number. Escalated tickets are reviewed by a senior agent within 4 business hours.',
  },
  {
    topic: 'Account Security',
    keywords: ['password', 'reset password', 'account locked', 'security', 'two factor', '2fa'],
    answer:
      'For password resets or account lockouts, submit a ticket under "Account & Security" with the email on your account. For security reasons we cannot reset passwords over chat.',
  },
  {
    topic: 'Billing',
    keywords: ['invoice', 'billing', 'charge', 'subscription', 'payment method'],
    answer:
      'Billing questions (invoices, charges, subscription changes) should be submitted under the "Billing & Refunds" category so our finance team can pull up your account.',
  },
];

function searchKnowledgeBase(message) {
  const lower = message.toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const entry of knowledgeBase) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) score += kw.split(' ').length; // longer phrase matches score higher
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return bestScore > 0 ? best : null;
}

module.exports = { knowledgeBase, searchKnowledgeBase };
