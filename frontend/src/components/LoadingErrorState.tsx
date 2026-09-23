import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Synchronizing equipment telemetry...' }) => {
  return (
    <div className="loading-container">
      <div className="industrial-spinner" />
      <div style={{ fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.9rem' }}>
        {message}
      </div>
    </div>
  );
};

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Telemetry Connection Error',
  message,
  onRetry,
}) => {
  return (
    <div className="loading-container" style={{ color: 'var(--status-danger-text)' }}>
      <AlertCircle size={44} />
      <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{title}</h3>
      <p style={{ maxWidth: '500px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        {message}
      </p>
      {onRetry && (
        <button className="banner-action-btn" onClick={onRetry} style={{ marginTop: '1rem' }}>
          <RefreshCw size={14} />
          <span>Retry Connection</span>
        </button>
      )}
    </div>
  );
};
