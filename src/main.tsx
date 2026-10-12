import React, { StrictMode, Component, ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './AuthContext.tsx';
import { ThemeProvider } from './ThemeContext.tsx';
import { LanguageProvider } from './LanguageContext.tsx';
import './index.css';

// Google Maps Platform Quota Defense (Tier 1 Global Handler)
(window as any).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};
const origError = console.error;
console.error = (...args: unknown[]) => {
  origError.apply(console, args);
  const msg = args.map((a) => String(a)).join(' ');
  if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
};

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('FoodLink root uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backgroundColor: '#F8FAF8', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '440px', width: '100%', background: '#fff', padding: '32px', borderRadius: '16px', border: '1px solid #D9E2DA', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
            <div style={{ width: '48px', height: '48px', background: '#EAF3EC', color: '#2E7D4F', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
              🍲
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1E2A22', margin: '0 0 8px' }}>FoodLink Portal</h2>
            <p style={{ fontSize: '14px', color: '#526357', margin: '0 0 20px', lineHeight: 1.5 }}>
              The application encountered a display refresh requirement. Click below to reload cleanly.
            </p>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('foodlink_demo_persona');
                } catch {
                  // ignore
                }
                window.location.reload();
              }}
              style={{ background: '#2E7D4F', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
