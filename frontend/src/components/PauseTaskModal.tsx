import React, { useState } from 'react';
import type { PauseReason, Task } from '../types';
import { PauseCircle, X, AlertCircle } from 'lucide-react';

interface PauseTaskModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: PauseReason, note: string) => Promise<void>;
}

const PAUSE_REASONS: Array<{ value: PauseReason; label: string; description: string }> = [
  {
    value: 'WAITING_FOR_TRUCK',
    label: 'Waiting for Haul Truck',
    description: 'Material ready but transport haul truck not in position.',
  },
  {
    value: 'WEATHER',
    label: 'Inclement Weather',
    description: 'Heavy rain, lightning, or severe ground conditions.',
  },
  {
    value: 'EQUIPMENT_ISSUE',
    label: 'Equipment Issue',
    description: 'Mechanical, hydraulic, or sensor malfunction.',
  },
  {
    value: 'BREAK',
    label: 'Operator Scheduled Break',
    description: 'Lunch, shift transition, or mandatory safety rest.',
  },
  {
    value: 'MATERIAL_UNAVAILABLE',
    label: 'Material Unavailable',
    description: 'Waiting on aggregate, fuel delivery, or site supplies.',
  },
  {
    value: 'OTHER',
    label: 'Other Reason',
    description: 'Custom reason requiring site supervisor note.',
  },
];

export const PauseTaskModal: React.FC<PauseTaskModalProps> = ({
  task,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [selectedReason, setSelectedReason] = useState<PauseReason>('WAITING_FOR_TRUCK');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(selectedReason, note.trim());
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to pause task. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pause-modal-title">
      <div className="industrial-modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <PauseCircle size={22} color="var(--cat-yellow)" />
            <h2 id="pause-modal-title" className="modal-title">
              Pause Task: {task.task_id}
            </h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Select the operational reason for halting <strong>{task.task_type}</strong>:
            </div>

            {error && (
              <div className="modal-error-banner">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="reasons-grid">
              {PAUSE_REASONS.map((r) => {
                const isSelected = selectedReason === r.value;
                return (
                  <label
                    key={r.value}
                    className={`reason-option-card ${isSelected ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="pause_reason"
                      value={r.value}
                      checked={isSelected}
                      onChange={() => setSelectedReason(r.value)}
                      disabled={submitting}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <div className="reason-label">{r.label}</div>
                      <div className="reason-desc">{r.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Note field - emphasized if OTHER, but optional for any */}
            <div style={{ marginTop: '1.25rem' }}>
              <label
                htmlFor="pause-note"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: selectedReason === 'OTHER' ? 'var(--cat-yellow)' : 'var(--text-secondary)',
                  marginBottom: '0.4rem',
                }}
              >
                {selectedReason === 'OTHER' ? 'Note (Required for Other)' : 'Optional Operational Note'}
              </label>
              <textarea
                id="pause-note"
                rows={3}
                className="industrial-input"
                placeholder={
                  selectedReason === 'OTHER'
                    ? 'Explain the specific condition causing this pause...'
                    : 'Add any relevant context for the shift log (optional)...'
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="action-btn cancel-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="action-btn confirm-btn"
              disabled={submitting || (selectedReason === 'OTHER' && !note.trim())}
            >
              {submitting ? 'Pausing Task...' : 'Confirm Pause'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
