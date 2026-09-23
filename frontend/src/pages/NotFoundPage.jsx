import React from 'react';
import { Link } from 'react-router-dom';

// Dedicated 404 screen (Audit issue M16) — unknown routes no longer silently
// bounce to "/" with no feedback.
export default function NotFoundPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 24, background: 'var(--slate-50)', textAlign: 'center' }}>
      <div>
        <div className="logo-icon" style={{ margin: '0 auto 20px' }}>YD</div>
        <h1 style={{ fontSize: 44, color: 'var(--slate-900)', marginBottom: 8 }}>404</h1>
        <p style={{ color: 'var(--slate-500)', fontSize: 15.5, marginBottom: 26, maxWidth: 380, lineHeight: 1.6 }}>
          The page you are looking for doesn’t exist or may have been moved.
        </p>
        <Link to="/" className="btn btn-primary">Go to home</Link>
      </div>
    </div>
  );
}
