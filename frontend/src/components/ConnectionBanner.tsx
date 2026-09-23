import React from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

interface ConnectionBannerProps {
  isLive: boolean;
  isBackendUnavailable: boolean;
  error?: string | null;
  onRetry: () => void;
  isLoading: boolean;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({
  isLive,
  error,
  onRetry,
  isLoading,
}) => {
  if (isLive) {
    return (
      <div className="industrial-banner banner-live" role="status">
        <div className="banner-content">
          <Wifi size={18} color="#10B981" />
          <div>
            <strong>LIVE BACKEND CONNECTED</strong> — Receiving real-time telemetry and task updates from{' '}
            <code style={{ fontFamily: 'var(--font-mono)' }}>/api</code>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="industrial-banner banner-offline" role="alert">
      <div className="banner-content">
        <WifiOff size={18} color="#EF4444" />
        <div>
          <strong>BACKEND OFFLINE</strong> —{' '}
          {error ? error : 'Backend service is not reachable at /api'}. Showing local mock data for Phase 1 preview.
        </div>
      </div>
      <button
        className="banner-action-btn"
        onClick={onRetry}
        disabled={isLoading}
        title="Attempt to connect to backend"
      >
        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        <span>{isLoading ? 'Checking...' : 'Retry Connection'}</span>
      </button>
    </div>
  );
};
