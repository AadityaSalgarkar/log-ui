import { Component, type ErrorInfo, type ReactNode } from "react"

interface Props {
  children: ReactNode
  /** What failed, for the message: "this chart", "this page". */
  what: string
  /** Changing this clears the error, e.g. the route path or the chart's settings. */
  resetKey?: unknown
  compact?: boolean
}

interface State {
  error: Error | null
  resetKey: unknown
}

/**
 * Contains a render error to the part of the page that threw. Without it, one bad chart unmounts the whole app and
 * the page goes blank.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`log-ui: ${this.props.what} failed to render`, error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div role="alert" className={this.props.compact ? "p-3 text-xs" : "rounded-lg border bg-card p-6 text-sm"}>
        <p className="font-medium text-destructive">Could not draw {this.props.what}.</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{error.message}</p>
        <button type="button" className="mt-2 text-xs text-primary underline" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    )
  }
}
