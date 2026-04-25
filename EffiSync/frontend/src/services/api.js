// ──────────────────────────────────────────────────────────
// EffiSync API Client
// Centralised HTTP layer for all backend communication.
// ──────────────────────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const AUTH_BASE_URL = `${API_BASE_URL}/auth`;

// ─── Core Fetch Wrapper ─────────────────────────────────

export const apiFetch = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
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
    throw new Error(data.message || data.error || 'An error occurred during the request');
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

  /** GET /auth/google — returns the redirect URL (browser will follow) */
  googleLoginUrl: () => `${AUTH_BASE_URL}/google`,
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

// ─── Legacy default export (backward-compatible) ────────

export const api = {
  get: (endpoint, options) => get(`${API_BASE_URL}${endpoint}`, options),
  post: (endpoint, body, options) => post(`${API_BASE_URL}${endpoint}`, body, options),
  put: (endpoint, body, options) => put(`${API_BASE_URL}${endpoint}`, body, options),
  delete: (endpoint, options) => del(`${API_BASE_URL}${endpoint}`, options),
};
