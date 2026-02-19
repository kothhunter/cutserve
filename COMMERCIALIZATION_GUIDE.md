# Roundnet Condenser - Commercialization Guide

## Table of Contents

1. [Current State → Commercial Product Roadmap](#roadmap)
2. [Distribution Strategy](#distribution-strategy)
3. [Authentication Architecture](#authentication-architecture)
4. [Payment & Licensing Models](#payment--licensing-models)
5. [Website & Infrastructure](#website--infrastructure)
6. [Auto-Update System](#auto-update-system)
7. [Code Signing & Security](#code-signing--security)
8. [Implementation Checklist](#implementation-checklist)
9. [Cost Breakdown](#cost-breakdown)
10. [Recommended Tech Stack](#recommended-tech-stack)

---

## Roadmap

### Phase 1: Build & Package (Current → Downloadable App)
**Goal:** Create installers for macOS/Windows/Linux

**What you have now:**
- Working Electron app (development mode)
- `npm run build` creates production build
- Electron Builder configured in package.json

**What you need:**
1. **Code signing certificates** (macOS + Windows)
2. **Notarization** (macOS requirement)
3. **Build automation** (GitHub Actions or similar)
4. **Version management** (semantic versioning)

**Output:**
- `.dmg` installer (macOS)
- `.exe` installer (Windows)
- `.AppImage` or `.deb` (Linux)

---

### Phase 2: Authentication & Licensing
**Goal:** Users must login and have valid license to use app

**Architecture options:**

#### Option A: Cloud-Based Auth (Recommended)
```
User opens app
    ↓
Login screen (email + password)
    ↓
POST to your auth server (e.g., api.roundnetcondenser.com/auth/login)
    ↓
Server returns JWT token + license status
    ↓
App stores token locally (encrypted)
    ↓
On each launch: verify token is valid & license is active
    ↓
Periodic checks (every 24 hours) to validate subscription
```

#### Option B: License Keys (Simpler, less secure)
```
User purchases → receives license key
    ↓
User enters key in app
    ↓
App validates key against server
    ↓
Key stored locally (encrypted)
    ↓
Periodic validation to prevent key sharing
```

---

### Phase 3: Payment Integration
**Goal:** Collect payment before providing download/license

**Flow:**
1. User visits website → clicks "Buy Now"
2. Stripe/Paddle checkout page
3. Payment successful → license created in database
4. User receives email with:
   - Download link
   - License key (if using Option B)
   - Account credentials (if using Option A)

---

### Phase 4: Website & Infrastructure
**Goal:** Public-facing website for marketing, sales, downloads

**Required pages:**
1. **Homepage** - Product demo, features, pricing
2. **Pricing page** - Plans and purchase buttons
3. **Download page** - Platform-specific installers (gated by auth)
4. **Account dashboard** - Manage subscription, download links
5. **Documentation** - User guides, FAQs

---

## Distribution Strategy

### Option 1: Direct Distribution (Recommended for you)
**How it works:**
- Host installers on your own server or CDN
- Users download from your website
- Full control over versioning and updates

**Pros:**
✅ Keep 100% of revenue (minus payment processor fees)
✅ Full control over user experience
✅ Can implement custom licensing
✅ Faster iteration (no app store review)

**Cons:**
❌ Need to handle code signing yourself
❌ Users may be wary of downloading from unknown source
❌ No built-in discovery/marketing from app stores

**Best for:** B2B tools, professional software, niche products

---

### Option 2: Mac App Store / Microsoft Store
**How it works:**
- Submit app to Apple/Microsoft for review
- They host and distribute
- Users download from official stores

**Pros:**
✅ Built-in trust (Apple/Microsoft verified)
✅ Easier discovery
✅ Automatic updates handled by store
✅ No need for separate payment processing

**Cons:**
❌ 15-30% commission on all sales
❌ Review process (1-2 weeks per update)
❌ Limited licensing flexibility
❌ Must follow strict guidelines

**Best for:** Consumer apps, mass-market products

---

### Option 3: Hybrid Approach
- Sell on website (direct) for professionals (lower price)
- Also list on app stores for casual users (higher price to offset commission)

---

## Authentication Architecture

### Recommended: Cloud-Based with JWT Tokens

#### Backend Requirements

**Tech Stack:**
- **Backend:** Node.js + Express (or Next.js API routes)
- **Database:** PostgreSQL or MongoDB
- **Auth Library:** Passport.js or NextAuth.js
- **Hosting:** Vercel, Railway, or AWS

**Database Schema:**

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  status VARCHAR(50) NOT NULL, -- active, cancelled, expired
  plan VARCHAR(50) NOT NULL,   -- monthly, yearly, lifetime
  stripe_subscription_id VARCHAR(255),
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- License keys table (if using key-based approach)
CREATE TABLE license_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  activated_at TIMESTAMP,
  last_verified TIMESTAMP,
  max_activations INTEGER DEFAULT 1,
  current_activations INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sessions table (for device management)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  device_id VARCHAR(255) NOT NULL,
  device_name VARCHAR(255),
  last_active TIMESTAMP,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**API Endpoints:**

```typescript
// Auth endpoints
POST   /api/auth/register      // Create account
POST   /api/auth/login         // Login (returns JWT)
POST   /api/auth/logout        // Invalidate token
POST   /api/auth/refresh       // Refresh JWT
GET    /api/auth/me            // Get current user info

// License validation
GET    /api/license/validate   // Check if user has active license
POST   /api/license/activate   // Activate license key (if using keys)
GET    /api/license/status     // Get subscription details

// Downloads
GET    /api/downloads/latest   // Get latest version info
GET    /api/downloads/:platform // Download installer (requires auth)
```

---

#### Frontend (Electron App) Implementation

**File structure:**
```
electron/
├── auth/
│   ├── auth-manager.ts       // Handle login/logout/token storage
│   ├── license-checker.ts    // Periodic license validation
│   └── auth-window.ts        // Login window management
└── main.ts

src/
├── components/
│   ├── LoginScreen.tsx       // Login UI
│   └── LicenseExpired.tsx    // Expired license UI
└── App.tsx
```

**Implementation example:**

```typescript
// electron/auth/auth-manager.ts
import { app } from 'electron'
import keytar from 'keytar'  // Secure credential storage
import axios from 'axios'

const API_URL = 'https://api.roundnetcondenser.com'
const SERVICE_NAME = 'roundnet-condenser'

export class AuthManager {
  private token: string | null = null

  async login(email: string, password: string): Promise<boolean> {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password
      })

      const { token, user } = response.data

      // Store token securely in system keychain
      await keytar.setPassword(SERVICE_NAME, email, token)

      this.token = token
      return true

    } catch (error) {
      console.error('Login failed:', error)
      return false
    }
  }

  async logout() {
    if (this.token) {
      // Clear from keychain
      const accounts = await keytar.findCredentials(SERVICE_NAME)
      for (const account of accounts) {
        await keytar.deletePassword(SERVICE_NAME, account.account)
      }

      this.token = null
    }
  }

  async getStoredToken(): Promise<string | null> {
    const credentials = await keytar.findCredentials(SERVICE_NAME)

    if (credentials.length > 0) {
      return credentials[0].password
    }

    return null
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      return response.status === 200

    } catch (error) {
      return false
    }
  }

  async checkLicense(): Promise<{ valid: boolean, status: string, expiresAt?: string }> {
    if (!this.token) {
      return { valid: false, status: 'no_token' }
    }

    try {
      const response = await axios.get(`${API_URL}/api/license/validate`, {
        headers: { Authorization: `Bearer ${this.token}` }
      })

      return {
        valid: response.data.valid,
        status: response.data.status,
        expiresAt: response.data.expiresAt
      }

    } catch (error) {
      return { valid: false, status: 'error' }
    }
  }
}
```

**App startup flow:**

```typescript
// electron/main.ts
import { AuthManager } from './auth/auth-manager'

let mainWindow: BrowserWindow | null = null
let authWindow: BrowserWindow | null = null
const authManager = new AuthManager()

app.on('ready', async () => {
  // Try to get stored token
  const token = await authManager.getStoredToken()

  if (token) {
    // Validate token
    const isValid = await authManager.validateToken(token)

    if (isValid) {
      // Check license status
      const license = await authManager.checkLicense()

      if (license.valid) {
        // All good - launch main app
        createMainWindow()
        return
      }
    }
  }

  // No valid token/license - show login
  createAuthWindow()
})

function createAuthWindow() {
  authWindow = new BrowserWindow({
    width: 400,
    height: 600,
    webPreferences: {
      preload: preloadPath
    }
  })

  authWindow.loadURL('http://localhost:5173/login')  // Or login.html in production
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: preloadPath
    }
  })

  mainWindow.loadFile('dist/index.html')

  // Start periodic license checking (every 24 hours)
  startLicenseChecking()
}

function startLicenseChecking() {
  setInterval(async () => {
    const license = await authManager.checkLicense()

    if (!license.valid) {
      // License expired - lock the app
      mainWindow?.webContents.send('license-expired', license)
    }
  }, 24 * 60 * 60 * 1000)  // 24 hours
}

// IPC handlers
ipcMain.handle('auth:login', async (event, email, password) => {
  const success = await authManager.login(email, password)

  if (success) {
    const license = await authManager.checkLicense()

    if (license.valid) {
      authWindow?.close()
      createMainWindow()
      return { success: true }
    } else {
      return { success: false, error: 'No active license' }
    }
  }

  return { success: false, error: 'Invalid credentials' }
})
```

**React login component:**

```typescript
// src/components/LoginScreen.tsx
import { useState } from 'react'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await window.api.auth.login(email, password)

    if (!result.success) {
      setError(result.error || 'Login failed')
      setLoading(false)
      return
    }

    // Success - main window will open automatically
  }

  return (
    <div className="login-screen">
      <div className="logo">
        <img src="/logo.png" alt="Roundnet Condenser" />
        <h1>Roundnet Condenser</h1>
      </div>

      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <div className="error">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <div className="links">
        <a href="https://roundnetcondenser.com/signup">Create account</a>
        <a href="https://roundnetcondenser.com/forgot-password">Forgot password?</a>
      </div>
    </div>
  )
}
```

---

## Payment & Licensing Models

### Recommended Models for Video Editing Software

#### Model 1: Subscription (Recommended)
**Monthly:** $19/month
**Yearly:** $149/year (save ~35%)

**Pros:**
✅ Predictable recurring revenue
✅ Lower barrier to entry
✅ Easier to justify auto-updates
✅ Can offer free trial

**Implementation:**
- Use **Stripe Subscriptions** or **Paddle**
- Webhook on subscription change → update database
- App checks subscription status on launch + every 24 hours

---

#### Model 2: Lifetime License
**One-time:** $299 (or $399)

**Pros:**
✅ Higher upfront revenue
✅ Appeals to users who hate subscriptions
✅ Simpler to implement

**Cons:**
❌ No recurring revenue
❌ Support costs forever
❌ Hard to justify charging for major updates

**Implementation:**
- Generate unique license key on purchase
- Store key → user mapping in database
- Optional: limit to X activations per key

---

#### Model 3: Hybrid (Best of both worlds)
**Subscription:** $19/month or $149/year
**Lifetime:** $499 one-time

**Tiered features (optional):**
- **Free tier:** Process up to 3 videos/month, watermarked
- **Pro ($19/mo):** Unlimited videos, no watermark, overlays
- **Team ($49/mo):** Multi-user, cloud storage, priority support

---

### Payment Processors Comparison

| Feature | Stripe | Paddle | Lemon Squeezy |
|---------|--------|--------|---------------|
| **Fee** | 2.9% + $0.30 | 5% + $0.50 | 5% + $0.50 |
| **VAT handling** | Manual | Automatic | Automatic |
| **Merchant of Record** | You | Paddle | Lemon Squeezy |
| **Ease of use** | Medium | Easy | Very Easy |
| **Best for** | Control freaks | EU sales | Solo devs |

**Recommendation:** Start with **Lemon Squeezy** or **Paddle** (they handle VAT/tax, act as merchant of record). Switch to Stripe later if you need more control.

---

## Website & Infrastructure

### Website Architecture

```
Landing Page (Next.js or Webflow)
    ↓
    ├─ Homepage (marketing)
    ├─ Pricing
    ├─ Features
    ├─ Documentation
    └─ Blog (optional)

Checkout (Stripe/Paddle hosted)
    ↓
Payment successful
    ↓
Webhook → Backend API
    ↓
Create user + subscription in database
    ↓
Send welcome email (Resend or SendGrid)
    ↓
User Dashboard (Next.js protected route)
    ├─ Download links
    ├─ License key (if applicable)
    ├─ Manage subscription
    └─ Account settings
```

---

### Tech Stack Options

#### Option 1: Next.js (Full-stack, Recommended)
```
Frontend: Next.js 14 (App Router)
Backend: Next.js API routes
Database: Supabase (PostgreSQL + Auth)
Payments: Lemon Squeezy or Stripe
Email: Resend
Hosting: Vercel
CDN for downloads: Cloudflare R2 or AWS S3
```

**Pros:**
✅ All-in-one (frontend + backend)
✅ Great developer experience
✅ Free hosting on Vercel
✅ Easy deployment

**Example file structure:**
```
app/
├── (marketing)/
│   ├── page.tsx              // Homepage
│   ├── pricing/page.tsx      // Pricing
│   └── docs/page.tsx         // Documentation
├── dashboard/
│   ├── page.tsx              // User dashboard (protected)
│   └── downloads/page.tsx    // Download page
└── api/
    ├── auth/
    │   ├── login/route.ts
    │   └── register/route.ts
    ├── license/
    │   └── validate/route.ts
    └── webhooks/
        └── stripe/route.ts   // Handle payment webhooks
```

---

#### Option 2: Separate Frontend/Backend
```
Frontend: React + Vite (hosted on Vercel/Netlify)
Backend: Node.js + Express (Railway or Render)
Database: PostgreSQL (Railway or Supabase)
Payments: Lemon Squeezy
Hosting: Vercel (frontend), Railway (backend)
```

**Pros:**
✅ More flexibility
✅ Can scale backend independently

**Cons:**
❌ More complex deployment
❌ Need to manage CORS

---

#### Option 3: No-Code Landing Page
```
Landing page: Webflow or Framer
Checkout: Lemon Squeezy (hosted)
Backend: Supabase (database + auth)
Minimal custom code: Just webhook handler
```

**Pros:**
✅ Fastest to launch
✅ Beautiful designs out of the box
✅ No need to write HTML/CSS

**Cons:**
❌ Less flexible
❌ Monthly cost for Webflow/Framer

---

### Infrastructure Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User's Computer                       │
│  ┌────────────────────────────────────────────────────┐ │
│  │         Roundnet Condenser App                     │ │
│  │  (Electron - Downloaded from website)              │ │
│  └────────────────────┬───────────────────────────────┘ │
└───────────────────────┼─────────────────────────────────┘
                        │
                        │ HTTPS
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Your Backend (Next.js on Vercel)            │
│  ┌────────────────────────────────────────────────────┐ │
│  │  API Routes                                        │ │
│  │  - POST /api/auth/login                            │ │
│  │  - GET  /api/license/validate                      │ │
│  │  - POST /api/webhooks/payment                      │ │
│  └───────────────────┬────────────────────────────────┘ │
│                      │                                   │
│                      ▼                                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Supabase (Database)                               │ │
│  │  - users                                           │ │
│  │  - subscriptions                                   │ │
│  │  - license_keys                                    │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                        ▲
                        │
                        │ Webhooks
                        │
┌─────────────────────────────────────────────────────────┐
│              Lemon Squeezy / Stripe                      │
│  (Payment processing + subscription management)          │
│                                                          │
│  User purchases → Sends webhook → Creates subscription  │
└─────────────────────────────────────────────────────────┘
                        ▲
                        │
                        │ User visits
                        │
┌─────────────────────────────────────────────────────────┐
│         Website (roundnetcondenser.com)                  │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Next.js Pages                                     │ │
│  │  - Homepage                                        │ │
│  │  - Pricing (→ Stripe/Lemon Squeezy checkout)      │ │
│  │  - Dashboard (protected, shows downloads)          │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Auto-Update System

### Why Auto-Updates Matter
- Fix bugs without requiring users to re-download
- Ship new features seamlessly
- Critical security patches

### Implementation with electron-updater

**Install:**
```bash
npm install electron-updater
```

**Update main.ts:**
```typescript
// electron/main.ts
import { autoUpdater } from 'electron-updater'

app.on('ready', () => {
  createWindow()

  // Check for updates on startup
  autoUpdater.checkForUpdatesAndNotify()

  // Check every hour
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify()
  }, 60 * 60 * 1000)
})

// Update events
autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('update-available', info)
})

autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.webContents.send('update-downloaded', info)
})

// IPC handler to install update
ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall()
})
```

**Where to host updates:**

Option 1: **GitHub Releases** (Free, simple)
- Push new version → Create GitHub release → Attach installers
- electron-updater automatically checks GitHub
- Free for public repos

Option 2: **Custom server** (More control)
- Host `latest.yml` (macOS) and `latest-mac.yml` (Windows) on your server
- Point electron-updater to your URL

**package.json configuration:**
```json
{
  "build": {
    "publish": [
      {
        "provider": "github",
        "owner": "your-username",
        "repo": "roundnet-desktop"
      }
    ]
  }
}
```

---

## Code Signing & Security

### Why Code Signing?

**Without code signing:**
- macOS Gatekeeper blocks app ("App can't be opened because it is from an unidentified developer")
- Windows SmartScreen shows scary warning
- Users won't trust your app

**With code signing:**
✅ macOS/Windows recognize app as safe
✅ Professional appearance
✅ Required for auto-updates

---

### macOS Code Signing

**Requirements:**
1. **Apple Developer Account** ($99/year)
2. **Developer ID Application Certificate**
3. **Notarization** (Apple scans app for malware)

**Steps:**

1. **Get certificate:**
   - Join Apple Developer Program
   - Generate certificate in Xcode or developer.apple.com
   - Download and install in Keychain

2. **Update package.json:**
```json
{
  "build": {
    "mac": {
      "identity": "Developer ID Application: Your Name (TEAM_ID)",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist"
    },
    "afterSign": "scripts/notarize.js"
  }
}
```

3. **Create entitlements file:**
```xml
<!-- build/entitlements.mac.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
</dict>
</plist>
```

4. **Create notarization script:**
```javascript
// scripts/notarize.js
const { notarize } = require('electron-notarize')

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context

  if (electronPlatformName !== 'darwin') {
    return
  }

  const appName = context.packager.appInfo.productFilename

  return await notarize({
    appBundleId: 'com.roundnet.condenser',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID
  })
}
```

5. **Set environment variables:**
```bash
export APPLE_ID="your@email.com"
export APPLE_ID_PASSWORD="app-specific-password"  # Generate in Apple ID settings
export APPLE_TEAM_ID="YOUR_TEAM_ID"
```

---

### Windows Code Signing

**Requirements:**
1. **Code Signing Certificate** ($70-300/year from DigiCert, Sectigo, etc.)
2. **USB token** or cloud signing service

**Steps:**

1. **Purchase certificate** (DigiCert or Sectigo)

2. **Update package.json:**
```json
{
  "build": {
    "win": {
      "certificateFile": "cert.pfx",
      "certificatePassword": "YOUR_PASSWORD",
      "signingHashAlgorithms": ["sha256"],
      "signDlls": true
    }
  }
}
```

3. **Store certificate securely:**
   - Don't commit to Git
   - Use environment variables or CI/CD secrets

---

### Automate with GitHub Actions

```yaml
# .github/workflows/build.yml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm install

      - name: Build app (macOS)
        if: matrix.os == 'macos-latest'
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: npm run build

      - name: Build app (Windows)
        if: matrix.os == 'windows-latest'
        env:
          CSC_LINK: ${{ secrets.WIN_CERT_BASE64 }}
          CSC_KEY_PASSWORD: ${{ secrets.WIN_CERT_PASSWORD }}
        run: npm run build

      - name: Upload to GitHub Releases
        uses: softprops/action-gh-release@v1
        with:
          files: |
            dist/*.dmg
            dist/*.exe
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Implementation Checklist

### Phase 1: Packaging & Distribution (Week 1-2)

- [ ] **Code signing setup**
  - [ ] Purchase Apple Developer account ($99)
  - [ ] Generate Developer ID certificate
  - [ ] Purchase Windows code signing cert ($70-300)
  - [ ] Test signing locally

- [ ] **Build automation**
  - [ ] Set up GitHub Actions workflow
  - [ ] Add secrets (Apple ID, certificates)
  - [ ] Test automated builds

- [ ] **Create installers**
  - [ ] macOS .dmg (signed + notarized)
  - [ ] Windows .exe (signed)
  - [ ] Linux .AppImage (optional)

- [ ] **Version management**
  - [ ] Implement semantic versioning
  - [ ] Create changelog

---

### Phase 2: Backend & Auth (Week 2-4)

- [ ] **Database setup**
  - [ ] Create Supabase project
  - [ ] Define schema (users, subscriptions, licenses)
  - [ ] Set up migrations

- [ ] **Auth API**
  - [ ] POST /api/auth/register
  - [ ] POST /api/auth/login (returns JWT)
  - [ ] GET /api/auth/me
  - [ ] POST /api/auth/refresh

- [ ] **License validation API**
  - [ ] GET /api/license/validate
  - [ ] POST /api/license/activate (if using keys)

- [ ] **Electron integration**
  - [ ] Create AuthManager class
  - [ ] Implement login screen
  - [ ] Add keytar for secure token storage
  - [ ] Periodic license checking (24h interval)

---

### Phase 3: Payment Integration (Week 4-5)

- [ ] **Choose payment processor**
  - [ ] Create Lemon Squeezy or Stripe account
  - [ ] Set up products/prices

- [ ] **Webhook handler**
  - [ ] POST /api/webhooks/payment
  - [ ] Handle subscription.created
  - [ ] Handle subscription.updated
  - [ ] Handle subscription.cancelled

- [ ] **Email notifications**
  - [ ] Set up Resend or SendGrid
  - [ ] Welcome email template
  - [ ] License key email (if applicable)
  - [ ] Payment receipt

---

### Phase 4: Website (Week 5-6)

- [ ] **Landing page**
  - [ ] Homepage with features
  - [ ] Pricing page
  - [ ] FAQ section
  - [ ] Demo video

- [ ] **User dashboard**
  - [ ] Login/signup pages
  - [ ] Download links (protected)
  - [ ] Subscription management
  - [ ] Account settings

- [ ] **Domain & hosting**
  - [ ] Purchase domain (roundnetcondenser.com)
  - [ ] Deploy to Vercel
  - [ ] Set up SSL

---

### Phase 5: Auto-Updates (Week 6-7)

- [ ] **electron-updater setup**
  - [ ] Install and configure
  - [ ] Test update flow locally

- [ ] **Update server**
  - [ ] Set up GitHub Releases (or custom server)
  - [ ] Configure publish settings

- [ ] **In-app notifications**
  - [ ] "Update available" dialog
  - [ ] "Update downloaded" with restart button

---

### Phase 6: Polish & Launch (Week 7-8)

- [ ] **Analytics**
  - [ ] Add Plausible or PostHog
  - [ ] Track app usage (optional, with user consent)

- [ ] **Error reporting**
  - [ ] Sentry or Bugsnag integration
  - [ ] Crash reporting

- [ ] **Documentation**
  - [ ] User guide
  - [ ] Video tutorials
  - [ ] Troubleshooting

- [ ] **Beta testing**
  - [ ] TestFlight for macOS (optional)
  - [ ] Private beta with 5-10 users

- [ ] **Launch!**
  - [ ] Press release / blog post
  - [ ] Share on Reddit, Twitter, Product Hunt
  - [ ] Email existing users (if any)

---

## Cost Breakdown

### One-Time Costs
| Item | Cost |
|------|------|
| Apple Developer Account | $99/year |
| Windows Code Signing Cert | $70-300/year |
| Domain name | $10-15/year |
| **Total** | **~$180-420/year** |

### Monthly Costs (Recurring)
| Service | Cost |
|---------|------|
| Hosting (Vercel/Netlify) | $0 (free tier) |
| Database (Supabase) | $0-25/month |
| Email (Resend) | $0 (up to 3k emails/mo) |
| Payment processor (Lemon Squeezy) | 5% + $0.50 per transaction |
| CDN (Cloudflare R2) | $0.015/GB stored |
| **Total** | **$0-25/month** |

### Revenue Examples
| Scenario | Monthly Revenue | Annual Revenue |
|----------|----------------|----------------|
| 10 users @ $19/mo | $190 | $2,280 |
| 50 users @ $19/mo | $950 | $11,400 |
| 100 users @ $19/mo | $1,900 | $22,800 |
| 500 users @ $19/mo | $9,500 | $114,000 |

**Profitability:** With just 10-20 paying users, you cover all infrastructure costs.

---

## Recommended Tech Stack

### Minimal Viable Product (MVP)
**Goal:** Launch in 4-6 weeks with core features

```
Frontend/Marketing: Webflow or Framer ($20/mo)
Checkout: Lemon Squeezy (5% + $0.50/txn)
Database: Supabase (free tier)
Auth: Supabase Auth (built-in)
Email: Resend (free tier)
Downloads: GitHub Releases (free)
Analytics: Plausible (€9/mo or self-host free)
```

**Total cost:** ~$30/month + code signing certs

---

### Full-Featured (Recommended)
**Goal:** Professional, scalable product

```
Full-stack: Next.js 14 (free to host on Vercel)
Database: Supabase ($25/mo)
Auth: NextAuth.js or Supabase Auth
Payments: Stripe ($0 base, 2.9% + $0.30/txn)
Email: Resend (free tier → $20/mo at scale)
Downloads: Cloudflare R2 ($0.015/GB)
Analytics: PostHog (free tier)
Error tracking: Sentry (free tier)
```

**Total cost:** ~$25-50/month + payment fees

---

## Next Steps

### Immediate Actions (This Week)
1. **Choose pricing model** (subscription vs lifetime)
2. **Pick payment processor** (Lemon Squeezy for simplicity, Stripe for control)
3. **Set up domain** (roundnetcondenser.com or similar)
4. **Create wireframes** for landing page + dashboard

### Short-term (Next 2 Weeks)
1. **Purchase Apple Developer account**
2. **Set up Supabase project**
3. **Build basic Next.js website** with homepage + pricing
4. **Implement auth in Electron app**

### Medium-term (Next 4-6 Weeks)
1. **Complete payment integration**
2. **Add auto-update system**
3. **Beta test with 5-10 users**
4. **Launch! 🚀**

---

## Questions to Decide

Before starting implementation, decide:

1. **Pricing:**
   - Subscription only? Lifetime option? Both?
   - What price point? ($9, $19, $29/month?)
   - Free tier with limitations?

2. **Auth approach:**
   - Account-based (email/password)?
   - License key-based?
   - Social login (Google/GitHub)?

3. **Distribution:**
   - Direct only? App stores? Both?

4. **Platform priority:**
   - macOS first, then Windows?
   - Both simultaneously?

5. **Feature gating:**
   - Everything behind paywall?
   - Free tier with watermarks?

---

## Resources

### Documentation
- [Electron Builder](https://www.electron.build/)
- [electron-updater](https://www.electron.build/auto-update)
- [Next.js](https://nextjs.org/docs)
- [Supabase](https://supabase.com/docs)
- [Stripe](https://stripe.com/docs)
- [Lemon Squeezy](https://docs.lemonsqueezy.com/)

### Inspiration (Similar Products)
- **ScreenFlow** (Mac screen recorder) - $169 lifetime
- **Descript** (Video editor) - $24/month or $300/year
- **Riverside.fm** (Video recording) - $19-79/month
- **Kapwing** (Video editor) - Free tier + $16/month

---

**Good luck with your launch! 🚀**
