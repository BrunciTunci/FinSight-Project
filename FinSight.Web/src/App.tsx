import { useEffect, useMemo, useState } from 'react'
import { api, auth } from './api'
import type { Account, StockQuote, Transaction, WatchlistItem } from './types'
import Card from './components/Card'
import Sidebar, { type TabKey } from './components/Sidebar'
import AuthPage from './components/AuthPage'
import {
  Area,
  AreaChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function App() {
  const [username, setUsername] = useState<string | null>(() => auth.getUsername())

  function handleLogout() {
    auth.clearSession()
    setUsername(null)
  }

  if (!username) {
    return <AuthPage onAuthenticated={(u) => setUsername(u)} />
  }

  return <Dashboard username={username} onLogout={handleLogout} />
}

function Dashboard({ username, onLogout }: { username: string; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard')
  const [health, setHealth] = useState<string>('loading...')
  const [error, setError] = useState<string | null>(null)

  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])

  const [newAccountName, setNewAccountName] = useState('Main account')
  const [newAccountCurrency, setNewAccountCurrency] = useState('EUR')

  const [txAccountId, setTxAccountId] = useState<string>('')
  const [txType, setTxType] = useState<'income' | 'expense'>('expense')
  const [txAmount, setTxAmount] = useState<string>('10')
  const [txCategory, setTxCategory] = useState<string>('Food')
  const [txNote, setTxNote] = useState<string>('')
  const [txFilterAccountId, setTxFilterAccountId] = useState<string>('')

  const [newSymbol, setNewSymbol] = useState<string>('AAPL')
  const [quoteSymbol, setQuoteSymbol] = useState<string>('AAPL')
  const [quote, setQuote] = useState<StockQuote | null>(null)
  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string>('AAPL')

  const accountsById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])

  async function refreshAll() {
    setError(null)
    const [h, a, t, w] = await Promise.all([
      api.health(),
      api.getAccounts(),
      api.getTransactions(),
      api.getWatchlist(),
    ])
    setHealth(h.status)
    setAccounts(a)
    setTransactions(t)
    setWatchlist(w)
    if (!txAccountId && a.length > 0) setTxAccountId(a[0].id)
  }

  useEffect(() => {
    refreshAll().catch(e => setError(e instanceof Error ? e.message : String(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onCreateAccount() {
    try {
      setError(null)
      await api.createAccount(newAccountName, newAccountCurrency)
      await refreshAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function onCreateTransaction() {
    try {
      setError(null)
      if (!txAccountId) throw new Error('Select an account first')

      var raw = Number(txAmount)
      if (!Number.isFinite(raw) || raw <= 0) throw new Error('Enter a positive amount')
      var amountSigned = txType === 'expense' ? -Math.abs(raw) : Math.abs(raw)

      await api.createTransaction({
        accountId: txAccountId,
        amount: amountSigned,
        category: txCategory,
        note: txNote || undefined,
      })
      setTxNote('')
      await refreshAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function onDeleteTransaction(id: string) {
    try {
      setError(null)
      await api.deleteTransaction(id)
      await refreshAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function onAddToWatchlist() {
    try {
      setError(null)
      await api.addWatchlistItem(newSymbol)
      await refreshAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function onLoadQuote() {
    try {
      setError(null)
      const s = quoteSymbol.trim().toUpperCase()
      const q = await api.getQuote(s)
      setQuote(q)
      setSelectedStockSymbol(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function onDeleteWatchlistItem(id: string) {
    try {
      setError(null)
      await api.deleteWatchlistItem(id)
      await refreshAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const totalBalance = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (Number.isFinite(t.amount) ? t.amount : 0), 0)
  }, [transactions])

  const spendingByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of transactions) {
      if (t.amount >= 0) continue
      const category = (t.category || 'Uncategorized').trim() || 'Uncategorized'
      map.set(category, (map.get(category) ?? 0) + Math.abs(t.amount))
    }

    const data = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    const total = data.reduce((s, d) => s + d.value, 0)

    return { data, total }
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    if (!txFilterAccountId) return transactions
    return transactions.filter(t => t.accountId === txFilterAccountId)
  }, [transactions, txFilterAccountId])

  const currentStockSymbol = (selectedStockSymbol || quoteSymbol || 'AAPL').trim().toUpperCase()

  const stockSeries = useMemo(() => {
    const endPrice = quote?.symbol?.toUpperCase() === currentStockSymbol ? quote.price : undefined
    return generateMockStockSeries(currentStockSymbol, endPrice)
  }, [currentStockSymbol, quote?.price, quote?.symbol])

  async function onSelectStock(symbol: string) {
    const s = (symbol || '').trim().toUpperCase()
    if (!s) return
    setSelectedStockSymbol(s)
    setQuoteSymbol(s)
    try {
      setError(null)
      const q = await api.getQuote(s)
      setQuote(q)
      if (activeTab !== 'stocks') setActiveTab('stocks')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function TabTitle() {
    if (activeTab === 'dashboard') return 'Dashboard'
    if (activeTab === 'transactions') return 'Transactions'
    return 'Stocks'
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-950 text-gray-100">
      <div className="flex min-h-screen">
        <Sidebar activeTab={activeTab} onChange={setActiveTab} />

        <div className="flex-1">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-black/50 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{TabTitle()}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                  <span className={`inline-flex h-2 w-2 rounded-full ${health === 'ok' ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
                  <span>API: {health}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-gray-400 sm:block">
                  <span className="text-gray-500">Logged in as </span>
                  <span className="font-semibold text-gray-200">{username}</span>
                </span>
                <button
                  onClick={() => refreshAll().catch(e => setError(e instanceof Error ? e.message : String(e)))}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500"
                >
                  Refresh
                </button>
                <button
                  onClick={onLogout}
                  className="rounded-lg border border-white/10 bg-gray-800/60 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-white/5"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
            {error ? (
              <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                <span className="font-semibold">Error:</span> {error}
              </div>
            ) : null}

            {activeTab === 'dashboard' ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <Card title="Total balance">
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-xs text-gray-400">Across all accounts</div>
                        <div className={`mt-2 text-3xl font-semibold ${totalBalance < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                          {formatEur(totalBalance)}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">(computed from transactions)</div>
                    </div>
                  </Card>
                </div>
                <div className="lg:col-span-8">
                  <Card title="Spending chart">
                    <div className="h-72 rounded-lg border border-white/10 bg-gray-900/20 p-3">
                      {spendingByCategory.data.length === 0 ? (
                        <div className="grid h-full place-items-center text-sm text-gray-400">No data to display</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Tooltip
                              formatter={(value) => {
                                const v = typeof value === 'number' ? value : 0
                                const pct = spendingByCategory.total > 0 ? (v / spendingByCategory.total) * 100 : 0
                                return [`${v.toFixed(2)} (${pct.toFixed(0)}%)`, '']
                              }}
                              contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12 }}
                              itemStyle={{ color: '#E5E7EB' }}
                              labelStyle={{ color: '#9CA3AF' }}
                            />
                            <Legend
                              verticalAlign="middle"
                              align="right"
                              layout="vertical"
                              formatter={(value: string) => <span className="text-xs text-gray-300">{value}</span>}
                            />
                            <Pie
                              data={spendingByCategory.data}
                              dataKey="value"
                              nameKey="name"
                              cx="38%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={95}
                              paddingAngle={2}
                              stroke="rgba(255,255,255,0.08)"
                            >
                              {spendingByCategory.data.map((_, idx) => (
                                <Cell key={idx} fill={SPENDING_COLORS[idx % SPENDING_COLORS.length]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            ) : null}

            {activeTab === 'transactions' ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-4 space-y-6">
                  <Card
                    title="Accounts"
                    right={
                      <button
                        onClick={onCreateAccount}
                        className="h-9 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-500"
                      >
                        Add
                      </button>
                    }
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={newAccountName}
                        onChange={e => setNewAccountName(e.target.value)}
                        placeholder="Account name"
                        className="h-10 rounded-lg border border-white/10 bg-gray-900/60 px-3 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        value={newAccountCurrency}
                        onChange={e => setNewAccountCurrency(e.target.value)}
                        placeholder="Currency"
                        className="h-10 rounded-lg border border-white/10 bg-gray-900/60 px-3 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="mt-4 space-y-2">
                      {accounts.length === 0 ? (
                        <div className="text-sm text-gray-400">No accounts yet.</div>
                      ) : (
                        accounts.map(a => (
                          <div
                            key={a.id}
                            className={`flex items-center justify-between rounded-lg border border-white/10 bg-gray-900/30 px-3 py-2 ${
                              a.id === txAccountId ? 'ring-1 ring-indigo-500/40' : ''
                            }`}
                          >
                            <button type="button" onClick={() => setTxAccountId(a.id)} className="min-w-0 text-left">
                              <div className="truncate text-sm font-semibold text-gray-100">{a.name}</div>
                              <div className="text-xs text-gray-400">{a.currency}</div>
                            </button>
                            <div className="text-xs text-gray-400">{new Date(a.createdAtUtc).toLocaleDateString()}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>

                  <Card title="Filters">
                    <div className="text-xs font-semibold text-gray-400">Filter by account</div>
                    <select
                      value={txFilterAccountId}
                      onChange={e => setTxFilterAccountId(e.target.value)}
                      className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-gray-900/60 px-3 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">All</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </Card>
                </div>

                <div className="lg:col-span-8 space-y-6">
                  <Card
                    title="New transaction"
                    right={
                      <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTxType('income')}
                        className={`h-9 rounded-lg px-3 text-xs font-semibold ${
                          txType === 'income' ? 'bg-emerald-600 text-white' : 'bg-gray-900/40 text-gray-200 ring-1 ring-white/10 hover:bg-white/5'
                        }`}
                      >
                        Income
                      </button>
                      <button
                        type="button"
                        onClick={() => setTxType('expense')}
                        className={`h-9 rounded-lg px-3 text-xs font-semibold ${
                          txType === 'expense' ? 'bg-red-600 text-white' : 'bg-gray-900/40 text-gray-200 ring-1 ring-white/10 hover:bg-white/5'
                        }`}
                      >
                        Expense
                      </button>
                      </div>
                    }
                  >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                    <div className="md:col-span-3">
                      <div className="mb-1 text-xs font-semibold text-gray-400">Account</div>
                      <select
                        value={txAccountId}
                        onChange={e => setTxAccountId(e.target.value)}
                        className="h-10 w-full rounded-lg border border-white/10 bg-gray-900/60 px-3 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Select account</option>
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.currency})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <div className="mb-1 text-xs font-semibold text-gray-400">Amount</div>
                      <input
                        inputMode="decimal"
                        value={txAmount}
                        onChange={e => setTxAmount(e.target.value)}
                        placeholder="0.00"
                        className="h-10 w-full rounded-lg border border-white/10 bg-gray-900/60 px-3 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="mt-1 text-xs text-gray-500">Enter a positive number</div>
                    </div>

                    <div className="md:col-span-3">
                      <div className="mb-1 text-xs font-semibold text-gray-400">Category</div>
                      <input
                        value={txCategory}
                        onChange={e => setTxCategory(e.target.value)}
                        placeholder="Category"
                        className="h-10 w-full rounded-lg border border-white/10 bg-gray-900/60 px-3 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <div className="mb-1 text-xs font-semibold text-gray-400">Note</div>
                      <input
                        value={txNote}
                        onChange={e => setTxNote(e.target.value)}
                        placeholder="Optional"
                        className="h-10 w-full rounded-lg border border-white/10 bg-gray-900/60 px-3 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="md:col-span-1 md:flex md:items-end">
                      <button
                        onClick={onCreateTransaction}
                        className="h-10 w-full rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-500"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  </Card>

                  <Card title="Transactions">
                    <div className="overflow-hidden rounded-lg border border-white/10">
                      <table className="min-w-full divide-y divide-white/10">
                        <thead className="bg-gray-900/40">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Account</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Category</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Note</th>
                            <th className="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-gray-800/40">
                          {filteredTransactions.length === 0 ? (
                            <tr>
                              <td className="px-4 py-4 text-sm text-gray-400" colSpan={6}>
                                No transactions.
                              </td>
                            </tr>
                          ) : (
                            filteredTransactions.map(t => {
                              const acc = accountsById.get(t.accountId)
                              const amountClass = t.amount < 0 ? 'text-red-400' : 'text-emerald-400'
                              return (
                                <tr key={t.id} className="group hover:bg-white/5">
                                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-200">{formatDateDmy(t.date)}</td>
                                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-300">{acc?.name ?? t.accountId}</td>
                                  <td className={`whitespace-nowrap px-4 py-3 text-right text-sm font-semibold ${amountClass}`}>
                                    {formatEur(t.amount)}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-300">{t.category}</td>
                                  <td className="px-4 py-3 text-sm text-gray-400">{t.note ?? ''}</td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      onClick={() => onDeleteTransaction(t.id)}
                                      title="Delete transaction"
                                      className="rounded-md px-2 py-1 text-xs font-semibold text-gray-500 opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-400 group-hover:opacity-100"
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              </div>
            ) : null}

            {activeTab === 'stocks' ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-4 space-y-6">
                  <Card
                    title="Watchlist"
                    right={
                      <button
                        onClick={onAddToWatchlist}
                        className="h-9 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-500"
                      >
                        Add
                      </button>
                    }
                  >
                    <div className="mb-4 flex gap-2">
                      <input
                        value={newSymbol}
                        onChange={e => setNewSymbol(e.target.value)}
                        placeholder="Symbol (e.g. AAPL)"
                        className="h-9 flex-1 rounded-lg border border-white/10 bg-gray-900/60 px-3 text-xs text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {watchlist.length === 0 ? (
                      <div className="text-sm text-gray-400">No watchlist items yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {watchlist.map(w => (
                          <div
                            key={w.id}
                            className={`group flex w-full items-center justify-between rounded-lg border border-white/10 bg-gray-900/30 px-3 py-2 hover:bg-white/5 ${
                              w.symbol === currentStockSymbol ? 'ring-1 ring-indigo-500/40' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => onSelectStock(w.symbol)}
                              className="flex flex-1 flex-col text-left"
                            >
                              <div className="text-sm font-semibold text-gray-100">{w.symbol}</div>
                              <div className="text-xs text-gray-400">{formatDateDmy(w.addedAtUtc)}</div>
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteWatchlistItem(w.id)}
                              title="Remove from watchlist"
                              className="ml-2 rounded px-1.5 py-0.5 text-xs font-semibold text-gray-600 opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-400 group-hover:opacity-100"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card title="Quote lookup (mock)">
                    <div className="flex gap-2">
                      <input
                        value={quoteSymbol}
                        onChange={e => setQuoteSymbol(e.target.value)}
                        placeholder="Symbol"
                        className="h-10 flex-1 rounded-lg border border-white/10 bg-gray-900/60 px-3 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={onLoadQuote}
                        className="h-10 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-500"
                      >
                        Load
                      </button>
                    </div>
                    {quote ? (
                      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                        <div className="col-span-2 flex items-center justify-between">
                          <span className="font-semibold text-gray-100">{quote.symbol}</span>
                          <span className="text-xs text-gray-400">{new Date(quote.asOfUtc).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-gray-400">Price</div>
                        <div className="text-right font-semibold text-gray-100">{quote.price.toFixed(2)}</div>
                        <div className="text-gray-400">Change</div>
                        <div className={`text-right font-semibold ${quote.changePercent < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {quote.changePercent.toFixed(2)}%
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-gray-400">Load a quote to see details.</div>
                    )}
                  </Card>
                </div>

                <div className="lg:col-span-8 space-y-6">
                  <Card title={`Stock chart: ${currentStockSymbol}`}>
                    <div className="h-[28rem] rounded-lg border border-white/10 bg-gray-900/20 p-3">
                      {stockSeries.length === 0 ? (
                        <div className="grid h-full place-items-center text-sm text-gray-400">No data to display</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={stockSeries} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                            <defs>
                              <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.55} />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <XAxis
                              dataKey="day"
                              tick={{ fill: '#9CA3AF', fontSize: 12 }}
                              axisLine={{ stroke: 'rgba(255,255,255,0.10)' }}
                              tickLine={{ stroke: 'rgba(255,255,255,0.10)' }}
                            />
                            <YAxis
                              tick={{ fill: '#9CA3AF', fontSize: 12 }}
                              axisLine={{ stroke: 'rgba(255,255,255,0.10)' }}
                              tickLine={{ stroke: 'rgba(255,255,255,0.10)' }}
                              width={50}
                              domain={['dataMin - 2', 'dataMax + 2']}
                            />
                            <Tooltip
                              formatter={(value) => {
                                const v = typeof value === 'number' ? value : 0
                                return [`${v.toFixed(2)}`, 'Price']
                              }}
                              contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12 }}
                              itemStyle={{ color: '#E5E7EB' }}
                              labelStyle={{ color: '#9CA3AF' }}
                            />
                            <Area
                              type="monotone"
                              dataKey="price"
                              stroke="#6366f1"
                              strokeWidth={2}
                              fill="url(#priceFill)"
                              dot={false}
                              activeDot={{ r: 5, stroke: '#111827', strokeWidth: 2 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  )
}

const SPENDING_COLORS = ['#3b82f6', '#14b8a6', '#f59e0b', '#a855f7', '#22c55e', '#ef4444']

function generateMockStockSeries(symbol: string, endPrice?: number) {
  const clean = (symbol || 'STOCK').trim().toUpperCase()
  if (!clean) return [] as Array<{ day: string; price: number }>

  const hash = Array.from(clean).reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7)
  const base = endPrice && Number.isFinite(endPrice) ? endPrice : 60 + (Math.abs(hash) % 9000) / 100

  let price = Math.max(1, base * 0.92)
  const pts: Array<{ day: string; price: number }> = []

  // deterministic pseudo-random trend with small volatility
  for (let i = 0; i < 30; i++) {
    const t = i + 1
    const drift = Math.sin((hash % 97) + t / 5) * 0.35
    const noise = Math.sin((hash % 193) + t * 1.7) * 0.55
    const step = drift + noise
    price = Math.max(1, price + step)
    pts.push({ day: `D-${29 - i}`, price: Math.round(price * 100) / 100 })
  }

  // force the last point to be the latest price if present
  if (endPrice && Number.isFinite(endPrice)) {
    pts[pts.length - 1] = { ...pts[pts.length - 1], price: Math.round(endPrice * 100) / 100 }
  }

  return pts
}

const eurFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatEur(amount: number) {
  if (!Number.isFinite(amount)) return '0,00 €'
  return eurFormatter.format(amount)
}

function formatDateDmy(input: string) {
  // Supports both DateOnly strings like "YYYY-MM-DD" and ISO timestamps.
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(input)
  if (m) {
    const [y, mo, d] = input.split('-')
    return `${d}.${mo}.${y}`
  }

  const dt = new Date(input)
  if (Number.isNaN(dt.getTime())) return input

  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const yyyy = dt.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

export default App
