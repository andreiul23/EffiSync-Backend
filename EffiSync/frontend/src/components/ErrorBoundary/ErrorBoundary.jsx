import { Component } from 'react';
import './ErrorBoundary.scss';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="error-boundary">
        <div className="error-boundary__card">
          <div className="error-boundary__icon">⚠️</div>
          <h2 className="error-boundary__title">Something went wrong</h2>
          <p className="error-boundary__message">
            We hit a snag rendering this view. Your data is safe — try again or head back home.
          </p>
          {this.state.error?.message && (
            <pre className="error-boundary__details">{this.state.error.message}</pre>
          )}
          <div className="error-boundary__actions">
            <button className="error-boundary__btn error-boundary__btn--primary" onClick={this.handleReset}>
              Try Again
            </button>
            <button className="error-boundary__btn" onClick={this.handleReload}>
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
