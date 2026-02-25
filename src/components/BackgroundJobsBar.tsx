export interface BackgroundJob {
  projectId: string
  projectName: string
  type: 'processing' | 'exporting'
  progress: number // 0-100
}

interface BackgroundJobsBarProps {
  jobs: BackgroundJob[]
  onCancelJob: (job: BackgroundJob) => void
}

export function BackgroundJobsBar({ jobs, onCancelJob }: BackgroundJobsBarProps) {
  if (jobs.length === 0) return null

  return (
    <div className="flex-shrink-0 bg-white border-t border-cut-warm/50 px-4 py-2 flex items-center gap-4">
      {jobs.map((job) => (
        <div key={`${job.type}-${job.projectId}`} className="flex items-center gap-3 min-w-0 flex-1">
          {/* Type badge */}
          <span className="text-[10px] uppercase tracking-wider font-bold text-cut-muted flex-shrink-0">
            {job.type === 'processing' ? 'Processing' : 'Exporting'}
          </span>

          {/* Project name */}
          <span className="text-sm font-medium text-cut-deep truncate max-w-[140px]">
            {job.projectName}
          </span>

          {/* Progress bar */}
          <div className="flex-1 min-w-[100px] max-w-[240px] bg-cut-warm/30 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-cut-deep rounded-full transition-all duration-500 ease-out"
              style={{ width: `${job.progress}%` }}
            />
          </div>

          {/* Percentage */}
          <span className="text-xs text-cut-mid tabular-nums flex-shrink-0 w-8 text-right">
            {job.progress}%
          </span>

          {/* Cancel button */}
          <button
            onClick={() => onCancelJob(job)}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-cut-muted hover:text-rc-red rounded transition-colors"
            title={`Cancel ${job.type}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
