import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', margin: '20px auto', maxWidth: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '16px', borderRadius: '50%', color: 'var(--color-danger)', display: 'inline-flex' }}>
            <AlertTriangle size={40} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', margin: '0' }}>
            An unexpected error occurred in this view. This has been logged, and you can try to reload the view or switch to another section using the bottom tabs.
          </p>
          <pre style={{ background: 'rgba(0, 0, 0, 0.05)', padding: '12px', borderRadius: '8px', fontSize: '0.8rem', width: '100%', overflowX: 'auto', textAlign: 'left', fontFamily: 'monospace', color: 'var(--color-danger)', border: '1px solid var(--border-glass)' }}>
            {this.state.error?.toString()}
          </pre>
          <button className="btn btn-primary" onClick={this.handleReset} style={{ marginTop: '8px' }}>
            <RefreshCw size={16} /> Reload Section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
