interface UpgradeModalProps {
  used: number
  limit: number
  reason?: string
  onClose: () => void
}

export function UpgradeModal({ used, limit, reason, onClose }: UpgradeModalProps) {
  const isDeviceLimit = reason === 'device_limit'

  const handleUpgrade = () => {
    window.api.openExternal('https://cutserve.app/pricing')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 bg-white rounded-2xl border border-cut-warm/40 shadow-xl overflow-hidden">

        {/* Header */}
        <div className="bg-cut-deep px-6 py-5 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-cut-warm/70 mb-1">
            {isDeviceLimit ? 'Device Limit Reached' : 'Export Limit Reached'}
          </p>
          <h2 className="text-xl font-bold text-cut-base">
            {isDeviceLimit ? 'Too Many Devices' : 'Upgrade to Pro'}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Usage meter */}
          <div className="bg-cut-base rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-cut-deep">{used} / {limit}</p>
            <p className="text-xs text-cut-mid mt-1">
              {isDeviceLimit ? 'active devices on this account' : 'exports used this month'}
            </p>
            <div className="mt-3 h-1.5 bg-cut-warm/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-cut-deep rounded-full"
                style={{ width: `${Math.min((used / limit) * 100, 100)}%` }}
              />
            </div>
          </div>

          <p className="text-sm text-cut-mid text-center leading-relaxed">
            {isDeviceLimit ? (
              <>
                Your account is already active on <span className="font-semibold text-cut-deep">{limit} devices</span>.
                Devices that haven't exported in 30 days are removed automatically.
              </>
            ) : (
              <>
                Free accounts get <span className="font-semibold text-cut-deep">{limit} exports</span> per month.
                Upgrade to Pro for unlimited exports and all future features.
              </>
            )}
          </p>

          {/* CTA */}
          {!isDeviceLimit && (
            <button
              onClick={handleUpgrade}
              className="w-full h-10 text-sm font-semibold bg-cut-deep text-cut-base hover:bg-cut-deep/90 rounded-xl transition-colors"
            >
              View Pricing →
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full h-10 text-sm font-medium text-cut-mid hover:text-cut-deep transition-colors"
          >
            {isDeviceLimit ? 'Close' : 'Maybe Later'}
          </button>
        </div>
      </div>
    </div>
  )
}
