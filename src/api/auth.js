// Auth API client. Calls are made to /api/* which Vite proxies to the
// Express server during development (see vite.config.js).

const TOKEN_KEY = 'auth_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)
export const isLoggedIn = () => Boolean(getToken())

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Cannot reach the server. Is it running?')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`)
  }
  return data
}

export async function signup({ name, email, password }) {
  const data = await request('/signup', {
    method: 'POST',
    body: { name, email, password },
  })
  setToken(data.token)
  return data.user
}

export async function login({ email, password }) {
  const data = await request('/login', {
    method: 'POST',
    body: { email, password },
  })
  setToken(data.token)
  return data.user
}

export async function getMe() {
  const data = await request('/me', { auth: true })
  return data.user
}

export function logout() {
  clearToken()
}
