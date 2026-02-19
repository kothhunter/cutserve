# CutServe — Releasing & Distribution Guide

## Prerequisites (local builds)

- **GitHub token**: Fine-grained token with **Contents: Read and write** on `kothhunter/cutserve`. Create at [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens?type=beta).
- **Python 3.10+** available as `python3`

---

## Publishing a Release (CI — recommended)

This builds for **both Apple Silicon and Intel Macs** automatically via GitHub Actions.

### 1. Bump the version

Edit `package.json`:

```json
"version": "1.0.1"
```

Use [semver](https://semver.org/): patch (`1.0.1`) for bug fixes, minor (`1.1.0`) for new features, major (`2.0.0`) for breaking changes.

### 2. Commit, tag, and push

```bash
git add package.json
git commit -m "release: v1.0.1"
git tag v1.0.1
git push && git push --tags
```

The `v*` tag triggers the GitHub Actions workflow, which builds arm64 + x64 DMGs and uploads them to a draft GitHub Release.

### 3. Publish the release

Go to [github.com/kothhunter/cutserve/releases](https://github.com/kothhunter/cutserve/releases), review the draft, and click **Publish release**.

### 4. Verify

The release should have:
- `CutServe-<version>-arm64.dmg` (Apple Silicon)
- `CutServe-<version>.dmg` (Intel)
- `latest-mac.yml` (auto-update metadata)

---

## Publishing a Release (local — arm64 only)

If you just need a quick arm64 build without CI:

```bash
GH_TOKEN=<your-token> npm run release
```

Then publish the draft on GitHub.

---

## Sharing with Beta Testers

### Send them this link

```
https://github.com/kothhunter/cutserve/releases/latest
```

They download the `.dmg`, open it, and drag CutServe to Applications.

### First-launch instructions (unsigned app)

Since the app is not code-signed, macOS will block it on first open. Tell testers:

> Right-click CutServe in Applications (or in the DMG) and choose **Open**, then click **Open** again in the dialog. You only have to do this once.

If that doesn't work (some stricter macOS versions):

> Go to **System Settings > Privacy & Security**, scroll down, and click **Open Anyway** next to the CutServe message.

### Important notes for testers

- The current build is **Apple Silicon (arm64) only**. Intel Mac users can't run it.
- Testers need **ffmpeg** installed for video export: `brew install ffmpeg`
- The app auto-checks for updates on launch. When you publish a new version, testers get a prompt to download and restart.

### Collecting feedback

Options:
- **GitHub Issues** — enable on the repo for structured bug reports
- **GitHub Discussions** — for open-ended feedback
- **Simple form** — Google Form or Tally linked from the app or shared alongside the download

---

## Beyond Beta — Full Launch Checklist

### Code signing & notarization
- Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
- Obtain a **Developer ID Application** certificate
- Add signing identity and notarization credentials to electron-builder config (`mac.identity`, `afterSign` hook with `@electron/notarize`)
- This eliminates the Gatekeeper warning — users can double-click to open without workarounds

### Universal binary (Intel + Apple Silicon)
- Add `"arch": ["x64", "arm64"]` or `"arch": ["universal"]` to the `mac` config in `package.json`
- Requires building PyInstaller binaries for both architectures (CI or a second machine)

### Windows build
- Build on a Windows machine or via GitHub Actions CI
- The `win`/`nsis` config is already in place — just needs to run on Windows

### CI/CD (GitHub Actions)
- Automate the release pipeline so you don't build locally
- Trigger on version tag push (`v*`)
- Build for macOS (arm64 + x64) and Windows in parallel
- Auto-publish to GitHub Releases

### Website & landing page
- Simple one-page site: hero video/GIF, download button, feature list
- Host on Vercel, Netlify, or GitHub Pages
- Domain: `cutserve.app` or `cutserve.com`
- Point the download button at `github.com/kothhunter/cutserve/releases/latest`

### Pricing & monetization
- The Supabase auth + export-limit system is already in place (free tier = 3 exports/month)
- Payment: Stripe Checkout or Lemon Squeezy for license keys
- Plans: Free (limited exports), Pro (unlimited, monthly), Lifetime (one-time)
- Deliver plan upgrades by updating the `profiles.plan` column in Supabase after payment webhook

### Analytics
- Track installs, exports, and feature usage via Supabase or a lightweight service like PostHog
- Use this data to prioritize features and understand retention
