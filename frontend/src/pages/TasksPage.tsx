import React, { useState } from 'react';
import type { Task, PauseReason } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { PauseTaskModal } from '../components/PauseTaskModal';
import {
  CheckSquare,
  Play,
  Pause,
  Check,
  RotateCcw,
  AlertCircle,
  RefreshCw,
  PauseCircle,
  HelpCircle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  CloudSun,
  Award,
  Calendar,
  Cpu,
} from 'lucide-react';

interface TasksPageProps {
  tasks: Task[];
  onStartTask: (taskId: string) => Promise<void>;
  onPauseTask: (taskId: string, reason: PauseReason, note: string) => Promise<void>;
  onResumeTask: (taskId: string) => Promise<void>;
  onCompleteTask: (taskId: string) => Promise<void>;
  onRefresh: () => void;
  isRefreshing: boolean;
  onRequestSupport?: (taskId?: string) => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({
  tasks,
  onStartTask,
  onPauseTask,
  onResumeTask,
  onCompleteTask,
  onRefresh,
  isRefreshing,
  onRequestSupport,
}) => {
  const [pausingTask, setPausingTask] = useState<Task | null>(null);
  const [activeActionTaskId, setActiveActionTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ taskId: string; message: string } | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const roundOneDecimal = (val: number) => Math.round(val * 10) / 10;

  const formatReason = (reason?: string) => {
    if (!reason) return null;
    return reason.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getRiskBadgeStyle = (status?: string) => {
    switch (status) {
      case 'ON_TRACK':
        return {
          bg: 'rgba(16, 185, 129, 0.15)',
          color: '#34D399',
          border: '1px solid #10B981',
        };
      case 'AT_RISK':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          color: '#FBBF24',
          border: '1px solid #F59E0B',
        };
      case 'DELAYED':
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          color: '#F87171',
          border: '1px solid #EF4444',
        };
      default:
        return {
          bg: 'rgba(100, 116, 139, 0.15)',
          color: '#94A3B8',
          border: '1px solid #64748B',
        };
    }
  };

  const toggleExpand = (taskId: string) => {
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
  };

  const handleStart = async (taskId: string) => {
    setActionError(null);
    setActiveActionTaskId(taskId);
    try {
      await onStartTask(taskId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start task.';
      setActionError({ taskId, message: msg });
    } finally {
      setActiveActionTaskId(null);
    }
  };

  const handleResume = async (taskId: string) => {
    setActionError(null);
    setActiveActionTaskId(taskId);
    try {
      await onResumeTask(taskId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to resume task.';
      setActionError({ taskId, message: msg });
    } finally {
      setActiveActionTaskId(null);
    }
  };

  const handleComplete = async (taskId: string) => {
    setActionError(null);
    setActiveActionTaskId(taskId);
    try {
      await onCompleteTask(taskId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to complete task.';
      setActionError({ taskId, message: msg });
    } finally {
      setActiveActionTaskId(null);
    }
  };

  const handleConfirmPause = async (reason: PauseReason, note: string) => {
    if (!pausingTask) return;
    setActionError(null);
    setActiveActionTaskId(pausingTask.task_id);
    try {
      await onPauseTask(pausingTask.task_id, reason, note);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to pause task.';
      setActionError({ taskId: pausingTask.task_id, message: msg });
      throw err;
    } finally {
      setActiveActionTaskId(null);
    }
  };

  return (
    <div className="tasks-container">
      {/* Top Header bar with Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Shift Task Management
          </h1>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Execute, pause, and log task progress with AI duration forecasting
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onRequestSupport && (
            <button
              className="btn btn-secondary"
              onClick={() => onRequestSupport()}
              style={{
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                borderColor: 'var(--cat-yellow)',
                color: 'var(--cat-yellow)',
              }}
            >
              <HelpCircle size={15} />
              <span>Request Support</span>
            </button>
          )}
          <button
            className="banner-action-btn"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh task list"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Sync Tasks</span>
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {actionError && (
        <div className="modal-error-banner" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={18} />
          <span>Task {actionError.taskId}: {actionError.message}</span>
        </div>
      )}

      {/* Detailed Tasks Card List with Live Actions & ML Predictions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {tasks.map((task) => {
          const status = task.status.toUpperCase();
          const isMutating = activeActionTaskId === task.task_id;
          const isPending = status === 'PENDING';
          const isInProgress = status === 'IN_PROGRESS';
          const isPaused = status === 'PAUSED';
          const isCompleted = status === 'COMPLETED';

          const hasPrediction = task.predicted_minutes !== undefined && task.predicted_minutes !== null;
          const variance = hasPrediction
            ? roundOneDecimal(task.predicted_minutes! - task.planned_minutes)
            : null;
          const riskStyle = getRiskBadgeStyle(task.prediction_status);
          const isExpanded = expandedTaskId === task.task_id;

          return (
            <div
              key={task.task_id}
              className={`task-workflow-card ${status.toLowerCase()}`}
            >
              <div className="task-workflow-main">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span className="task-id-badge">{task.task_id}</span>
                    <h3 className="task-workflow-title">{task.task_type}</h3>
                    <StatusBadge status={task.status} type="task" />
                  </div>

                  {task.prediction_status && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: '4px',
                        background: riskStyle.bg,
                        color: riskStyle.color,
                        border: riskStyle.border,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <TrendingUp size={12} />
                      {task.prediction_status.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>

                {/* Paused Reason Callout */}
                {isPaused && (
                  <div className="pause-reason-callout">
                    <PauseCircle size={16} color="var(--cat-yellow)" />
                    <div>
                      <strong>Paused:</strong>{' '}
                      <span>{formatReason(task.pause_reason) || 'Operational halt'}</span>
                      {task.pause_note && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                          Note: "{task.pause_note}"
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Times, Prediction & Progress Row */}
                <div className="task-stats-row" style={{ marginTop: '0.75rem' }}>
                  <div className="task-stat-col">
                    <span className="stat-lbl">Planned Time</span>
                    <span className="stat-val">{task.planned_minutes} min</span>
                  </div>

                  <div className="task-stat-col">
                    <span className="stat-lbl">Predicted Time</span>
                    <span className="stat-val" style={{ color: hasPrediction ? 'var(--cat-yellow)' : 'var(--text-muted)' }}>
                      {hasPrediction ? `${task.predicted_minutes} min` : 'N/A'}
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
                        {variance > 0 ? `+${variance}` : variance} min
                      </span>
                    </div>
                  )}

                  {task.progress !== undefined && (
                    <div className="task-stat-col" style={{ minWidth: '130px' }}>
                      <span className="stat-lbl">Progress ({task.progress}%)</span>
                      <div className="progress-track">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Expandable Model Factors Toggle */}
                <div style={{ marginTop: '0.75rem' }}>
                  <button
                    onClick={() => toggleExpand(task.task_id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <span>Model & Environmental Factors</span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {isExpanded && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem',
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: '6px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: '0.75rem',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CloudSun size={12} /> Weather
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {task.weather || 'Sunny'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Award size={12} /> Operator Skill
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {task.operator_skill || 'Intermediate'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} /> Machine Age
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {task.machine_age !== undefined ? `${task.machine_age} yrs` : '2 yrs'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Cpu size={12} /> Prediction Basis
                        </div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--cat-yellow)', marginTop: '2px' }}>
                          {task.prediction_basis || 'RandomForest Regressor'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons Container */}
              <div className="task-action-controls">
                {onRequestSupport && (
                  <button
                    className="action-btn"
                    onClick={() => onRequestSupport(task.task_id)}
                    title="Request supervisor or maintenance assistance for this task"
                    style={{
                      background: 'rgba(234, 179, 8, 0.1)',
                      borderColor: 'rgba(234, 179, 8, 0.4)',
                      color: 'var(--cat-yellow)',
                      padding: '6px 10px',
                      fontSize: '0.8rem',
                    }}
                  >
                    <HelpCircle size={15} />
                    <span>Support</span>
                  </button>
                )}

                {isPending && (
                  <button
                    className="action-btn start-btn"
                    onClick={() => handleStart(task.task_id)}
                    disabled={isMutating}
                  >
                    <Play size={16} />
                    <span>{isMutating ? 'Starting...' : 'START'}</span>
                  </button>
                )}

                {isInProgress && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      className="action-btn pause-btn"
                      onClick={() => setPausingTask(task)}
                      disabled={isMutating}
                    >
                      <Pause size={16} />
                      <span>PAUSE</span>
                    </button>
                    <button
                      className="action-btn complete-btn"
                      onClick={() => handleComplete(task.task_id)}
                      disabled={isMutating}
                    >
                      <Check size={16} />
                      <span>{isMutating ? 'Completing...' : 'COMPLETE'}</span>
                    </button>
                  </div>
                )}

                {isPaused && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      className="action-btn resume-btn"
                      onClick={() => handleResume(task.task_id)}
                      disabled={isMutating}
                    >
                      <RotateCcw size={16} />
                      <span>{isMutating ? 'Resuming...' : 'RESUME'}</span>
                    </button>
                    <button
                      className="action-btn complete-btn"
                      onClick={() => handleComplete(task.task_id)}
                      disabled={isMutating}
                    >
                      <Check size={16} />
                      <span>{isMutating ? 'Completing...' : 'COMPLETE'}</span>
                    </button>
                  </div>
                )}

                {isCompleted && (
                  <div className="task-completed-pill">
                    <Check size={14} color="var(--status-operational-text)" />
                    <span>Completed</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Structured Summary Table */}
      <div className="industrial-card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">
            <CheckSquare size={18} />
            <span>Shift Task Schedule Overview</span>
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            CAN-BUS SYNCHRONIZED
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="industrial-table">
              <thead>
                <tr>
                  <th>Task ID</th>
                  <th>Task Type</th>
                  <th>Status</th>
                  <th>Pause Reason</th>
                  <th>Planned</th>
                  <th>Predicted</th>
                  <th>Variance</th>
                  <th>Delay Risk</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const hasPrediction = task.predicted_minutes !== undefined && task.predicted_minutes !== null;
                  const variance = hasPrediction
                    ? roundOneDecimal(task.predicted_minutes! - task.planned_minutes)
                    : null;
                  const riskStyle = getRiskBadgeStyle(task.prediction_status);

                  return (
                    <tr key={`tbl-${task.task_id}`}>
                      <td><span className="task-id-badge">{task.task_id}</span></td>
                      <td><strong>{task.task_type}</strong></td>
                      <td><StatusBadge status={task.status} type="task" /></td>
                      <td>
                        {task.status.toUpperCase() === 'PAUSED' ? (
                          <span style={{ color: 'var(--cat-yellow)', fontSize: '0.85rem' }}>
                            {formatReason(task.pause_reason) || 'Paused'}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>{task.planned_minutes} min</td>
                      <td>{hasPrediction ? `${task.predicted_minutes} min` : '—'}</td>
                      <td>
                        {variance !== null ? (
                          <span style={{ color: variance > 0 ? '#F87171' : '#34D399', fontWeight: 600 }}>
                            {variance > 0 ? `+${variance}` : variance} min
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {task.prediction_status ? (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: riskStyle.bg,
                              color: riskStyle.color,
                              border: riskStyle.border,
                            }}
                          >
                            {task.prediction_status.replace(/_/g, ' ')}
                          </span>
                        ) : '—'}
                      </td>
                      <td>{task.progress !== undefined ? `${task.progress}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pause Task Modal */}
      {pausingTask && (
        <PauseTaskModal
          task={pausingTask}
          isOpen={true}
          onClose={() => setPausingTask(null)}
          onConfirm={handleConfirmPause}
        />
      )}
    </div>
  );
};
