import React from 'react';
import type { DashboardResponse, Incident } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import {
  Gauge,
  Fuel,
  Repeat,
  Clock,
  ShieldAlert,
  HelpCircle,
  HardHat,
  Truck,
  CheckCircle2,
  Calendar,
  ArrowRight,
  PauseCircle,
  PlusCircle,
  TrendingUp,
} from 'lucide-react';

interface DashboardPageProps {
  dashboard: DashboardResponse;
  activeIncidents?: Incident[];
  onNavigateToAlerts?: () => void;
  onNavigateToTasks?: () => void;
  onNavigateToSupervisor?: () => void;
  onRequestSupport?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  dashboard,
  activeIncidents = [],
  onNavigateToAlerts,
  onNavigateToTasks,
  onNavigateToSupervisor,
  onRequestSupport,
}) => {
  const { operator, machine, current_task, telemetry, active_alert_count, open_request_count } = dashboard;

  const seatbeltFastened = telemetry.seatbelt_status.toLowerCase() === 'fastened';
  const isTaskPaused = current_task?.status.toUpperCase() === 'PAUSED';

  const formatReason = (reason?: string) => {
    if (!reason) return null;
    return reason.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getPredictionVariance = () => {
    if (
      !current_task ||
      current_task.predicted_minutes === null ||
      current_task.predicted_minutes === undefined
    ) {
      return null;
    }
    const diff = roundOneDecimal(current_task.predicted_minutes - current_task.planned_minutes);
    return diff;
  };

  const roundOneDecimal = (val: number) => Math.round(val * 10) / 10;

  const variance = getPredictionVariance();

  return (
    <div className="dashboard-container">
      <div className="dashboard-grid">
        {/* 1. OPERATOR / MACHINE SUMMARY (Span 12) */}
        <div className="col-12">
          <div className="industrial-card">
            <div className="card-header">
              <span className="card-title">
                <Truck size={18} />
                <span>1. Operator & Machine Summary</span>
              </span>
              <StatusBadge status={machine.status} type="machine" />
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--cat-yellow)',
                  }}>
                    <HardHat size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                      Assigned Operator
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                      {operator.id} {operator.name ? `(${operator.name})` : ''}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--cat-yellow)',
                  }}>
                    <Truck size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                      Equipment Unit
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                      {machine.id} · Cat 336
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--cat-yellow)',
                  }}>
                    <Gauge size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                      Total Machine Hours
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                      {machine.engine_hours} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>hrs</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--cat-yellow)',
                  }}>
                    <Calendar size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                      Shift Schedule
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                      Day Shift · Active
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. CURRENT TASK & PREDICTION (Span 8) */}
        <div className="col-8">
          <div className="industrial-card" style={{ height: '100%' }}>
            <div className="card-header">
              <span className="card-title">
                <CheckCircle2 size={18} />
                <span>2. Current Task & AI Duration Prediction</span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {current_task && <StatusBadge status={current_task.status} type="task" />}
                {onNavigateToTasks && (
                  <button
                    className="banner-action-btn"
                    onClick={onNavigateToTasks}
                    title="Manage task in Tasks view"
                  >
                    <span>Manage</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="card-body">
              {current_task ? (
                <div className={`current-task-box ${isTaskPaused ? 'paused-border' : ''}`}>
                  <div className="task-title-row">
                    <div>
                      <div className="task-main-name">{current_task.task_type}</div>
                      <span className="task-id-badge">TASK ID: {current_task.task_id}</span>
                    </div>
                    {current_task.prediction_status && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '4px',
                          background:
                            current_task.prediction_status === 'AT_RISK' || current_task.prediction_status === 'DELAYED'
                              ? 'rgba(239, 68, 68, 0.2)'
                              : current_task.prediction_status === 'ON_TRACK'
                              ? 'rgba(16, 185, 129, 0.2)'
                              : 'rgba(100, 116, 139, 0.2)',
                          color:
                            current_task.prediction_status === 'AT_RISK' || current_task.prediction_status === 'DELAYED'
                              ? '#F87171'
                              : current_task.prediction_status === 'ON_TRACK'
                              ? '#34D399'
                              : '#94A3B8',
                          border: `1px solid ${
                            current_task.prediction_status === 'AT_RISK' || current_task.prediction_status === 'DELAYED'
                              ? '#EF4444'
                              : current_task.prediction_status === 'ON_TRACK'
                              ? '#10B981'
                              : '#64748B'
                          }`,
                        }}
                      >
                        {current_task.prediction_status.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  {/* Paused Reason display if PAUSED */}
                  {isTaskPaused && (
                    <div className="pause-reason-callout" style={{ marginTop: '0.75rem' }}>
                      <PauseCircle size={16} color="var(--cat-yellow)" />
                      <div>
                        <strong>PAUSED:</strong>{' '}
                        <span>{formatReason(current_task.pause_reason) || 'Operational halt'}</span>
                        {current_task.pause_note && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                            "{current_task.pause_note}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Stats Grid including Phase 3 Prediction Metrics */}
                  <div className="task-stats-row">
                    <div className="task-stat-col">
                      <span className="stat-lbl">Planned Duration</span>
                      <span className="stat-val">{current_task.planned_minutes} min</span>
                    </div>

                    <div className="task-stat-col">
                      <span className="stat-lbl">Predicted Duration</span>
                      <span className="stat-val" style={{ color: 'var(--cat-yellow)' }}>
                        {current_task.predicted_minutes !== null && current_task.predicted_minutes !== undefined
                          ? `${current_task.predicted_minutes} min`
                          : 'Prediction unavailable'}
                      </span>
                    </div>

                    {variance !== null && (
                      <div className="task-stat-col">
                        <span className="stat-lbl">Variance</span>
                        <span
                          className="stat-val"
                          style={{
                            color: variance > 0 ? '#F87171' : '#34D399',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <TrendingUp size={14} />
                          {variance > 0 ? `+${variance}` : variance} min
                        </span>
                      </div>
                    )}

                    {current_task.progress !== undefined && (
                      <div className="task-stat-col">
                        <span className="stat-lbl">Estimated Progress</span>
                        <span className="stat-val">{current_task.progress}%</span>
                      </div>
                    )}
                  </div>

                  {current_task.progress !== undefined && (
                    <div className="progress-track" title={`Progress: ${current_task.progress}%`}>
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${Math.min(100, Math.max(0, current_task.progress))}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No active task assigned.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* METRICS TILES: 4. Active Alerts & 5. Open Requests (Span 4) */}
        <div className="col-4" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* 4. Active Alerts Count */}
          <div
            className={`metric-tile alert-tile ${onNavigateToAlerts ? 'clickable-tile' : ''}`}
            onClick={onNavigateToAlerts}
            role={onNavigateToAlerts ? 'button' : undefined}
            tabIndex={onNavigateToAlerts ? 0 : undefined}
            title={onNavigateToAlerts ? 'Click to view Safety Alerts' : undefined}
          >
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                4. Active Alerts
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {active_alert_count > 0 ? 'Requires operator review' : 'No active alerts'}
              </div>

              {activeIncidents.length > 0 && (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {activeIncidents.slice(0, 2).map((inc) => (
                    <div key={inc.id} style={{ fontSize: '0.78rem', color: 'var(--status-danger-text)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--status-danger-border)', display: 'inline-block' }} />
                      <span style={{ fontWeight: 600 }}>{inc.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={28} color={active_alert_count > 0 ? '#EF4444' : '#64748B'} />
                <div className="metric-number alert">{active_alert_count}</div>
              </div>
              {onNavigateToAlerts && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <span>View</span>
                  <ArrowRight size={12} />
                </span>
              )}
            </div>
          </div>

          {/* 5. Open Requests Count + Request Support Trigger */}
          <div
            className={`metric-tile request-tile ${onNavigateToSupervisor ? 'clickable-tile' : ''}`}
            onClick={onNavigateToSupervisor}
            style={{ cursor: 'pointer' }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                5. Open Requests
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Supervisor & dispatch tickets
              </div>
              {onRequestSupport && (
                <button
                  className="btn btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestSupport();
                  }}
                  style={{
                    marginTop: '0.75rem',
                    fontSize: '0.75rem',
                    padding: '4px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                    borderColor: 'var(--cat-yellow)',
                    color: 'var(--cat-yellow)',
                  }}
                >
                  <PlusCircle size={13} />
                  <span>Request Support</span>
                </button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <HelpCircle size={28} color="var(--cat-yellow)" />
              <div className="metric-number request">{open_request_count}</div>
            </div>
          </div>
        </div>

        {/* 3. MACHINE SNAPSHOT (Span 12) */}
        <div className="col-12">
          <div className="industrial-card">
            <div className="card-header">
              <span className="card-title">
                <Gauge size={18} />
                <span>3. Machine Telemetry Snapshot</span>
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                CAN-BUS TELEMETRY
              </span>
            </div>
            <div className="card-body">
              <div className="telemetry-grid">
                <div className="telemetry-item">
                  <span className="telemetry-label">
                    <Clock size={14} /> Engine Hours
                  </span>
                  <div>
                    <span className="telemetry-val">{telemetry.engine_hours}</span>
                    <span className="telemetry-unit">hrs</span>
                  </div>
                </div>

                <div className="telemetry-item">
                  <span className="telemetry-label">
                    <Fuel size={14} /> Fuel Used
                  </span>
                  <div>
                    <span className="telemetry-val">{telemetry.fuel_used}</span>
                    <span className="telemetry-unit">L</span>
                  </div>
                </div>

                <div className="telemetry-item">
                  <span className="telemetry-label">
                    <Repeat size={14} /> Load Cycles
                  </span>
                  <div>
                    <span className="telemetry-val">{telemetry.load_cycles}</span>
                    <span className="telemetry-unit">cycles</span>
                  </div>
                </div>

                <div className="telemetry-item">
                  <span className="telemetry-label">
                    <Clock size={14} /> Idle Time
                  </span>
                  <div>
                    <span className="telemetry-val">{telemetry.idle_minutes}</span>
                    <span className="telemetry-unit">min</span>
                  </div>
                </div>

                <div className="telemetry-item" style={{
                  borderLeft: `4px solid ${seatbeltFastened ? 'var(--status-operational-border)' : 'var(--status-danger-border)'}`
                }}>
                  <span className="telemetry-label">
                    Seatbelt Status
                  </span>
                  <div style={{ marginTop: '0.2rem' }}>
                    <StatusBadge status={telemetry.seatbelt_status} type="seatbelt" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
