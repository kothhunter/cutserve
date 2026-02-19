import { useState } from 'react'
import logoSvg from '/logo/CUT.svg'

interface LoginScreenProps {
  onAuthenticated: () => void
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [mode, setMode]       = useState<'login' | 'register'>('login')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          setLoading(false)
          return
        }
        const result = await window.api.auth.register(email, password)
        if (!result.success) {
          setError(result.error ?? 'Registration failed')
        } else {
          // Show confirmation message — Supabase may require email verification
          setRegistered(true)
        }
      } else {
        const result = await window.api.auth.login(email, password)
        if (!result.success) {
          setError(result.error ?? 'Login failed')
        } else {
          onAuthenticated()
        }
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-4 py-2.5 bg-white border border-cut-warm/50 rounded-xl text-cut-deep text-sm outline-none focus:border-cut-mid/50 focus:ring-1 focus:ring-cut-warm/40 transition-all placeholder:text-cut-muted'

  if (registered) {
    return (
      <div className="h-screen flex items-center justify-center bg-cut-base">
        <div className="w-full max-w-sm mx-auto px-6 text-center space-y-4">
          <img src={logoSvg} alt="CutServe" className="h-12 w-auto mx-auto" />
          <h1 className="text-2xl font-bold text-cut-deep">Check your email</h1>
          <p className="text-sm text-cut-mid leading-relaxed">
            We sent a confirmation link to <span className="font-semibold text-cut-deep">{email}</span>.
            Click it to activate your account, then come back to log in.
          </p>
          <button
            onClick={() => { setRegistered(false); setMode('login') }}
            className="h-10 px-6 text-sm font-semibold bg-cut-deep text-cut-base hover:bg-cut-deep/90 rounded-xl transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex items-center justify-center bg-cut-base">
      <div className="w-full max-w-sm mx-auto px-6">

        {/* Logo + title */}
        <div className="text-center mb-8">
          <img src={logoSvg} alt="CutServe" className="h-12 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-cut-deep">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-sm text-cut-mid mt-1">
            {mode === 'login' ? 'Sign in to CutServe' : 'Start creating highlight reels'}
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-cut-warm/40 p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-cut-mid uppercase tracking-wide mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-cut-mid uppercase tracking-wide mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
                required
                minLength={mode === 'register' ? 8 : undefined}
                className={inputCls}
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-cut-mid uppercase tracking-wide mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  minLength={8}
                  className={inputCls}
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 text-sm font-semibold bg-cut-deep text-cut-base hover:bg-cut-deep/90 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
        </div>

        {/* Toggle mode */}
        <p className="text-center text-sm text-cut-mid mt-5">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); setConfirmPassword('') }}
            className="text-cut-deep font-semibold hover:underline"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
