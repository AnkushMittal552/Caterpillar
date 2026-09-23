import React from 'react';
import type { DashboardResponse } from '../types';
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
} from 'lucide-react';

interface DashboardPageProps {
  dashboard: DashboardResponse;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ dashboard }) => {
  const { operator, machine, current_task, telemetry, active_alert_count, open_request_count } = dashboard;

  const seatbeltFastened = telemetry.seatbelt_status.toLowerCase() === 'fastened';

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

        {/* 2. CURRENT TASK (Span 8) */}
        <div className="col-8">
          <div className="industrial-card" style={{ height: '100%' }}>
            <div className="card-header">
              <span className="card-title">
                <CheckCircle2 size={18} />
                <span>2. Current Task</span>
              </span>
              {current_task && <StatusBadge status={current_task.status} type="task" />}
            </div>
            <div className="card-body">
              {current_task ? (
                <div className="current-task-box">
                  <div className="task-title-row">
                    <div>
                      <div className="task-main-name">{current_task.task_type}</div>
                      <span className="task-id-badge">TASK ID: {current_task.task_id}</span>
                    </div>
                    <StatusBadge status={current_task.status} type="task" />
                  </div>

                  <div className="task-stats-row">
                    <div className="task-stat-col">
                      <span className="stat-lbl">Planned Duration</span>
                      <span className="stat-val">{current_task.planned_minutes} min</span>
                    </div>

                    {current_task.predicted_minutes !== undefined && (
                      <div className="task-stat-col">
                        <span className="stat-lbl">Predicted Duration</span>
                        <span className="stat-val">{current_task.predicted_minutes} min</span>
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
          <div className="metric-tile alert-tile">
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                4. Active Alerts
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Safety & usage notifications
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <ShieldAlert size={28} color={active_alert_count > 0 ? '#EF4444' : '#64748B'} />
              <div className="metric-number alert">{active_alert_count}</div>
            </div>
          </div>

          {/* 5. Open Requests Count */}
          <div className="metric-tile request-tile">
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                5. Open Requests
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Supervisor & dispatch tickets
              </div>
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
                {/* Engine Hours */}
                <div className="telemetry-item">
                  <span className="telemetry-label">
                    <Clock size={14} /> Engine Hours
                  </span>
                  <div>
                    <span className="telemetry-val">{telemetry.engine_hours}</span>
                    <span className="telemetry-unit">hrs</span>
                  </div>
                </div>

                {/* Fuel Used */}
                <div className="telemetry-item">
                  <span className="telemetry-label">
                    <Fuel size={14} /> Fuel Used
                  </span>
                  <div>
                    <span className="telemetry-val">{telemetry.fuel_used}</span>
                    <span className="telemetry-unit">L</span>
                  </div>
                </div>

                {/* Load Cycles */}
                <div className="telemetry-item">
                  <span className="telemetry-label">
                    <Repeat size={14} /> Load Cycles
                  </span>
                  <div>
                    <span className="telemetry-val">{telemetry.load_cycles}</span>
                    <span className="telemetry-unit">cycles</span>
                  </div>
                </div>

                {/* Idle Time */}
                <div className="telemetry-item">
                  <span className="telemetry-label">
                    <Clock size={14} /> Idle Time
                  </span>
                  <div>
                    <span className="telemetry-val">{telemetry.idle_minutes}</span>
                    <span className="telemetry-unit">min</span>
                  </div>
                </div>

                {/* Seatbelt Status */}
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
