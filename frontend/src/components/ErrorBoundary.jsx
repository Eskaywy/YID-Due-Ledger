import React from 'react';

// Catches render-time crashes anywhere in the tree so a single component
// failure never white-screens the whole app (Audit issue H6).
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI crash:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 24, background: 'var(--slate-50)' }}>
          <div className="card" style={{ maxWidth: 480, textAlign: 'center' }} role="alert">
            <div className="card-body" style={{ padding: 36 }}>
              <h1 style={{ fontSize: 22, marginBottom: 10 }}>Something went wrong</h1>
              <p style={{ color: 'var(--slate-500)', fontSize: 14.5, marginBottom: 22, lineHeight: 1.6 }}>
                An unexpected error occurred while displaying this page. Your data is safe —
                try reloading, or go back to the dashboard.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button>
                <button className="btn btn-secondary" onClick={() => { window.location.href = '/'; }}>Go home</button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
