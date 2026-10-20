import { Component, type ReactNode } from 'react'
import { classify, ErrorScreen } from './ErrorScreen'

/** Catches render crashes and failed lazy chunks (e.g. after a deploy) so no page ever goes blank. Resets when `resetKey` (the route) changes. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }
  render() {
    const e = this.state.error
    if (!e) return this.props.children
    const kind = classify(e.message)
    return <ErrorScreen kind={kind === 'server' ? 'crash' : kind} message={import.meta.env.DEV ? e.message : undefined} onRetry={() => location.reload()} />
  }
}
