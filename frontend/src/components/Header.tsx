import React from 'react';
import { HardHat, RefreshCw } from 'lucide-react';

interface HeaderProps {
  operatorId?: string;
  machineId?: string;
  machineStatus?: string;
  isLive: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  operatorId = 'OP1001',
  machineId = 'EXC001',
  machineStatus = 'OPERATIONAL',
  isLive,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <header className="industrial-header">
      <div className="brand-section">
        <div className="brand-logo">
          <HardHat size={20} />
          <span>CAT</span>
        </div>
        <div className="brand-title">ShiftMate</div>
      </div>

      <div className="header-badges">
        {/* Operator Badge */}
        <div className="header-badge">
          <span className="header-badge-label">Operator ID</span>
          <span className="header-badge-value">{operatorId}</span>
        </div>

        {/* Machine Badge */}
        <div className="header-badge">
          <span className="header-badge-label">Machine ID</span>
          <span className="header-badge-value">{machineId}</span>
        </div>

        {/* Shift & Status */}
        <div className="header-badge">
          <span className="header-badge-label">Shift / Status</span>
          <span className="header-badge-value">Day Shift · {machineStatus}</span>
        </div>

        {/* Connection Status Indicator - Never shows LIVE if backend is unreachable */}
        <div
          className={`connection-pill ${isLive ? 'live' : 'offline'}`}
          title={isLive ? 'Connected to live backend /api' : 'Backend offline - viewing mock data'}
        >
          <span className={`pulse-dot ${isLive ? 'live' : 'offline'}`} />
          <span>{isLive ? 'LIVE' : 'OFFLINE'}</span>
        </div>

        {/* Manual Refresh Button */}
        {onRefresh && (
          <button
            className="banner-action-btn"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Check backend connection"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
        )}
      </div>
    </header>
  );
};
