import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-rc-darker text-white p-8">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold text-red-500 mb-4">Something went wrong</h1>
            <div className="bg-rc-surface p-4 rounded-lg border border-red-500/50">
              <p className="text-sm text-gray-300 mb-2">Error:</p>
              <pre className="text-xs text-red-400 overflow-auto">
                {this.state.error?.toString()}
              </pre>
              <pre className="text-xs text-gray-500 mt-2 overflow-auto">
                {this.state.error?.stack}
              </pre>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-rc-accent hover:bg-rc-accent-hover rounded-lg"
            >
              Reload App
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
