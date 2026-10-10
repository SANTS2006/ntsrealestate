import { Component } from 'react';
import { isChunkLoadError, resetLazyRoutes } from '../utils/lazyWithRetry.js';
import { reportClientError } from '../utils/errorReporter.js';

// Catches a crash in anything below it so one broken page can never turn the
// whole app into a blank screen. `resetKey` (the current path) clears the
// error when the person navigates elsewhere. Plain markup and no router hooks
// on purpose: this must still render when everything else is broken.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.retry = this.retry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportClientError(isChunkLoadError(error) ? 'chunk' : 'render', error, { componentStack: String(info?.componentStack ?? '').slice(0, 600) });
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  retry() {
    resetLazyRoutes();
    this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = isChunkLoadError(error);
    const full = this.props.fullPage;
    return (
      <div role="alert" className={`${full ? 'min-h-screen' : 'min-h-[50vh]'} flex items-center justify-center bg-slate-50 p-6 dark:bg-slate-950`}>
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Something went wrong while loading this page.</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {chunk
              ? 'The connection dropped, or the system was just updated. Try again, or reload to get the latest version.'
              : 'It has been reported. You can try again, or go back to the dashboard.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={this.retry} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Try again</button>
            <button type="button" onClick={() => window.location.reload()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Reload</button>
            <a href="/dashboard" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Dashboard</a>
          </div>
        </div>
      </div>
    );
  }
}
