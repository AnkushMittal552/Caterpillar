import React, { useState } from 'react';
import {
  ArrowRightLeft,
  Copy,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Truck,
  HardHat,
  HelpCircle,
  GraduationCap,
  Activity,
  Check,
  PauseCircle,
  RefreshCw,
} from 'lucide-react';
import { useHandover } from '../api/useApi';

interface HandoverPageProps {
  machineId?: string;
  operatorId?: string;
}

export const HandoverPage: React.FC<HandoverPageProps> = ({
  machineId = 'EXC001',
  operatorId = 'OP1001',
}) => {
  const { data: handover, loading, error, refresh } = useHandover(machineId, operatorId);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopySummary = async () => {
    if (!handover?.summary_text) return;

    try {
      await navigator.clipboard.writeText(handover.summary_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for environments where navigator.clipboard might be restricted
      const textarea = document.createElement('textarea');
      textarea.value = handover.summary_text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading && !handover) {
    return (
      <div className="handover-container">
        <div className="handover-loading">
          <RefreshCw size={24} className="spin" color="var(--cat-yellow)" />
          <span>Aggregating shift operational facts and generating handover report...</span>
        </div>
      </div>
    );
  }

  if (error && !handover) {
    return (
      <div className="handover-container">
        <div className="handover-error">
          <AlertTriangle size={32} color="#EF4444" />
          <h3>Failed to Generate Handover Report</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={refresh}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!handover) return null;

  const {
    shift,
    tasks,
    delays,
    incidents,
    support_requests,
    training,
    usage_insights,
    summary_text,
  } = handover;

  return (
    <div className="handover-container">
      {/* Header bar */}
      <div className="handover-header">
        <div className="handover-title-group">
          <div className="handover-icon-box">
            <ArrowRightLeft size={24} color="var(--cat-yellow)" />
          </div>
          <div>
            <h2 className="handover-heading">Automatic Shift Handover</h2>
            <p className="handover-subheading">
              Fact-based operational summary compiled directly from machine telemetry and shift activity logs.
            </p>
          </div>
        </div>

        <div className="handover-actions">
          <button
            className="btn btn-secondary handover-action-btn"
            onClick={refresh}
            title="Refresh shift facts"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>

          <button
            className="btn btn-secondary handover-action-btn"
            onClick={handleCopySummary}
            title="Copy plain-text summary to clipboard"
          >
            {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
            <span>{copied ? 'Summary Copied!' : 'Copy Summary'}</span>
          </button>

          <button
            className="btn btn-primary handover-action-btn"
            onClick={handlePrint}
            title="Print or export PDF report"
          >
            <Printer size={14} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Grid of Shift Sections */}
      <div className="handover-grid">
        {/* 1. Shift Overview Card */}
        <div className="handover-section-card col-12">
          <div className="section-card-header">
            <div className="section-title">
              <Clock size={18} color="var(--cat-yellow)" />
              <span>1. Shift & Equipment Snapshot</span>
            </div>
            <span className="section-badge status-active">Shift ID: {shift.shift_id}</span>
          </div>

          <div className="section-card-body">
            <div className="overview-stats-grid">
              <div className="overview-stat-item">
                <span className="stat-label"><HardHat size={14} /> Outgoing Operator</span>
                <span className="stat-value">{shift.operator_id} {shift.operator_name ? `(${shift.operator_name})` : ''}</span>
              </div>

              <div className="overview-stat-item">
                <span className="stat-label"><Truck size={14} /> Machine Unit</span>
                <span className="stat-value">{shift.machine_id} · Cat 336</span>
              </div>

              <div className="overview-stat-item">
                <span className="stat-label"><Activity size={14} /> Machine Status</span>
                <span className="stat-value" style={{ color: shift.machine_status === 'OPERATIONAL' ? '#34D399' : '#FBBF24' }}>
                  {shift.machine_status}
                </span>
              </div>

              <div className="overview-stat-item">
                <span className="stat-label"><Clock size={14} /> Ending Engine Hours</span>
                <span className="stat-value">{shift.engine_hours} hrs</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Tasks Summary: Completed & Unfinished */}
        <div className="handover-section-card col-6">
          <div className="section-card-header">
            <div className="section-title">
              <CheckCircle2 size={18} color="#10B981" />
              <span>2. Completed Tasks ({tasks.completed.length})</span>
            </div>
          </div>
          <div className="section-card-body">
            {tasks.completed.length > 0 ? (
              <div className="handover-items-list">
                {tasks.completed.map((t) => (
                  <div key={t.task_id} className="handover-list-item">
                    <div>
                      <div className="item-title">{t.task_type}</div>
                      <span className="item-sub">ID: {t.task_id} · Planned: {t.planned_minutes}m</span>
                    </div>
                    <span className="badge-tag status-completed">COMPLETED</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-subtext">No tasks marked completed during this shift.</div>
            )}
          </div>
        </div>

        <div className="handover-section-card col-6">
          <div className="section-card-header">
            <div className="section-title">
              <Clock size={18} color="var(--cat-yellow)" />
              <span>3. Unfinished / Open Tasks ({tasks.unfinished.length})</span>
            </div>
          </div>
          <div className="section-card-body">
            {tasks.unfinished.length > 0 ? (
              <div className="handover-items-list">
                {tasks.unfinished.map((t) => (
                  <div key={t.task_id} className="handover-list-item">
                    <div>
                      <div className="item-title">{t.task_type}</div>
                      <span className="item-sub">ID: {t.task_id} · Status: {t.status}</span>
                      {t.pause_reason && (
                        <div className="item-note">
                          Pause reason: {t.pause_reason.replace(/_/g, ' ')}
                          {t.pause_note && ` ("${t.pause_note}")`}
                        </div>
                      )}
                    </div>
                    <span className={`badge-tag ${t.status === 'IN_PROGRESS' ? 'status-active' : t.status === 'PAUSED' ? 'status-paused' : ''}`}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-subtext">No open or unfinished tasks.</div>
            )}
          </div>
        </div>

        {/* 4. Delays & Pauses */}
        <div className="handover-section-card col-12">
          <div className="section-card-header">
            <div className="section-title">
              <PauseCircle size={18} color="#F59E0B" />
              <span>4. Operational Delays & Task Variances ({delays.length})</span>
            </div>
          </div>
          <div className="section-card-body">
            {delays.length > 0 ? (
              <div className="handover-table-wrapper">
                <table className="handover-table">
                  <thead>
                    <tr>
                      <th>Task ID</th>
                      <th>Task Type</th>
                      <th>Status</th>
                      <th>Planned Duration</th>
                      <th>Predicted Duration</th>
                      <th>Variance</th>
                      <th>Pause Reason / Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delays.map((d) => (
                      <tr key={d.task_id}>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{d.task_id}</td>
                        <td style={{ fontWeight: 600 }}>{d.task_type}</td>
                        <td>
                          <span className={`badge-tag ${d.status === 'PAUSED' ? 'status-paused' : 'status-active'}`}>
                            {d.status}
                          </span>
                        </td>
                        <td>{d.planned_minutes} min</td>
                        <td>{d.predicted_minutes !== undefined && d.predicted_minutes !== null ? `${d.predicted_minutes} min` : '—'}</td>
                        <td>
                          {d.variance_minutes !== undefined && d.variance_minutes !== null ? (
                            <span style={{ color: d.variance_minutes > 0 ? '#F87171' : '#34D399', fontWeight: 700 }}>
                              {d.variance_minutes > 0 ? `+${d.variance_minutes}` : d.variance_minutes} min
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          {d.pause_reason ? (
                            <span>
                              <strong>{d.pause_reason.replace(/_/g, ' ')}</strong>
                              {d.pause_note && ` · "${d.pause_note}"`}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-subtext">No task delays or pauses recorded this shift.</div>
            )}
          </div>
        </div>

        {/* 5. Incidents: Unresolved & Resolved */}
        <div className="handover-section-card col-6">
          <div className="section-card-header">
            <div className="section-title">
              <AlertTriangle size={18} color="#EF4444" />
              <span>5. Safety Alerts ({incidents.unresolved.length} Unresolved)</span>
            </div>
          </div>
          <div className="section-card-body">
            {incidents.unresolved.length > 0 ? (
              <div className="handover-items-list">
                {incidents.unresolved.map((inc) => (
                  <div key={inc.id} className="handover-list-item alert-item">
                    <div>
                      <div className="item-title" style={{ color: '#F87171' }}>{inc.title}</div>
                      <span className="item-sub">Severity: {inc.severity} · Status: {inc.status}</span>
                      <div className="item-desc">{inc.message}</div>
                    </div>
                    <span className="badge-tag status-danger">UNRESOLVED</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-subtext" style={{ color: '#10B981' }}>
                ✓ Zero unresolved safety incidents.
              </div>
            )}

            {incidents.resolved.length > 0 && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Resolved This Shift ({incidents.resolved.length})
                </span>
                <div className="handover-items-list" style={{ marginTop: '0.5rem' }}>
                  {incidents.resolved.map((inc) => (
                    <div key={inc.id} className="handover-list-item muted-item">
                      <div>
                        <div className="item-title">{inc.title}</div>
                        <span className="item-sub">Resolved at {new Date(inc.resolved_at || inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <span className="badge-tag status-completed">RESOLVED</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 6. Support Requests: Open & Resolved */}
        <div className="handover-section-card col-6">
          <div className="section-card-header">
            <div className="section-title">
              <HelpCircle size={18} color="var(--cat-yellow)" />
              <span>6. Supervisor Support Requests ({support_requests.open.length} Open)</span>
            </div>
          </div>
          <div className="section-card-body">
            {support_requests.open.length > 0 ? (
              <div className="handover-items-list">
                {support_requests.open.map((req) => (
                  <div key={req.id} className="handover-list-item">
                    <div>
                      <div className="item-title">{req.request_type} (ID: {req.id})</div>
                      <span className="item-desc">"{req.message}"</span>
                      {req.latest_response && (
                        <div className="item-note">Latest Supervisor Note: "{req.latest_response}"</div>
                      )}
                    </div>
                    <span className="badge-tag status-active">{req.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-subtext">No open supervisor support tickets.</div>
            )}

            {support_requests.resolved.length > 0 && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Resolved Tickets ({support_requests.resolved.length})
                </span>
                <div className="handover-items-list" style={{ marginTop: '0.5rem' }}>
                  {support_requests.resolved.map((req) => (
                    <div key={req.id} className="handover-list-item muted-item">
                      <div>
                        <div className="item-title">{req.request_type} ({req.id})</div>
                        <span className="item-sub">Resolved</span>
                      </div>
                      <span className="badge-tag status-completed">RESOLVED</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 7. Training Completed & Recommended */}
        <div className="handover-section-card col-6">
          <div className="section-card-header">
            <div className="section-title">
              <GraduationCap size={18} color="var(--cat-yellow)" />
              <span>7. Shift Training Records</span>
            </div>
          </div>
          <div className="section-card-body">
            {training.completed.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Completed Modules ({training.completed.length})
                </span>
                <div className="handover-items-list" style={{ marginTop: '0.5rem' }}>
                  {training.completed.map((tr) => (
                    <div key={tr.module_id} className="handover-list-item">
                      <div>
                        <div className="item-title">{tr.title}</div>
                        <span className="item-sub">Score: {tr.score} / {tr.total}</span>
                      </div>
                      <span className="badge-tag status-completed">PASSED</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {training.recommended.length > 0 ? (
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Recommended Pending Modules ({training.recommended.length})
                </span>
                <div className="handover-items-list" style={{ marginTop: '0.5rem' }}>
                  {training.recommended.map((rec) => (
                    <div key={rec.module.id} className="handover-list-item">
                      <div>
                        <div className="item-title">{rec.module.title}</div>
                        <span className="item-desc">{rec.reason}</span>
                      </div>
                      <span className="badge-tag status-paused">RECOMMENDED</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              training.completed.length === 0 && (
                <div className="empty-subtext">No training completions or recommendations recorded.</div>
              )
            )}
          </div>
        </div>

        {/* 8. Equipment Usage Insights */}
        <div className="handover-section-card col-6">
          <div className="section-card-header">
            <div className="section-title">
              <Activity size={18} color="var(--cat-yellow)" />
              <span>8. Equipment Observations & Machine Health</span>
            </div>
          </div>
          <div className="section-card-body">
            {usage_insights.length > 0 ? (
              <div className="handover-items-list">
                {usage_insights.map((ins, idx) => (
                  <div key={idx} className="handover-list-item">
                    <div>
                      <div className="item-title">{ins.message}</div>
                      {ins.evidence && (
                        <span className="item-sub">
                          {Object.entries(ins.evidence).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ')}
                        </span>
                      )}
                    </div>
                    <span className={`badge-tag ${ins.severity === 'WARNING' ? 'status-danger' : 'status-active'}`}>
                      {ins.severity}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-subtext">Machine telemetry nominal. No abnormal usage patterns detected.</div>
            )}
          </div>
        </div>

        {/* 9. Formatted Shift Summary Text (Ready to Copy / Print) */}
        <div className="handover-section-card col-12">
          <div className="section-card-header">
            <div className="section-title">
              <Copy size={18} color="var(--cat-yellow)" />
              <span>9. Formatted Handover Summary Text</span>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleCopySummary}
              title="Copy to clipboard"
            >
              {copied ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="section-card-body">
            <pre className="handover-summary-pre">{summary_text}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
