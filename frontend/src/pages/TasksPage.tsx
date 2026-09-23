import React from 'react';
import type { Task } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Clock, Info, CheckSquare } from 'lucide-react';

interface TasksPageProps {
  tasks: Task[];
}

export const TasksPage: React.FC<TasksPageProps> = ({ tasks }) => {
  return (
    <div className="tasks-container">
      {/* Notice Banner explaining Phase 1 Display Mode */}
      <div className="phase-notice">
        <Info size={18} color="var(--cat-yellow)" />
        <span>
          <strong>Phase 1 Display Mode:</strong> Task management view. Operational controls (Start, Pause, Resume, Complete) will be activated in Phase 2.
        </span>
      </div>

      {/* Task Cards List */}
      <div className="industrial-card">
        <div className="card-header">
          <span className="card-title">
            <CheckSquare size={18} />
            <span>Shift Task Schedule ({tasks.length} Tasks)</span>
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            DISPLAY ONLY · PHASE 1
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
                  <th>Planned Time</th>
                  <th>Predicted Time</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.task_id}>
                    <td>
                      <span className="task-id-badge">{task.task_id}</span>
                    </td>
                    <td>
                      <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                        {task.task_type}
                      </strong>
                    </td>
                    <td>
                      <StatusBadge status={task.status} type="task" />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono)' }}>
                        <Clock size={14} color="var(--text-muted)" />
                        <span>{task.planned_minutes} min</span>
                      </div>
                    </td>
                    <td>
                      {task.predicted_minutes !== undefined ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono)', color: 'var(--cat-yellow)' }}>
                          <Clock size={14} />
                          <span>{task.predicted_minutes} min</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {task.progress !== undefined ? (
                        <div style={{ minWidth: '110px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                            <span>Progress</span>
                            <span>{task.progress}%</span>
                          </div>
                          <div className="progress-track" style={{ marginTop: 0 }}>
                            <div className="progress-bar-fill" style={{ width: `${task.progress}%` }} />
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Touch-Friendly Detailed Task Cards (Optimized for Cab Tablets) */}
      <div style={{ marginTop: '0.5rem' }}>
        <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
          Card Detail View
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {tasks.map((task) => (
            <div
              key={`card-${task.task_id}`}
              className={`task-card-item ${task.status.toLowerCase() === 'in_progress' ? 'in_progress' : ''}`}
            >
              <div className="task-meta-group">
                <span className="task-id-badge">{task.task_id}</span>
                <div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{task.task_type}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Machine: EXC001 · Operator: OP1001
                  </div>
                </div>
                <StatusBadge status={task.status} type="task" />
              </div>

              <div className="task-times-group">
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                    Planned Duration
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                    {task.planned_minutes} min
                  </div>
                </div>

                {task.predicted_minutes !== undefined && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--cat-yellow)', fontWeight: 700 }}>
                      Predicted
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--cat-yellow)' }}>
                      {task.predicted_minutes} min
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
