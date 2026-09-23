import React, { useState } from 'react';
import { Users, CheckCircle, MessageSquare, Clock, RefreshCw, X, Send } from 'lucide-react';
import type { SupportRequest, SupportRequestStatus } from '../types';

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
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);
  const [responseMessage, setResponseMessage] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredRequests = requests.filter((r) => {
    if (filterStatus === 'ALL') return true;
    return r.status.toUpperCase() === filterStatus;
  });

  const handleAcknowledge = async (id: string) => {
    setActionLoadingId(id);
    setActionError(null);
    try {
      await onAcknowledge(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to acknowledge request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenRespondModal = (id: string) => {
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
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to submit response.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResolve = async (id: string) => {
    setActionLoadingId(id);
    setActionError(null);
    try {
      await onResolve(id);
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
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#F3F4F6', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={24} color="#EAB308" />
            Supervisor Coordination Hub
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#9CA3AF', fontSize: 14 }}>
            Review, acknowledge, dispatch, and resolve operator support requests in real time.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={onRefresh}
          disabled={isRefreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Requests'}
        </button>
      </div>

      {actionError && (
        <div style={{ padding: '10px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, color: '#FCA5A5', marginBottom: 20 }}>
          {actionError}
        </div>
      )}

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#EAB308' }}>{req.id}</span>
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
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#374151',
                          color: '#E5E7EB',
                        }}
                      >
                        {req.request_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                      Operator: <strong style={{ color: '#F3F4F6' }}>{req.operator_id}</strong> | Machine: <strong style={{ color: '#F3F4F6' }}>{req.machine_id}</strong>
                      {req.task_id && <> | Task: <strong style={{ color: '#F3F4F6' }}>{req.task_id}</strong></>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {req.status === 'OPEN' && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleAcknowledge(req.id)}
                        disabled={isActing}
                        style={{ fontSize: 12, padding: '6px 12px' }}
                      >
                        {isActing ? 'Saving...' : 'Acknowledge'}
                      </button>
                    )}

                    {req.status !== 'RESOLVED' && (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleOpenRespondModal(req.id)}
                        disabled={isActing}
                        style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <MessageSquare size={14} />
                        Respond
                      </button>
                    )}

                    {req.status !== 'RESOLVED' && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleResolve(req.id)}
                        disabled={isActing}
                        style={{ fontSize: 12, padding: '6px 12px', color: '#34D399', borderColor: '#059669' }}
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
                            fontSize: 12,
                            padding: '6px 10px',
                            background: ev.event_type === 'RESPONDED' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255,255,255,0.03)',
                            borderRadius: 4,
                            borderLeft: `3px solid ${ev.event_type === 'RESOLVED' ? '#10B981' : ev.event_type === 'RESPONDED' ? '#3B82F6' : '#EAB308'}`,
                          }}
                        >
                          <span style={{ color: '#9CA3AF', minWidth: 65 }}>
                            {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span style={{ fontWeight: 600, color: '#D1D5DB' }}>
                            [{ev.event_type}] ({ev.actor_id}):
                          </span>
                          <span style={{ color: '#F9FAFB' }}>{ev.message || `Status updated to ${ev.event_type}`}</span>
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

      {/* Response Modal */}
      {respondingRequestId && (
        <div className="modal-backdrop" onClick={() => setRespondingRequestId(null)} role="dialog" aria-modal="true">
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 18, color: '#F3F4F6' }}>
                Respond to Request {respondingRequestId}
              </h3>
              <button className="icon-button" onClick={() => setRespondingRequestId(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitResponse}>
              <div className="modal-body" style={{ padding: '16px 0' }}>
                <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#9CA3AF' }}>
                  Provide an operational update or dispatch note to the operator. (e.g. <em>"Truck expected in 8 minutes."</em>)
                </p>
                <textarea
                  rows={3}
                  placeholder="Enter response message..."
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#1F2937', border: '1px solid #374151', borderRadius: 6, color: '#F9FAFB', resize: 'vertical' }}
                  required
                />
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRespondingRequestId(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Send size={16} />
                  Send Response
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
