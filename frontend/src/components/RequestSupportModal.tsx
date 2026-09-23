import React, { useState } from 'react';
import { X, Send, AlertCircle } from 'lucide-react';
import type { SupportRequestType, Task } from '../types';

interface RequestSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: { request_type: SupportRequestType; task_id?: string; message: string }) => Promise<void>;
  tasks?: Task[];
  defaultTaskId?: string;
}

export const RequestSupportModal: React.FC<RequestSupportModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  tasks = [],
  defaultTaskId,
}) => {
  const [requestType, setRequestType] = useState<SupportRequestType>('LOGISTICS');
  const [taskId, setTaskId] = useState<string>(defaultTaskId || '');
  const [message, setMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please provide a description of the request.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        request_type: requestType,
        task_id: taskId ? taskId : undefined,
        message: message.trim(),
      });
      setMessage('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit support request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={20} color="#F59E0B" />
            <h3 style={{ margin: 0, fontSize: 18, color: '#F3F4F6' }}>Request Supervisor Assistance</h3>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 6, color: '#FCA5A5', fontSize: 13 }}>
                {error}
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>
                Request Type
              </label>
              <select
                className="select-input"
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as SupportRequestType)}
                style={{ width: '100%', padding: '10px 12px', background: '#1F2937', border: '1px solid #374151', borderRadius: 6, color: '#F9FAFB' }}
              >
                <option value="LOGISTICS">Logistics (Trucks, Transport, Haulage)</option>
                <option value="MAINTENANCE">Maintenance (Inspection, Refueling, Repairs)</option>
                <option value="MATERIAL">Material (Aggregate, Backfill, Grade Stakes)</option>
                <option value="SUPERVISOR_ASSISTANCE">Supervisor Assistance (Approval, Site Direction)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>
                Related Task (Optional)
              </label>
              <select
                className="select-input"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: '#1F2937', border: '1px solid #374151', borderRadius: 6, color: '#F9FAFB' }}
              >
                <option value="">General Machine / Site Request</option>
                {tasks.map((t) => (
                  <option key={t.task_id} value={t.task_id}>
                    {t.task_id} - {t.task_type} ({t.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>
                Message & Requirement Details
              </label>
              <textarea
                rows={3}
                placeholder="Describe what is required, location details, or issue..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: '#1F2937', border: '1px solid #374151', borderRadius: 6, color: '#F9FAFB', resize: 'vertical' }}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Send size={16} />
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
