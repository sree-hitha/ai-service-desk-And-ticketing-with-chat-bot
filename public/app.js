const $ = (id) => document.getElementById(id);

let currentUser = null;

function showAlert(message, type = 'error') {
  const box = $('alert-box');
  box.textContent = message;
  box.className = `alert ${type}`;
  setTimeout(() => box.classList.add('hidden'), 4000);
}

// --- View switching ---
function showDashboard(user) {
  currentUser = user;
  $('auth-section').classList.add('hidden');
  $('dashboard-section').classList.remove('hidden');
  $('nav-user-panel').classList.remove('hidden');
  $('user-greeting').textContent = `Hi, ${user.name || user.email}`;
  loadTickets();
}

function showAuth() {
  currentUser = null;
  $('dashboard-section').classList.add('hidden');
  $('auth-section').classList.remove('hidden');
  $('nav-user-panel').classList.add('hidden');
}

// --- Tabs ---
$('tab-login').addEventListener('click', () => {
  $('tab-login').classList.add('active');
  $('tab-signup').classList.remove('active');
  $('login-form').classList.remove('hidden');
  $('signup-form').classList.add('hidden');
});

$('tab-signup').addEventListener('click', () => {
  $('tab-signup').classList.add('active');
  $('tab-login').classList.remove('active');
  $('signup-form').classList.remove('hidden');
  $('login-form').classList.add('hidden');
});

// --- Auth: check session on load ---
async function checkSession() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      showDashboard(data.user);
    } else {
      showAuth();
    }
  } catch (err) {
    showAuth();
  }
}

// --- Login ---
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('login-email').value;
  const password = $('login-password').value;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return showAlert(data.error || 'Login failed');
    showAlert('Signed in successfully.', 'success');
    showDashboard(data.user);
  } catch (err) {
    showAlert('Network error during login.');
  }
});

// --- Signup ---
$('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('signup-name').value;
  const email = $('signup-email').value;
  const password = $('signup-password').value;
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) return showAlert(data.error || 'Sign up failed');
    showAlert('Account created! Welcome email sent.', 'success');
    showDashboard(data.user);
  } catch (err) {
    showAlert('Network error during signup.');
  }
});

// --- Logout ---
$('logout-btn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  showAuth();
});

// --- Tickets ---
async function loadTickets() {
  const container = $('tickets-container');
  container.innerHTML = '<p class="empty-state">Loading your tickets...</p>';
  try {
    const res = await fetch('/api/tickets');
    const data = await res.json();
    if (!res.ok) {
      container.innerHTML = `<p class="empty-state">Could not load tickets.</p>`;
      return;
    }
    if (data.tickets.length === 0) {
      container.innerHTML = '<p class="empty-state">No tickets yet. Raise one using the form.</p>';
      return;
    }
    container.innerHTML = data.tickets
      .map(
        (t) => `
        <div class="ticket-item">
          <div class="ticket-top">
            <span>#${t.id} ${escapeHtml(t.subject)}</span>
            <span class="badge ${t.priority}">${t.priority}</span>
          </div>
          <div class="ticket-meta">${t.category} · Status: ${t.status} · ${new Date(t.created_at).toLocaleString()}</div>
        </div>`
      )
      .join('');
  } catch (err) {
    container.innerHTML = '<p class="empty-state">Network error loading tickets.</p>';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

$('refresh-tickets-btn').addEventListener('click', loadTickets);

$('ticket-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const subject = $('ticket-subject').value;
  const category = $('ticket-category').value;
  const priority = $('ticket-priority').value;
  const description = $('ticket-description').value;
  try {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, category, priority, description }),
    });
    const data = await res.json();
    if (!res.ok) return showAlert(data.error || 'Could not submit ticket.');
    showAlert('Ticket submitted!', 'success');
    e.target.reset();
    loadTickets();
  } catch (err) {
    showAlert('Network error submitting ticket.');
  }
});

// --- Chat widget ---
$('chat-toggle-btn').addEventListener('click', () => {
  $('chat-window').classList.toggle('hidden');
});
$('chat-close-btn').addEventListener('click', () => {
  $('chat-window').classList.add('hidden');
});

function appendChatMessage(text, sender) {
  const el = document.createElement('div');
  el.className = `msg ${sender === 'user' ? 'user-msg' : 'bot-msg'}`;
  el.textContent = text;
  $('chat-messages').appendChild(el);
  $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
}

$('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('chat-input');
  const message = input.value.trim();
  if (!message) return;
  appendChatMessage(message, 'user');
  input.value = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    appendChatMessage(data.reply || data.error || 'Sorry, something went wrong.', 'bot');
  } catch (err) {
    appendChatMessage('Network error — please try again.', 'bot');
  }
});

// Init
checkSession();
