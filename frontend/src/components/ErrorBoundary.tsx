import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "./ui";

interface State {
  error: Error | null;
}

/** Keeps a rendering bug in one page from blanking the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI error", error, info);
  }

  render() {
    if (this.state.error) {
      return <ErrorState message={`Something went wrong rendering this page: ${this.state.error.message}`} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
