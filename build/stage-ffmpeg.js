#!/usr/bin/env node
/**
 * Copy static ffmpeg + ffprobe binaries from node_modules into vendor/ffmpeg/
 * so electron-builder can bundle them as extraResources.
 *
 * Cross-platform: works on macOS, Linux, and Windows.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.dirname(__dirname)
const VENDOR_DIR = path.join(PROJECT_ROOT, 'vendor', 'ffmpeg')

fs.mkdirSync(VENDOR_DIR, { recursive: true })

const isWin = process.platform === 'win32'
const ext = isWin ? '.exe' : ''

// --- ffmpeg ---
const ffmpegSrc = path.join(PROJECT_ROOT, 'node_modules', 'ffmpeg-static', `ffmpeg${ext}`)
if (!fs.existsSync(ffmpegSrc)) {
  console.error(`ERROR: ffmpeg-static binary not found at ${ffmpegSrc}`)
  console.error("Run 'npm install' first.")
  process.exit(1)
}

const ffmpegDest = path.join(VENDOR_DIR, `ffmpeg${ext}`)
fs.copyFileSync(ffmpegSrc, ffmpegDest)
if (!isWin) fs.chmodSync(ffmpegDest, 0o755)
console.log(`Staged: ffmpeg -> vendor/ffmpeg/ffmpeg${ext}`)

// --- ffprobe ---
const platformMap = { darwin: 'darwin', linux: 'linux', win32: 'win32' }
const archMap = { arm64: 'arm64', x64: 'x64' }
const platform = platformMap[process.platform] || process.platform
const arch = archMap[process.arch] || process.arch

const ffprobeCandidates = [
  path.join(PROJECT_ROOT, 'node_modules', 'ffprobe-static', 'bin', platform, arch, `ffprobe${ext}`),
  path.join(PROJECT_ROOT, 'node_modules', 'ffprobe-static', 'bin', platform, process.arch, `ffprobe${ext}`),
]

let ffprobeSrc = null
for (const candidate of ffprobeCandidates) {
  if (fs.existsSync(candidate)) {
    ffprobeSrc = candidate
    break
  }
}

if (ffprobeSrc) {
  const ffprobeDest = path.join(VENDOR_DIR, `ffprobe${ext}`)
  fs.copyFileSync(ffprobeSrc, ffprobeDest)
  if (!isWin) fs.chmodSync(ffprobeDest, 0o755)
  console.log(`Staged: ffprobe -> vendor/ffmpeg/ffprobe${ext}`)
} else {
  console.warn(`WARNING: ffprobe-static binary not found. Skipping ffprobe.`)
  console.warn(`  Looked in: ${ffprobeCandidates[0]}`)
}

console.log(`\nDone! vendor/ffmpeg/ contents:`)
for (const f of fs.readdirSync(VENDOR_DIR)) {
  const stat = fs.statSync(path.join(VENDOR_DIR, f))
  const sizeMB = (stat.size / (1024 * 1024)).toFixed(1)
  console.log(`  ${f}  (${sizeMB} MB)`)
}
