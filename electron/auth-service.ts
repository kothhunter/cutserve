import { createClient, SupabaseClient, Session } from '@supabase/supabase-js'
import keytar from 'keytar'

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const KEYTAR_SERVICE = 'com.cutserve.app'
const KEYTAR_ACCOUNT = 'supabase-session'

const FREE_EXPORT_LIMIT = 3

export interface UserProfile {
  id: string
  email: string
  plan: 'free' | 'pro' | 'lifetime'
  exports_this_month: number
  exports_reset_at: string
}

export class AuthService {
  private supabase: SupabaseClient
  private currentSession: Session | null = null

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false, // We manage persistence via OS keychain (keytar)
        autoRefreshToken: true,
      },
    })
  }

  // ── Session Management ─────────────────────────────────────────────

  async restoreSession(): Promise<boolean> {
    try {
      const stored = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
      if (!stored) return false

      const { access_token, refresh_token } = JSON.parse(stored)
      const { data, error } = await this.supabase.auth.setSession({ access_token, refresh_token })

      if (error || !data.session) {
        await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
        return false
      }

      this.currentSession = data.session
      // Persist the refreshed tokens
      await this.saveSession(data.session)
      console.log('[Auth] Session restored for:', data.session.user.email)
      return true
    } catch (err) {
      console.error('[Auth] Failed to restore session:', err)
      return false
    }
  }

  private async saveSession(session: Session): Promise<void> {
    const data = JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, data)
  }

  // ── Auth Operations ────────────────────────────────────────────────

  async register(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await this.supabase.auth.signUp({ email, password })
    if (error) return { success: false, error: error.message }

    if (data.session) {
      this.currentSession = data.session
      await this.saveSession(data.session)
    }

    // If Supabase email confirmation is enabled, session will be null until confirmed
    return { success: true }
  }

  async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password })
    if (error) return { success: false, error: error.message }

    this.currentSession = data.session
    await this.saveSession(data.session)
    console.log('[Auth] Logged in:', data.user.email)
    return { success: true }
  }

  async logout(): Promise<void> {
    await this.supabase.auth.signOut()
    this.currentSession = null
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
    console.log('[Auth] Logged out')
  }

  isLoggedIn(): boolean {
    return this.currentSession !== null
  }

  // ── Profile & Freemium ────────────────────────────────────────────

  async getProfile(): Promise<UserProfile | null> {
    if (!this.currentSession) return null

    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', this.currentSession.user.id)
      .single()

    if (error || !data) {
      console.error('[Auth] Failed to fetch profile:', error?.message)
      return null
    }

    return data as UserProfile
  }

  async canExport(): Promise<{ allowed: boolean; used: number; limit: number }> {
    const profile = await this.getProfile()
    if (!profile) return { allowed: false, used: 0, limit: FREE_EXPORT_LIMIT }

    // Paid plans have unlimited exports
    if (profile.plan === 'pro' || profile.plan === 'lifetime') {
      return { allowed: true, used: profile.exports_this_month, limit: -1 }
    }

    // Check if the monthly counter needs to be reset
    const resetAt = new Date(profile.exports_reset_at)
    if (new Date() >= resetAt) {
      const newResetAt = new Date()
      newResetAt.setMonth(newResetAt.getMonth() + 1)
      await this.supabase
        .from('profiles')
        .update({ exports_this_month: 0, exports_reset_at: newResetAt.toISOString() })
        .eq('id', profile.id)
      return { allowed: true, used: 0, limit: FREE_EXPORT_LIMIT }
    }

    const allowed = profile.exports_this_month < FREE_EXPORT_LIMIT
    return { allowed, used: profile.exports_this_month, limit: FREE_EXPORT_LIMIT }
  }

  async recordExport(): Promise<void> {
    if (!this.currentSession) return

    try {
      // Uses the increment_export_count SQL function (SECURITY DEFINER)
      const { error } = await this.supabase.rpc('increment_export_count', {
        user_id: this.currentSession.user.id,
      })
      if (error) throw error
    } catch {
      // Fallback: manual increment if the RPC function isn't available
      const profile = await this.getProfile()
      if (profile) {
        await this.supabase
          .from('profiles')
          .update({ exports_this_month: profile.exports_this_month + 1 })
          .eq('id', this.currentSession.user.id)
      }
    }
  }
}

export const authService = new AuthService()
