interface NudgeControlsProps {
  /** Current start time in seconds */
  startTime: number
  /** Current end time in seconds */
  endTime: number
  /** Called when start time changes */
  onStartChange: (newStart: number) => void
  /** Called when end time changes */
  onEndChange: (newEnd: number) => void
  /** Total video duration (to clamp values) */
  videoDuration: number
}

interface NudgeButtonProps {
  label: string
  hotkey?: string
  onClick: () => void
  variant?: 'default' | 'large'
}

function NudgeButton({ label, hotkey, onClick, variant = 'default' }: NudgeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center justify-center rounded-md font-mono font-medium
        transition-all duration-150
        hover:scale-105 active:scale-95
        ${variant === 'large'
          ? 'px-4 py-2 text-sm bg-rc-surface-light hover:bg-rc-accent/30 border border-gray-600 hover:border-rc-accent'
          : 'px-3 py-1.5 text-xs bg-rc-surface hover:bg-rc-surface-light border border-gray-700'
        }
      `}
      title={hotkey ? `Hotkey: ${hotkey}` : undefined}
    >
      {label}
    </button>
  )
}

export function NudgeControls({
  startTime,
  endTime,
  onStartChange,
  onEndChange,
  videoDuration,
}: NudgeControlsProps) {
  return (
    <div className="flex flex-col gap-5 p-4 bg-rc-surface rounded-xl border border-gray-700/50 w-48">
      {/* ── Start Time Nudge ──────────────────────────────────────── */}
      <div>
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 font-semibold">
          Start Time
        </div>
        <div className="text-lg font-mono text-white mb-2">
          {formatTime(startTime)}
        </div>
        <div className="text-xs text-gray-500">
          Use <span className="font-mono text-gray-400">Q / E</span> and{' '}
          <span className="font-mono text-gray-400">⇧Q / ⇧E</span> hotkeys to adjust the start.
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-700" />

      {/* ── End Time Nudge ────────────────────────────────────────── */}
      <div>
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 font-semibold">
          End Time
        </div>
        <div className="text-lg font-mono text-white mb-2">
          {formatTime(endTime)}
        </div>
        <div className="text-xs text-gray-500">
          Use <span className="font-mono text-gray-400">A / D</span> and{' '}
          <span className="font-mono text-gray-400">⇧A / ⇧D</span> hotkeys to adjust the end.
        </div>
      </div>

      {/* Hotkey Legend */}
      <div className="border-t border-gray-700 pt-3">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">
          Hotkeys
        </div>
        <div className="space-y-1 text-xs text-gray-400">
          <div className="flex justify-between">
            <span>Start ±1.0s</span>
            <span className="font-mono text-gray-500">Q / E</span>
          </div>
          <div className="flex justify-between">
            <span>Start ±0.1s</span>
            <span className="font-mono text-gray-500">⇧Q / ⇧E</span>
          </div>
          <div className="flex justify-between">
            <span>End ±1.0s</span>
            <span className="font-mono text-gray-500">A / D</span>
          </div>
          <div className="flex justify-between">
            <span>End ±0.1s</span>
            <span className="font-mono text-gray-500">⇧A / ⇧D</span>
          </div>
          <div className="flex justify-between">
            <span>Prev / Next clip</span>
            <span className="font-mono text-gray-500">← / →</span>
          </div>
          <div className="flex justify-between">
            <span>Start / End here</span>
            <span className="font-mono text-gray-500">W / S</span>
          </div>
          <div className="flex justify-between">
            <span>Trash clip</span>
            <span className="font-mono text-gray-500">Del</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Format seconds as MM:SS.T */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`
}
