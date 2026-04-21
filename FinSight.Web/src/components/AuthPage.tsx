import { useState } from 'react'
import { api, auth } from '../api'

type Mode = 'login' | 'register'

interface Props {
  onAuthenticated: (username: string) => void
}

export default function AuthPage({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!username.trim() || !password) {
      setError('Username and password are required.')
      return
    }

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        return
      }
    }

    setLoading(true)
    try {
      if (mode === 'register') {
        await api.register(username.trim(), password)
        setSuccess('Account created! You can now log in.')
        setMode('login')
        setPassword('')
        setConfirmPassword('')
      } else {
        const res = await api.login(username.trim(), password)
        auth.saveSession(res.token, res.username)
        onAuthenticated(res.username)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-black to-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-2 text-3xl font-bold tracking-tight text-white">
            Fin<span className="text-indigo-400">Sight</span>
          </div>
          <div className="text-sm text-gray-400">Personal Finance & Stock Analysis</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-8 shadow-2xl backdrop-blur">
          <div className="mb-6 flex rounded-lg bg-gray-800/60 p-1">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setSuccess(null) }}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                mode === 'login' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); setSuccess(null) }}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                mode === 'register' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-400">Username</label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. bruno"
                className="h-11 w-full rounded-lg border border-white/10 bg-gray-800/60 px-3 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-400">Password</label>
              <input
                type="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-lg border border-white/10 bg-gray-800/60 px-3 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-400">Confirm Password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-lg border border-white/10 bg-gray-800/60 px-3 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-indigo-600 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-60"
            >
              {loading ? (mode === 'login' ? 'Logging in…' : 'Creating account…') : (mode === 'login' ? 'Log In' : 'Create Account')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
