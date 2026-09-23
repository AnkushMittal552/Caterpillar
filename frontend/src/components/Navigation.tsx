import React from 'react';
import { LayoutDashboard, CheckSquare, AlertTriangle, Activity, Bot, Users, GraduationCap, ArrowRightLeft } from 'lucide-react';

export type NavTabId = 'dashboard' | 'tasks';

interface NavigationProps {
  currentTab: NavTabId;
  onTabChange: (tab: NavTabId) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onTabChange }) => {
  return (
    <nav className="industrial-nav" aria-label="Main Navigation">
      {/* Active Phase 1 Tabs */}
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

      {/* Placeholders for Future Phases (Disabled) */}
      <button className="nav-tab" disabled title="Planned for future phase">
        <AlertTriangle size={18} />
        <span>Safety Alerts</span>
        <span className="badge-tag">Phase 2</span>
      </button>

      <button className="nav-tab" disabled title="Planned for future phase">
        <Activity size={18} />
        <span>Telemetry</span>
        <span className="badge-tag">Phase 2</span>
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
