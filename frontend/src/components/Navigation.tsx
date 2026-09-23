import React from 'react';
import { LayoutDashboard, CheckSquare, ShieldAlert, Activity, Bot, Users, GraduationCap, ArrowRightLeft } from 'lucide-react';

export type NavTabId =
  | 'dashboard'
  | 'tasks'
  | 'alerts'
  | 'telemetry'
  | 'supervisor'
  | 'assistant'
  | 'training'
  | 'handover';

interface NavigationProps {
  currentTab: NavTabId;
  onTabChange: (tab: NavTabId) => void;
  activeAlertCount?: number;
  openRequestCount?: number;
  trainingRecCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  activeAlertCount = 0,
  openRequestCount = 0,
  trainingRecCount = 0,
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

      {/* 6. Activated in Phase 4: Grounded AI Assistant */}
      <button
        id="nav-assistant"
        className={`nav-tab ${currentTab === 'assistant' ? 'active' : ''}`}
        onClick={() => onTabChange('assistant')}
      >
        <Bot size={18} color={currentTab === 'assistant' ? '#EAB308' : undefined} />
        <span>AI Assistant</span>
      </button>

      {/* 7. Activated in Phase 4: Contextual Training Hub */}
      <button
        id="nav-training"
        className={`nav-tab ${currentTab === 'training' ? 'active' : ''}`}
        onClick={() => onTabChange('training')}
      >
        <GraduationCap size={18} color={currentTab === 'training' ? '#EAB308' : undefined} />
        <span>Training</span>
        {trainingRecCount > 0 && (
          <span className="nav-alert-counter" style={{ background: 'var(--cat-yellow)', color: '#0D0F12' }}>
            {trainingRecCount}
          </span>
        )}
      </button>

      {/* 8. Activated in Phase 4: Automatic Shift Handover */}
      <button
        id="nav-handover"
        className={`nav-tab ${currentTab === 'handover' ? 'active' : ''}`}
        onClick={() => onTabChange('handover')}
      >
        <ArrowRightLeft size={18} color={currentTab === 'handover' ? '#EAB308' : undefined} />
        <span>Handover</span>
      </button>
    </nav>
  );
};
