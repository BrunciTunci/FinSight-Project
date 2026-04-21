export type ApiError = { error: string }

export type AuthResponse = { token: string; username: string }

export type Health = { status: string }

export type Account = {
  id: string
  name: string
  currency: string
  createdAtUtc: string
}

export type Transaction = {
  id: string
  accountId: string
  date: string
  amount: number
  category: string
  note?: string | null
  createdAtUtc: string
}

export type WatchlistItem = {
  id: string
  symbol: string
  addedAtUtc: string
}

export type StockQuote = {
  symbol: string
  price: number
  changePercent: number
  asOfUtc: string
}
