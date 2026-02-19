import { createClient, SupabaseClient, Session } from '@supabase/supabase-js'
import keytar from 'keytar'
import { createHash, randomUUID } from 'crypto'
import { execSync } from 'child_process'
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const KEYTAR_SERVICE = 'com.cutserve.app'
const KEYTAR_ACCOUNT = 'supabase-session'

const FREE_EXPORT_LIMIT = 3
const MAX_DEVICES_PER_ACCOUNT = 3
const DEVICE_ACTIVE_DAYS = 30

export interface UserProfile {
  id: string
  email: string
  plan: 'free' | 'pro' | 'lifetime'
  exports_this_month: number
  exports_reset_at: string
}

export class AuthService {
  private supabase: SupabaseClient | null = null
  private currentSession: Session | null = null
  private cachedDeviceId: string | null = null

  constructor() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false, // We manage persistence via OS keychain (keytar)
          autoRefreshToken: true,
        },
      })
    } else {
      console.log('[Auth] Supabase credentials not configured — auth disabled')
    }
  }

  // ── Session Management ─────────────────────────────────────────────

  async restoreSession(): Promise<boolean> {
    if (!this.supabase) return false
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
    if (!this.supabase) return { success: false, error: 'Auth not configured' }
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
    if (!this.supabase) return { success: false, error: 'Auth not configured' }
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password })
    if (error) return { success: false, error: error.message }

    this.currentSession = data.session
    await this.saveSession(data.session)
    console.log('[Auth] Logged in:', data.user.email)
    return { success: true }
  }

  async logout(): Promise<void> {
    if (this.supabase) await this.supabase.auth.signOut()
    this.currentSession = null
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
    console.log('[Auth] Logged out')
  }

  isLoggedIn(): boolean {
    return this.currentSession !== null
  }

  // ── Device Fingerprinting ─────────────────────────────────────────

  async getDeviceId(): Promise<string> {
    if (this.cachedDeviceId) return this.cachedDeviceId

    let rawId: string | null = null

    try {
      if (process.platform === 'darwin') {
        const output = execSync('ioreg -rd1 -c IOPlatformExpertDevice', { encoding: 'utf-8' })
        const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/)
        if (match) rawId = match[1]
      } else if (process.platform === 'win32') {
        const output = execSync('reg query HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid', { encoding: 'utf-8' })
        const match = output.match(/MachineGuid\s+REG_SZ\s+(\S+)/)
        if (match) rawId = match[1]
      }
    } catch (err) {
      console.warn('[Auth] Failed to read hardware ID:', err)
    }

    // Fallback: persist a generated UUID to userData
    if (!rawId) {
      const fallbackPath = join(app.getPath('userData'), 'device-id')
      if (existsSync(fallbackPath)) {
        rawId = readFileSync(fallbackPath, 'utf-8').trim()
      } else {
        rawId = randomUUID()
        writeFileSync(fallbackPath, rawId, 'utf-8')
      }
    }

    this.cachedDeviceId = createHash('sha256').update(rawId).digest('hex')
    return this.cachedDeviceId
  }

  // ── Profile & Freemium ────────────────────────────────────────────

  async getProfile(): Promise<UserProfile | null> {
    if (!this.supabase || !this.currentSession) return null

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

  async canExport(): Promise<{ allowed: boolean; used: number; limit: number; reason?: string }> {
    if (!this.supabase) return { allowed: true, used: 0, limit: -1 }
    const profile = await this.getProfile()
    if (!profile) return { allowed: false, used: 0, limit: FREE_EXPORT_LIMIT }

    const deviceId = await this.getDeviceId()

    // Paid plans: unlimited exports but limited to 3 devices
    if (profile.plan === 'pro' || profile.plan === 'lifetime') {
      const cutoff = new Date(Date.now() - DEVICE_ACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { data: devices } = await this.supabase
        .from('user_devices')
        .select('device_id')
        .eq('user_id', profile.id)
        .gte('last_seen_at', cutoff)

      const activeDevices = devices ?? []
      const thisDeviceRegistered = activeDevices.some(d => d.device_id === deviceId)

      if (!thisDeviceRegistered && activeDevices.length >= MAX_DEVICES_PER_ACCOUNT) {
        return {
          allowed: false,
          used: activeDevices.length,
          limit: MAX_DEVICES_PER_ACCOUNT,
          reason: 'device_limit',
        }
      }

      return { allowed: true, used: profile.exports_this_month, limit: -1 }
    }

    // Free plans: check device-level export limit
    const { data } = await this.supabase
      .from('device_exports')
      .select('exports_this_month, reset_at')
      .eq('device_id', deviceId)
      .single()

    let deviceUsed = 0
    if (data) {
      const resetAt = new Date(data.reset_at)
      if (new Date() >= resetAt) {
        await this.supabase
          .from('device_exports')
          .update({ exports_this_month: 0, reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
          .eq('device_id', deviceId)
        deviceUsed = 0
      } else {
        deviceUsed = data.exports_this_month
      }
    }

    const allowed = deviceUsed < FREE_EXPORT_LIMIT
    return { allowed, used: deviceUsed, limit: FREE_EXPORT_LIMIT }
  }

  async recordExport(): Promise<void> {
    if (!this.supabase || !this.currentSession) return

    // Increment per-user counter (for analytics)
    try {
      const { error } = await this.supabase.rpc('increment_export_count', {
        user_id: this.currentSession.user.id,
      })
      if (error) throw error
    } catch {
      const profile = await this.getProfile()
      if (profile) {
        await this.supabase
          .from('profiles')
          .update({ exports_this_month: profile.exports_this_month + 1 })
          .eq('id', this.currentSession.user.id)
      }
    }

    // Increment per-device counter (for enforcement)
    try {
      const deviceId = await this.getDeviceId()
      const { error } = await this.supabase.rpc('increment_device_export', {
        p_device_id: deviceId,
      })
      if (error) throw error
    } catch (err) {
      console.error('[Auth] Failed to record device export:', err)
    }

    // Track device for this account (for paid account sharing limits)
    try {
      const deviceId = await this.getDeviceId()
      await this.supabase
        .from('user_devices')
        .upsert(
          { user_id: this.currentSession.user.id, device_id: deviceId, last_seen_at: new Date().toISOString() },
          { onConflict: 'user_id,device_id' }
        )
    } catch (err) {
      console.error('[Auth] Failed to track user device:', err)
    }
  }
}

export const authService = new AuthService()
