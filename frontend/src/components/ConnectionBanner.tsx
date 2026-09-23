import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useConnectionStatus } from '../api/useApi';

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
  const wsStatus = useConnectionStatus();

  if (isLive && wsStatus === 'CONNECTED') {
    return null; // Keep screen clean when 100% healthy and connected
  }

  if (isLive && wsStatus === 'RECONNECTING') {
    return (
      <div className="industrial-banner banner-reconnecting" role="status">
        <div className="banner-content">
          <RefreshCw size={18} className="animate-spin text-cat-yellow" />
          <div>
            <strong>REAL-TIME SYNC RECONNECTING</strong> — Re-establishing WebSocket link to machinery stream. HTTP fallback active.
          </div>
        </div>
      </div>
    );
  }

  if (isLive && wsStatus === 'DISCONNECTED') {
    return (
      <div className="industrial-banner banner-warning" role="status">
        <div className="banner-content">
          <AlertTriangle size={18} color="#F59E0B" />
          <div>
            <strong>REAL-TIME FEED PAUSED</strong> — Real-time event gateway is currently disconnected. State updates remain queryable via manual Sync.
          </div>
        </div>
        <button
          className="banner-action-btn"
          onClick={onRetry}
          disabled={isLoading}
          title="Refresh connection"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Sync Now</span>
        </button>
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
            ? 'Displaying last loaded snapshot. Backend at /api is unreachable; live updates paused.'
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
