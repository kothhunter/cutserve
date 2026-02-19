/// <reference types="vite/client" />

import type { RoundnetAPI } from '../electron/preload'

declare global {
  interface Window {
    api: RoundnetAPI
  }
}
