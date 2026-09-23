import React, { useState } from 'react';
import type { Incident } from '../types';
import { StatusBadge } from './StatusBadge';
import { EvidenceList } from './EvidenceList';
import { CheckCircle2, Clock, Truck, Check, AlertCircle } from 'lucide-react';

interface IncidentCardProps {
  incident: Incident;
  onAcknowledge: (id: string) => Promise<void>;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({ incident, onAcknowledge }) => {
  const [acknowledging, setAcknowledging] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = incident.status.toUpperCase() === 'ACTIVE';
  const isAcknowledged = incident.status.toUpperCase() === 'ACKNOWLEDGED';
  const isResolved = incident.status.toUpperCase() === 'RESOLVED';

  const formatTime = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const handleAcknowledge = async () => {
    setError(null);
    setAcknowledging(true);
    try {
      await onAcknowledge(String(incident.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to acknowledge incident.';
      setError(msg);
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <div
      className={`incident-card ${isActive ? 'active' : isAcknowledged ? 'acknowledged' : 'resolved'}`}
      data-testid={`incident-${incident.id}`}
    >
      {/* Top Header: Severity + Category Badges */}
      <div className="incident-card-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <StatusBadge status={incident.severity} type="severity" />
          <StatusBadge status={incident.category} type="category" />
          <span className="incident-id-tag">{incident.id}</span>
        </div>
        <StatusBadge status={incident.status} type="incident" />
      </div>

      {/* Main Title & Message */}
      <div className="incident-main-body">
        <h3 className="incident-title">{incident.title}</h3>
        {incident.message && <p className="incident-message">{incident.message}</p>}
      </div>

      {/* Metadata Row: Machine, Task, Detected Time */}
      <div className="incident-meta-row">
        <div className="incident-meta-item">
          <Truck size={14} color="var(--text-muted)" />
          <span>Machine: <strong>{incident.machine_id}</strong></span>
        </div>
        {incident.task_id && (
          <div className="incident-meta-item">
            <span>Task: <strong>{incident.task_id}</strong></span>
          </div>
        )}
        <div className="incident-meta-item">
          <Clock size={14} color="var(--text-muted)" />
          <span>Detected: <strong>{formatTime(incident.created_at)}</strong></span>
        </div>
      </div>

      {/* Reusable Evidence List */}
      {incident.evidence ? <EvidenceList evidence={incident.evidence} /> : null}

      {/* Lifecycle Information */}
      {isAcknowledged && incident.acknowledged_at && (
        <div className="incident-lifecycle-note">
          <CheckCircle2 size={15} color="var(--status-operational-text)" />
          <span>Acknowledged by operator at {formatTime(incident.acknowledged_at)}</span>
        </div>
      )}

      {isResolved && incident.resolved_at && (
        <div className="incident-lifecycle-note">
          <CheckCircle2 size={15} color="var(--status-operational-text)" />
          <span>Resolved at {formatTime(incident.resolved_at)}</span>
        </div>
      )}

      {/* Error message if action failed */}
      {error && (
        <div className="incident-action-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Actions: Operator can ACKNOWLEDGE if ACTIVE. No Resolve button unless specified */}
      {isActive && (
        <div className="incident-actions-row">
          <button
            className="action-btn acknowledge-btn"
            onClick={handleAcknowledge}
            disabled={acknowledging}
          >
            {acknowledging ? (
              <span>Saving...</span>
            ) : (
              <>
                <Check size={16} />
                <span>ACKNOWLEDGE</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
