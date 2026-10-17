import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
          <section className="w-full max-w-2xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
            <h1 className="font-display text-2xl text-red-700">The admin page could not be displayed</h1>
            <p className="mt-3 text-sm text-slate-700">{this.state.error.message || 'An unexpected rendering error occurred.'}</p>
            <button
              className="mt-5 rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
