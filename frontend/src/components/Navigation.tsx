import React from 'react';
import { LayoutDashboard, CheckSquare, ShieldAlert, Activity, Bot, Users, GraduationCap, ArrowRightLeft } from 'lucide-react';

export type NavTabId = 'dashboard' | 'tasks' | 'alerts' | 'telemetry' | 'supervisor';

interface NavigationProps {
  currentTab: NavTabId;
  onTabChange: (tab: NavTabId) => void;
  activeAlertCount?: number;
  openRequestCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  activeAlertCount = 0,
  openRequestCount = 0,
}) => {
  return (
    <nav className="industrial-nav" aria-label="Main Navigation">
      {/* 1. Dashboard */}
      <button
        id="nav-dashboard"
        className={`nav-tab ${currentTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => onTabChange('dashboard')}
      >
        <LayoutDashboard size={18} />
        <span>Dashboard</span>
      </button>

      {/* 2. Tasks */}
      <button
        id="nav-tasks"
        className={`nav-tab ${currentTab === 'tasks' ? 'active' : ''}`}
        onClick={() => onTabChange('tasks')}
      >
        <CheckSquare size={18} />
        <span>Tasks</span>
      </button>

      {/* 3. Safety Alerts */}
      <button
        id="nav-alerts"
        className={`nav-tab ${currentTab === 'alerts' ? 'active' : ''}`}
        onClick={() => onTabChange('alerts')}
      >
        <ShieldAlert size={18} color={activeAlertCount > 0 ? '#EF4444' : undefined} />
        <span>Safety Alerts</span>
        {activeAlertCount > 0 && (
          <span className="nav-alert-counter">{activeAlertCount}</span>
        )}
      </button>

      {/* 4. Activated in Phase 3: Telemetry & Insights */}
      <button
        id="nav-telemetry"
        className={`nav-tab ${currentTab === 'telemetry' ? 'active' : ''}`}
        onClick={() => onTabChange('telemetry')}
      >
        <Activity size={18} color={currentTab === 'telemetry' ? '#EAB308' : undefined} />
        <span>Telemetry & Insights</span>
      </button>

      {/* 5. Activated in Phase 3: Supervisor Hub */}
      <button
        id="nav-supervisor"
        className={`nav-tab ${currentTab === 'supervisor' ? 'active' : ''}`}
        onClick={() => onTabChange('supervisor')}
      >
        <Users size={18} color={currentTab === 'supervisor' ? '#EAB308' : undefined} />
        <span>Supervisor</span>
        {openRequestCount > 0 && (
          <span className="nav-alert-counter" style={{ background: '#3B82F6' }}>
            {openRequestCount}
          </span>
        )}
      </button>

      {/* Placeholders for Future Phases (Disabled) */}
      <button className="nav-tab" disabled title="Planned for future phase">
        <Bot size={18} />
        <span>AI Assistant</span>
        <span className="badge-tag">Phase 4</span>
      </button>

      <button className="nav-tab" disabled title="Planned for future phase">
        <GraduationCap size={18} />
        <span>Training</span>
        <span className="badge-tag">Phase 4</span>
      </button>

      <button className="nav-tab" disabled title="Planned for future phase">
        <ArrowRightLeft size={18} />
        <span>Handover</span>
        <span className="badge-tag">Phase 4</span>
      </button>
    </nav>
  );
};
