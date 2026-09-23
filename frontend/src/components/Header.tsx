import React, { useState, useRef, useEffect } from 'react';
import { HardHat, RefreshCw, Bell, UserCheck, Shield, Check } from 'lucide-react';
import { useRole, useConnectionStatus, useNotifications } from '../api/useApi';

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
  const { setRole, isSupervisor } = useRole();
  const connStatus = useConnectionStatus();
  const { data: notifications, unreadCount, markRead, markAllRead } = useNotifications(20);
  const [showNotifications, setShowNotifications] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close notifications dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const getConnectionPillClass = () => {
    if (connStatus === 'CONNECTED' && isLive) return 'live';
    if (connStatus === 'RECONNECTING') return 'reconnecting';
    return 'offline';
  };

  const getConnectionLabel = () => {
    if (connStatus === 'CONNECTED' && isLive) return 'LIVE · WS';
    if (connStatus === 'RECONNECTING') return 'RECONNECTING';
    return 'DISCONNECTED';
  };

  return (
    <header className="industrial-header">
      <div className="brand-section">
        <div className="brand-logo">
          <HardHat size={20} />
          <span>CAT</span>
        </div>
        <div className="brand-title">ShiftMate</div>
        <span className="phase-pill">PHASE 5 INTEGRATED</span>
      </div>

      <div className="header-badges">
        {/* Role Switcher Toggle */}
        <div className="role-switcher-container">
          <span className="role-switcher-label">Active Role:</span>
          <div className="role-segmented-control">
            <button
              type="button"
              className={`role-btn ${!isSupervisor ? 'active' : ''}`}
              onClick={() => setRole('OPERATOR')}
              title="Operate machinery, view tasks & alerts, submit requests"
            >
              <UserCheck size={14} />
              <span>Operator</span>
            </button>
            <button
              type="button"
              className={`role-btn ${isSupervisor ? 'active supervisor' : ''}`}
              onClick={() => setRole('SUPERVISOR')}
              title="Supervisor authority: acknowledge & resolve requests, view audit log"
            >
              <Shield size={14} />
              <span>Supervisor</span>
            </button>
          </div>
        </div>

        {/* Operator Badge */}
        <div className="header-badge">
          <span className="header-badge-label">Operator</span>
          <span className="header-badge-value">{operatorId}</span>
        </div>

        {/* Machine Badge */}
        <div className="header-badge">
          <span className="header-badge-label">Equipment / Status</span>
          <span className="header-badge-value">{machineId} · {machineStatus}</span>
        </div>

        {/* Connection Status Indicator */}
        <div
          className={`connection-pill ${getConnectionPillClass()}`}
          title={`Real-Time Connection: ${connStatus}. API: ${isLive ? 'Online' : 'Offline'}`}
        >
          <span className={`pulse-dot ${getConnectionPillClass()}`} />
          <span>{getConnectionLabel()}</span>
        </div>

        {/* Unified Notification Center */}
        <div className="notification-center-wrapper" ref={popoverRef}>
          <button
            type="button"
            className={`notification-bell-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
            onClick={() => setShowNotifications(!showNotifications)}
            title="Unified Shift Notification Center"
          >
            <Bell size={16} />
            {unreadCount > 0 && <span className="notification-badge-count">{unreadCount}</span>}
          </button>

          {showNotifications && (
            <div className="notification-popover">
              <div className="notification-popover-header">
                <div className="popover-title-row">
                  <Bell size={16} className="text-cat-yellow" />
                  <h4>Shift Notifications</h4>
                  {unreadCount > 0 && <span className="unread-tag">{unreadCount} new</span>}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="popover-action-btn"
                    onClick={markAllRead}
                    title="Mark all notifications as read"
                  >
                    <Check size={12} />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              <div className="notification-popover-body">
                {(!notifications || notifications.length === 0) ? (
                  <div className="empty-notifications">
                    <span>No notifications logged this shift.</span>
                  </div>
                ) : (
                  <ul className="notification-list">
                    {notifications.map((notif) => (
                      <li
                        key={notif.id}
                        className={`notification-item ${notif.read ? 'read' : 'unread'} priority-${notif.priority.toLowerCase()}`}
                        onClick={() => !notif.read && markRead(notif.id)}
                      >
                        <div className="notif-header">
                          <span className={`notif-category cat-${notif.category.toLowerCase()}`}>
                            {notif.category}
                          </span>
                          <span className="notif-time">
                            {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="notif-title">{notif.title}</div>
                        <div className="notif-message">{notif.message}</div>
                        {!notif.read && (
                          <div className="notif-actions">
                            <span className="mark-read-hint">Click to mark read</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Manual Refresh Button */}
        {onRefresh && (
          <button
            className="banner-action-btn"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Sync latest shift state"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
        )}
      </div>
    </header>
  );
};
