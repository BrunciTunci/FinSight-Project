import type { ApiError, Account, AuthResponse, Health, StockQuote, Transaction, WatchlistItem } from './types'

const TOKEN_KEY = 'finsight_token'
const USERNAME_KEY = 'finsight_username'
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export const auth = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getUsername: () => localStorage.getItem(USERNAME_KEY),
  saveSession: (token: string, username: string) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USERNAME_KEY, username)
  },
  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USERNAME_KEY)
  },
  isLoggedIn: () => !!localStorage.getItem(TOKEN_KEY),
}

async function request<T>(path: string, init?: RequestInit, requiresAuth = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> ?? {}),
  }

  if (requiresAuth) {
    const token = auth.getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers })

  if (!res.ok) {
    let message = `Request failed: ${res.status} ${res.statusText}`
    try {
      const body = (await res.json()) as ApiError
      if (body?.error) message = body.error
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }

  return (await res.json()) as T
}

export const api = {
  health: () => request<Health>('/api/health', undefined, false),

  login: (username: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }, false),

  register: (username: string, password: string) =>
    request<{ message: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }, false),

  getAccounts: () => request<Account[]>('/api/accounts'),
  createAccount: (name: string, currency?: string) =>
    request<Account>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ name, currency }),
    }),

  getTransactions: (accountId?: string) =>
    request<Transaction[]>(`/api/transactions${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ''}`),
  createTransaction: (payload: {
    accountId: string
    date?: string
    amount: number
    category?: string
    note?: string
  }) =>
    request<Transaction>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getWatchlist: () => request<WatchlistItem[]>('/api/stocks/watchlist'),
  addWatchlistItem: (symbol: string) =>
    request<WatchlistItem>('/api/stocks/watchlist', {
      method: 'POST',
      body: JSON.stringify({ symbol }),
    }),

  getQuote: (symbol: string) => request<StockQuote>(`/api/stocks/quote/${encodeURIComponent(symbol)}`),

  deleteTransaction: (id: string) =>
    request<void>(`/api/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  deleteWatchlistItem: (id: string) =>
    request<void>(`/api/stocks/watchlist/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}
