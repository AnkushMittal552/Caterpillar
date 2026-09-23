import React from 'react';
import { LayoutDashboard, CheckSquare, ShieldAlert, Activity, Bot, Users, GraduationCap, ArrowRightLeft } from 'lucide-react';

export type NavTabId = 'dashboard' | 'tasks' | 'alerts';

interface NavigationProps {
  currentTab: NavTabId;
  onTabChange: (tab: NavTabId) => void;
  activeAlertCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  activeAlertCount = 0,
}) => {
  return (
    <nav className="industrial-nav" aria-label="Main Navigation">
      {/* Active Tabs */}
      <button
        id="nav-dashboard"
        className={`nav-tab ${currentTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => onTabChange('dashboard')}
      >
        <LayoutDashboard size={18} />
        <span>Dashboard</span>
      </button>

      <button
        id="nav-tasks"
        className={`nav-tab ${currentTab === 'tasks' ? 'active' : ''}`}
        onClick={() => onTabChange('tasks')}
      >
        <CheckSquare size={18} />
        <span>Tasks</span>
      </button>

      {/* Activated in Phase 2: Safety Alerts */}
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

      {/* Placeholders for Future Phases (Disabled) */}
      <button className="nav-tab" disabled title="Planned for future phase">
        <Activity size={18} />
        <span>Telemetry</span>
        <span className="badge-tag">Phase 2.1</span>
      </button>

      <button className="nav-tab" disabled title="Planned for future phase">
        <Bot size={18} />
        <span>AI Assistant</span>
        <span className="badge-tag">Phase 3</span>
      </button>

      <button className="nav-tab" disabled title="Planned for future phase">
        <Users size={18} />
        <span>Supervisor</span>
        <span className="badge-tag">Phase 3</span>
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
