import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-2">
          <p className="text-red-400 font-medium text-sm">
            {this.props.label} panel crashed
          </p>
          <p className="text-muted text-xs leading-relaxed">
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-2 text-xs text-blue-400 underline hover:text-blue-300"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
