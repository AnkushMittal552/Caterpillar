import React from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

interface ConnectionBannerProps {
  isLive: boolean;
  hasLoadedData?: boolean;
  error?: string | null;
  onRetry: () => void;
  isLoading: boolean;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({
  isLive,
  hasLoadedData = false,
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
            <strong>LIVE BACKEND CONNECTED</strong> — Receiving real-time telemetry, task updates, and incidents from{' '}
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
          <strong>BACKEND UNAVAILABLE</strong> —{' '}
          {hasLoadedData
            ? 'Displaying last loaded data. The backend at /api is currently unreachable.'
            : (error || 'Backend service is not reachable at /api. Displaying fallback dataset.')}
        </div>
      </div>
      <button
        className="banner-action-btn"
        onClick={onRetry}
        disabled={isLoading}
        title="Attempt to reconnect to backend"
      >
        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        <span>{isLoading ? 'Reconnecting...' : 'Reconnect'}</span>
      </button>
    </div>
  );
};
