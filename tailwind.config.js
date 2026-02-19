/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Primary palette (warm light theme) ─────────────────
        'cut-deep':  '#252323',   // charcoal – headings, primary buttons, dark text
        'cut-mid':   '#70798c',   // blue-grey – secondary text, icons
        'cut-base':  '#f5f1ed',   // cream     – main page background
        'cut-warm':  '#dad2bc',   // warm tan  – borders, hover fills, accents
        'cut-muted': '#a99985',   // warm brown – muted / inactive elements

        // ── Semantic status colours (unchanged) ──────────────────
        'rc-green':  '#22c55e',
        'rc-yellow': '#eab308',
        'rc-red':    '#ef4444',

        // ── Export-page dark palette (warm dark) ─────────────────
        // These map the old blue-grey dark tokens to warm-charcoal equivalents
        // so Export.tsx needs no class-name changes.
        'rc-darker':       '#1a1818',   // near-black warm
        'rc-dark':         '#252323',   // = cut-deep
        'rc-accent':       '#252323',   // primary action (was blue, now charcoal)
        'rc-accent-hover': '#3d3b3b',   // slightly lighter charcoal
        'rc-surface':      '#2e2b2b',   // dark warm surface (cards / inputs)
        'rc-surface-light':'#3d3a3a',   // lighter dark warm surface
      },
    },
  },
  plugins: [],
}
