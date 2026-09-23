import React, { useState } from 'react';
import {
  Users,
  CheckCircle,
  MessageSquare,
  Clock,
  RefreshCw,
  X,
  Send,
  Shield,
  ShieldAlert,
  FileText,
  Activity,
  Filter,
} from 'lucide-react';
import type { SupportRequest, SupportRequestStatus } from '../types';
import { useRole, useAuditTrail } from '../api/useApi';

interface SupervisorPageProps {
  requests: SupportRequest[];
  onAcknowledge: (id: string) => Promise<void>;
  onRespond: (id: string, message: string) => Promise<void>;
  onResolve: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
}

export const SupervisorPage: React.FC<SupervisorPageProps> = ({
  requests,
  onAcknowledge,
  onRespond,
  onResolve,
  onRefresh,
  isRefreshing,
}) => {
  const { isSupervisor, role } = useRole();
  const [activeTab, setActiveTab] = useState<'REQUESTS' | 'AUDIT'>('REQUESTS');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);
  const [responseMessage, setResponseMessage] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Audit trail state
  const [auditEntityFilter, setAuditEntityFilter] = useState<string>('ALL');
  const { data: auditEvents, loading: auditLoading, refresh: refreshAudit } = useAuditTrail({
    entity_type: auditEntityFilter === 'ALL' ? undefined : auditEntityFilter,
    limit: 100,
  });

  const filteredRequests = requests.filter((r) => {
    if (filterStatus === 'ALL') return true;
    return r.status.toUpperCase() === filterStatus;
  });

  const handleAcknowledge = async (id: string) => {
    if (!isSupervisor) {
      setActionError('Action restricted: Only users in the SUPERVISOR role can acknowledge support tickets.');
      return;
    }
    setActionLoadingId(id);
    setActionError(null);
    try {
      await onAcknowledge(id);
      refreshAudit();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to acknowledge request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenRespondModal = (id: string) => {
    if (!isSupervisor) {
      setActionError('Action restricted: Only users in the SUPERVISOR role can respond to support tickets.');
      return;
    }
    setRespondingRequestId(id);
    setResponseMessage('');
    setActionError(null);
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondingRequestId || !responseMessage.trim()) return;

    setActionLoadingId(respondingRequestId);
    setActionError(null);
    try {
      await onRespond(respondingRequestId, responseMessage.trim());
      setRespondingRequestId(null);
      setResponseMessage('');
      refreshAudit();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to submit response.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResolve = async (id: string) => {
    if (!isSupervisor) {
      setActionError('Action restricted: Only users in the SUPERVISOR role can resolve support tickets.');
      return;
    }
    setActionLoadingId(id);
    setActionError(null);
    try {
      await onResolve(id);
      refreshAudit();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to resolve request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadgeColor = (status: SupportRequestStatus) => {
    switch (status) {
      case 'OPEN':
        return { bg: 'rgba(239, 68, 68, 0.2)', text: '#F87171', border: '#EF4444' };
      case 'ACKNOWLEDGED':
        return { bg: 'rgba(245, 158, 11, 0.2)', text: '#FBBF24', border: '#F59E0B' };
      case 'IN_PROGRESS':
        return { bg: 'rgba(59, 130, 246, 0.2)', text: '#60A5FA', border: '#3B82F6' };
      case 'RESOLVED':
        return { bg: 'rgba(16, 185, 129, 0.2)', text: '#34D399', border: '#10B981' };
      default:
        return { bg: '#374151', text: '#9CA3AF', border: '#4B5563' };
    }
  };

  return (
    <div className="page-container" style={{ padding: '24px 0' }}>
      {/* Top Header & Navigation Tabs */}
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#F3F4F6', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={24} color="#EAB308" />
            Supervisor Coordination & Governance Hub
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#9CA3AF', fontSize: 14 }}>
            Real-time operator communications dispatch, decision governance, and traceable shift audit trail.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="role-indicator-badge" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 6,
            background: isSupervisor ? 'rgba(234, 179, 8, 0.15)' : 'rgba(148, 163, 184, 0.15)',
            border: isSupervisor ? '1px solid #EAB308' : '1px solid #64748B',
            color: isSupervisor ? '#FBBF24' : '#CBD5E1',
            fontSize: 12,
            fontWeight: 700,
          }}>
            {isSupervisor ? <Shield size={14} /> : <Users size={14} />}
            <span>Active Role: {role}</span>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => {
              onRefresh();
              refreshAudit();
            }}
            disabled={isRefreshing || auditLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={16} className={(isRefreshing || auditLoading) ? 'spin' : ''} />
            <span>Sync Hub</span>
          </button>
        </div>
      </div>

      {/* Main Mode Tabs */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid #374151', paddingBottom: 12, marginBottom: 20 }}>
        <button
          type="button"
          className={`btn ${activeTab === 'REQUESTS' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('REQUESTS')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}
        >
          <MessageSquare size={16} />
          <span>Operator Support Tickets ({requests.length})</span>
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'AUDIT' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('AUDIT')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}
        >
          <FileText size={16} />
          <span>Shift Audit Trail & Traceability</span>
        </button>
      </div>

      {/* Role Restriction Banner if Operator is viewing */}
      {!isSupervisor && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 8,
          color: '#FDE68A',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <ShieldAlert size={20} color="#F59E0B" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 13 }}>
            <strong>OPERATOR VIEW ONLY:</strong> Action controls (Acknowledge, Respond, Resolve) require{' '}
            <strong style={{ color: '#FBBF24' }}>SUPERVISOR</strong> authorization. Switch to Supervisor in the top header to dispatch responses or resolve requests.
          </div>
        </div>
      )}

      {actionError && (
        <div style={{ padding: '10px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, color: '#FCA5A5', marginBottom: 20 }}>
          {actionError}
        </div>
      )}

      {/* TAB 1: OPERATOR SUPPORT REQUESTS */}
      {activeTab === 'REQUESTS' && (
        <>
          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            {['ALL', 'OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED'].map((status) => (
              <button
                key={status}
                className={`btn ${filterStatus === status ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterStatus(status)}
                style={{ fontSize: 13, padding: '6px 14px' }}
              >
                {status.replace(/_/g, ' ')}
                <span style={{ marginLeft: 6, opacity: 0.8, fontSize: 11 }}>
                  ({status === 'ALL' ? requests.length : requests.filter((r) => r.status.toUpperCase() === status).length})
                </span>
              </button>
            ))}
          </div>

          {/* Requests List */}
          {filteredRequests.length === 0 ? (
            <div style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 8, padding: 32, textAlign: 'center', color: '#9CA3AF' }}>
              <CheckCircle size={36} color="#10B981" style={{ margin: '0 auto 12px auto', display: 'block' }} />
              <h3 style={{ margin: 0, color: '#F3F4F6', fontSize: 16 }}>No requests in this category</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 13 }}>All incoming operator communications have been handled.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {filteredRequests.map((req) => {
                const badge = getStatusBadgeColor(req.status as SupportRequestStatus);
                const isActing = actionLoadingId === req.id;

                return (
                  <div
                    key={req.id}
                    className="request-card"
                    style={{
                      background: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: 8,
                      padding: 20,
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 700, fontSize: 16, color: '#F3F4F6' }}>{req.id}</span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                            }}
                          >
                            {req.status}
                          </span>
                          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                            Type: <strong style={{ color: '#E5E7EB' }}>{req.request_type.replace(/_/g, ' ')}</strong>
                          </span>
                          {req.task_id && (
                            <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                              Task: <strong style={{ color: '#E5E7EB' }}>{req.task_id}</strong>
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                          Operator: <strong>{req.operator_id}</strong> | Machine: <strong>{req.machine_id}</strong> | Received:{' '}
                          {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        {req.status === 'OPEN' && (
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleAcknowledge(req.id)}
                            disabled={isActing || !isSupervisor}
                            style={{
                              fontSize: 12,
                              padding: '6px 12px',
                              opacity: !isSupervisor ? 0.5 : 1,
                              cursor: !isSupervisor ? 'not-allowed' : 'pointer',
                            }}
                            title={!isSupervisor ? 'Requires Supervisor role' : 'Acknowledge ticket'}
                          >
                            {isActing ? 'Saving...' : 'Acknowledge'}
                          </button>
                        )}

                        {req.status !== 'RESOLVED' && (
                          <button
                            className="btn btn-primary"
                            onClick={() => handleOpenRespondModal(req.id)}
                            disabled={isActing || !isSupervisor}
                            style={{
                              fontSize: 12,
                              padding: '6px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              opacity: !isSupervisor ? 0.5 : 1,
                              cursor: !isSupervisor ? 'not-allowed' : 'pointer',
                            }}
                            title={!isSupervisor ? 'Requires Supervisor role' : 'Respond to operator'}
                          >
                            <MessageSquare size={14} />
                            Respond
                          </button>
                        )}

                        {req.status !== 'RESOLVED' && (
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleResolve(req.id)}
                            disabled={isActing || !isSupervisor}
                            style={{
                              fontSize: 12,
                              padding: '6px 12px',
                              color: '#34D399',
                              borderColor: '#059669',
                              opacity: !isSupervisor ? 0.5 : 1,
                              cursor: !isSupervisor ? 'not-allowed' : 'pointer',
                            }}
                            title={!isSupervisor ? 'Requires Supervisor role' : 'Mark ticket as resolved'}
                          >
                            {isActing ? 'Resolving...' : 'Resolve'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Message Body */}
                    <div style={{ padding: '12px 14px', background: '#111827', borderRadius: 6, marginBottom: 16, border: '1px solid #374151' }}>
                      <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>
                        Operator Message
                      </div>
                      <div style={{ color: '#F3F4F6', fontSize: 14 }}>{req.message}</div>
                    </div>

                    {/* Timeline / Events */}
                    {req.events && req.events.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={12} />
                          Chronological Communication Timeline
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {req.events.map((ev, idx) => (
                            <div
                              key={ev.id || idx}
                              style={{
                                display: 'flex',
                                gap: 12,
                                fontSize: 13,
                                background: '#111827',
                                padding: '8px 12px',
                                borderRadius: 6,
                                borderLeft: '3px solid #EAB308',
                              }}
                            >
                              <div style={{ minWidth: 65, color: '#9CA3AF', fontSize: 11, paddingTop: 2 }}>
                                {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div>
                                <span style={{ fontWeight: 600, color: '#EAB308', marginRight: 6 }}>
                                  [{ev.actor_id}]
                                </span>
                                <span style={{ fontWeight: 600, color: '#F3F4F6', marginRight: 6 }}>
                                  {ev.event_type}:
                                </span>
                                <span style={{ color: '#D1D5DB' }}>{ev.message}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: AUDIT TRAIL & TRACEABILITY */}
      {activeTab === 'AUDIT' && (
        <div className="audit-trail-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Filter size={16} color="#9CA3AF" />
              <span style={{ fontSize: 13, color: '#9CA3AF' }}>Filter Category:</span>
              {['ALL', 'TASK', 'INCIDENT', 'SUPPORT_REQUEST', 'TRAINING', 'SYSTEM'].map((cat) => (
                <button
                  key={cat}
                  className={`btn ${auditEntityFilter === cat ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setAuditEntityFilter(cat)}
                  style={{ fontSize: 12, padding: '4px 10px' }}
                >
                  {cat.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => refreshAudit()}
              disabled={auditLoading}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              <RefreshCw size={12} className={auditLoading ? 'spin' : ''} />
              <span>Refresh Log</span>
            </button>
          </div>

          {(!auditEvents || auditEvents.length === 0) ? (
            <div style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 8, padding: 32, textAlign: 'center', color: '#9CA3AF' }}>
              <Activity size={32} color="#EAB308" style={{ margin: '0 auto 12px auto', display: 'block' }} />
              <h3 style={{ margin: 0, color: '#F3F4F6', fontSize: 15 }}>No audit events logged</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 13 }}>System actions and task state changes will be recorded here.</p>
            </div>
          ) : (
            <div className="audit-events-table-wrapper" style={{
              background: '#1F2937',
              border: '1px solid #374151',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#111827', borderBottom: '1px solid #374151', color: '#9CA3AF', fontSize: 11, textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 14px' }}>Time</th>
                    <th style={{ padding: '10px 14px' }}>Actor</th>
                    <th style={{ padding: '10px 14px' }}>Action</th>
                    <th style={{ padding: '10px 14px' }}>Entity</th>
                    <th style={{ padding: '10px 14px' }}>Details / Context</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.map((evt) => {
                    const detailsStr = typeof evt.details === 'object' && evt.details !== null
                      ? JSON.stringify(evt.details)
                      : String(evt.details || '');

                    return (
                      <tr key={evt.id} style={{ borderBottom: '1px solid #283548' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                          {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: evt.actor_role === 'SUPERVISOR' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                            color: evt.actor_role === 'SUPERVISOR' ? '#FBBF24' : '#60A5FA',
                            fontSize: 11,
                            fontWeight: 700,
                          }}>
                            {evt.actor_id} ({evt.actor_role})
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#F3F4F6', whiteSpace: 'nowrap' }}>
                          {evt.action}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#CBD5E1', whiteSpace: 'nowrap' }}>
                          <span style={{ color: '#9CA3AF' }}>{evt.entity_type}:</span> {evt.entity_id}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#94A3B8', fontFamily: 'var(--font-mono)', fontSize: 11, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={detailsStr}>
                          {detailsStr || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Supervisor Response Modal */}
      {respondingRequestId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#1F2937',
              border: '1px solid #4B5563',
              borderRadius: 12,
              padding: 24,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#F3F4F6', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={18} color="#EAB308" />
                Respond to Ticket {respondingRequestId}
              </h3>
              <button
                type="button"
                onClick={() => setRespondingRequestId(null)}
                style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitResponse}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#D1D5DB', marginBottom: 6 }}>
                  Supervisor Instructions / ETA Message:
                </label>
                <textarea
                  rows={4}
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  placeholder="e.g., Haul truck dispatched from Pit B. ETA 6 minutes. Proceed with stockpiling."
                  required
                  style={{
                    width: '100%',
                    background: '#111827',
                    border: '1px solid #4B5563',
                    borderRadius: 6,
                    padding: '10px 12px',
                    color: '#F3F4F6',
                    fontSize: 14,
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRespondingRequestId(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!responseMessage.trim() || actionLoadingId !== null}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Send size={14} />
                  <span>{actionLoadingId ? 'Dispatching...' : 'Dispatch Instructions'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
