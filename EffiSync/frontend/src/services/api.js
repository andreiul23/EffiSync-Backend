// ──────────────────────────────────────────────────────────
// EffiSync API Client
// Centralised HTTP layer for all backend communication.
// ──────────────────────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const AUTH_BASE_URL = `${API_BASE_URL}/auth`;

// Endpoints that should NOT trigger the auto-logout-on-401 behaviour
// (login/register obviously return 401 on bad creds; that's user error,
// not an expired session).
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register'];

// ─── Core Fetch Wrapper ─────────────────────────────────

export const apiFetch = async (url, options = {}) => {
  const token = localStorage.getItem('effisync_jwt') || localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    // Bypass the ngrok free-tier browser warning page so API calls
    // return JSON instead of HTML when the backend is tunneled via ngrok.
    'ngrok-skip-browser-warning': 'true',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // 401 on an authenticated endpoint = session expired / token invalid.
    // Clear local auth state and bounce to /login. Skip for credential
    // endpoints where 401 simply means "wrong password".
    const isAuthEndpoint = AUTH_ENDPOINTS.some((p) => url.includes(p));
    if (response.status === 401 && !isAuthEndpoint && typeof window !== 'undefined') {
      try {
        localStorage.removeItem('effisync_jwt');
        localStorage.removeItem('token');
        localStorage.removeItem('effisync_user');
        localStorage.removeItem('effisync_logged_in');
      } catch { /* ignore storage errors */ }
      // Avoid redirect loop if we're already on login/signup.
      const path = window.location.pathname;
      if (path !== '/login' && path !== '/signup' && path !== '/') {
        window.location.replace('/login?error=session_expired');
      }
    }

    // Attach the parsed body + status so callers can branch on
    // server-provided error codes (e.g. `e.body.code === 'NO_GMAIL_LINKED'`).
    const err = new Error(data.message || data.error || 'An error occurred during the request');
    err.status = response.status;
    err.body = data;
    throw err;
  }

  return data;
};

// ─── Generic Helpers ────────────────────────────────────

const get = (url, options = {}) => apiFetch(url, { ...options, method: 'GET' });
const post = (url, body, options = {}) => apiFetch(url, { ...options, method: 'POST', body: JSON.stringify(body) });
const put = (url, body, options = {}) => apiFetch(url, { ...options, method: 'PUT', body: JSON.stringify(body) });
const del = (url, options = {}) => apiFetch(url, { ...options, method: 'DELETE' });

// ─── 1. Authentication ─────────────────────────────────
// Matches API_DOCS §1

export const auth = {
  /** POST /auth/register */
  register: (body) => post(`${AUTH_BASE_URL}/register`, body),

  /** POST /auth/login */
  login: (body) => post(`${AUTH_BASE_URL}/login`, body),

  /** GET /auth/me */
  me: () => get(`${AUTH_BASE_URL}/me`),

  /** GET /auth/google — returns the redirect URL (browser will follow) */
  googleLoginUrl: () => `${AUTH_BASE_URL}/google`,

  /** GET /auth/github — returns the redirect URL (browser will follow) */
  githubLoginUrl: () => `${AUTH_BASE_URL}/github`,
};

// ─── 2. Tasks & Gamification ────────────────────────────
// Matches API_DOCS §2

export const tasks = {
  /** GET /api/tasks?householdId=...&userId=... */
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`${API_BASE_URL}/tasks${query ? `?${query}` : ''}`);
  },

  /** POST /api/tasks */
  create: (body) => post(`${API_BASE_URL}/tasks`, body),

  /** PUT /api/tasks/:id */
  update: (id, body) => put(`${API_BASE_URL}/tasks/${id}`, body),

  /** DELETE /api/tasks/:id */
  remove: (id) => del(`${API_BASE_URL}/tasks/${id}`),

  /** POST /api/tasks/:id/accept */
  accept: (id, body) => post(`${API_BASE_URL}/tasks/${id}/accept`, body),

  /** POST /api/tasks/:id/validate */
  validate: (id, body) => post(`${API_BASE_URL}/tasks/${id}/validate`, body),

  /** POST /api/tasks/:id/veto */
  veto: (id, body) => post(`${API_BASE_URL}/tasks/${id}/veto`, body),

  /** PATCH /api/tasks/:id/complete */
  complete: (id, body) => apiFetch(`${API_BASE_URL}/tasks/${id}/complete`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }),
};

// ─── 3. AI Chat ─────────────────────────────────────────
// Matches API_DOCS §3

export const chat = {
  /** POST /api/chat */
  send: (body) => post(`${API_BASE_URL}/chat`, body),

  /** GET /api/chat/history?userId=... */
  history: (userId) => get(`${API_BASE_URL}/chat/history?userId=${userId}`),
};

// ─── 4. Debug (dev-only) ────────────────────────────────

export const debug = {
  /** GET /api/debug/trigger-report/:householdId */
  triggerReport: (householdId) => get(`${API_BASE_URL}/debug/trigger-report/${householdId}`),
};

export const households = {
  /** POST /api/households */
  create: (body) => post(`${API_BASE_URL}/households`, body),

  /** POST /api/households/join */
  join: (body) => post(`${API_BASE_URL}/households/join`, body),

  /** GET /api/households/:id */
  getById: (id) => get(`${API_BASE_URL}/households/${id}`),

  /** GET /api/households/:id/suggest-time */
  suggestTime: (id) => get(`${API_BASE_URL}/households/${id}/suggest-time`),

  /** GET /api/households/:id/shop */
  shopList: (id) => get(`${API_BASE_URL}/households/${id}/shop`),

  /** POST /api/households/:id/shop/purchase */
  shopPurchase: (id, rewardId) => post(`${API_BASE_URL}/households/${id}/shop/purchase`, { rewardId }),

  /** GET /api/households/:id/leaderboard */
  leaderboard: (id) => get(`${API_BASE_URL}/households/${id}/leaderboard`),
};

export const ai = {
  /** POST /api/ai/initialize */
  initialize: () => post(`${API_BASE_URL}/ai/initialize`, {}),

  /** POST /api/ai/sync-calendar */
  syncCalendar: () => post(`${API_BASE_URL}/ai/sync-calendar`, {}),

  /** POST /api/ai/suggest-task — returns a fully-formed task suggestion */
  suggestTask: (prompt) => post(`${API_BASE_URL}/ai/suggest-task`, { prompt }),
};

export const calendar = {
  /** POST /api/calendar/sync */
  sync: () => post(`${API_BASE_URL}/calendar/sync`, {}),
  /** GET /api/calendar/upcoming?days=3 */
  upcoming: (days = 3) => get(`${API_BASE_URL}/calendar/upcoming?days=${days}`),
};

export const demo = {
  /** POST /api/demo/login — bootstraps demo data and returns JWT */
  login: () => post(`${API_BASE_URL}/demo/login`, {}),
  /** GET /api/demo/info — exposes shareable demo credentials */
  info: () => get(`${API_BASE_URL}/demo/info`),
};

// ─── Legacy default export (backward-compatible) ────────

export const api = {
  get: (endpoint, options) => get(`${API_BASE_URL}${endpoint}`, options),
  post: (endpoint, body, options) => post(`${API_BASE_URL}${endpoint}`, body, options),
  put: (endpoint, body, options) => put(`${API_BASE_URL}${endpoint}`, body, options),
  patch: (endpoint, body, options) => apiFetch(`${API_BASE_URL}${endpoint}`, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  delete: (endpoint, options) => del(`${API_BASE_URL}${endpoint}`, options),
};
