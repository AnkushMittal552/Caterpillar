import React, { useState } from 'react';
import type { Incident } from '../types';
import { IncidentCard } from '../components/IncidentCard';
import { ShieldAlert, RefreshCw, Filter, AlertTriangle } from 'lucide-react';

interface AlertsPageProps {
  incidents: Incident[];
  onAcknowledge: (id: string) => Promise<void>;
  onRefresh: () => void;
  isRefreshing: boolean;
}

type FilterOption = 'ALL' | 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export const AlertsPage: React.FC<AlertsPageProps> = ({
  incidents,
  onAcknowledge,
  onRefresh,
  isRefreshing,
}) => {
  const [filter, setFilter] = useState<FilterOption>('ALL');

  const activeCount = incidents.filter((i) => i.status.toUpperCase() === 'ACTIVE').length;
  const ackCount = incidents.filter((i) => i.status.toUpperCase() === 'ACKNOWLEDGED').length;
  const resolvedCount = incidents.filter((i) => i.status.toUpperCase() === 'RESOLVED').length;

  const filteredIncidents = incidents.filter((i) => {
    if (filter === 'ALL') return true;
    return i.status.toUpperCase() === filter;
  });

  return (
    <div className="alerts-container">
      {/* Header and Filter Controls */}
      <div className="alerts-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldAlert size={26} color="var(--cat-yellow)" />
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Safety & Operational Alerts
            </h1>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {activeCount} active incident{activeCount === 1 ? '' : 's'} requiring operator attention
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Filter Pills */}
          <div className="filter-pill-group">
            <button
              className={`filter-btn ${filter === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilter('ALL')}
            >
              All ({incidents.length})
            </button>
            <button
              className={`filter-btn ${filter === 'ACTIVE' ? 'active' : ''}`}
              onClick={() => setFilter('ACTIVE')}
            >
              Active ({activeCount})
            </button>
            <button
              className={`filter-btn ${filter === 'ACKNOWLEDGED' ? 'active' : ''}`}
              onClick={() => setFilter('ACKNOWLEDGED')}
            >
              Acknowledged ({ackCount})
            </button>
            <button
              className={`filter-btn ${filter === 'RESOLVED' ? 'active' : ''}`}
              onClick={() => setFilter('RESOLVED')}
            >
              Resolved ({resolvedCount})
            </button>
          </div>

          {/* Refresh Button */}
          <button
            className="banner-action-btn"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh incidents"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Incidents List or Empty States */}
      {incidents.length === 0 ? (
        <div className="empty-state-box">
          <AlertTriangle size={36} color="var(--text-muted)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            No active or historical incidents.
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '420px', marginTop: '0.3rem' }}>
            Telemetry gateway reports no logged safety or operational events for the current shift.
          </p>
        </div>
      ) : filteredIncidents.length === 0 ? (
        <div className="empty-state-box">
          <Filter size={36} color="var(--text-muted)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            No incidents match filter "{filter.toLowerCase()}".
          </h3>
          <button
            className="action-btn cancel-btn"
            style={{ marginTop: '0.75rem' }}
            onClick={() => setFilter('ALL')}
          >
            Show All Incidents ({incidents.length})
          </button>
        </div>
      ) : (
        <div className="incidents-grid">
          {filteredIncidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onAcknowledge={onAcknowledge}
            />
          ))}
        </div>
      )}
    </div>
  );
};
