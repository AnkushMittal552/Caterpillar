import React, { useState } from 'react';
import {
  RotateCcw,
  AlertTriangle,
  Clock,
  Truck,
  WifiOff,
  CheckCircle2,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiTriggerDemoScenario, apiResetDemo } from '../api/useApi';

interface DemoControllerProps {
  onScenarioApplied?: () => void;
}

export const DemoController: React.FC<DemoControllerProps> = ({ onScenarioApplied }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleApplyScenario = async (scenario: string, label: string) => {
    setIsLoading(scenario);
    setStatusMessage(null);
    try {
      const res = await apiTriggerDemoScenario(scenario);
      setActiveScenario(scenario);
      setStatusMessage(`${label}: ${res.message}`);
      if (onScenarioApplied) {
        onScenarioApplied();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to apply scenario.';
      setStatusMessage(`Error: ${msg}`);
    } finally {
      setIsLoading(null);
    }
  };

  const handleReset = async () => {
    setIsLoading('reset');
    setStatusMessage(null);
    try {
      const res = await apiResetDemo();
      setActiveScenario('normal');
      setStatusMessage(`Deterministic Reset Applied: ${res.message}`);
      if (onScenarioApplied) {
        onScenarioApplied();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset demo state.';
      setStatusMessage(`Error: ${msg}`);
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="demo-controller-card">
      <div className="demo-controller-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="demo-header-title">
          <Sliders size={18} className="text-cat-yellow" />
          <span className="demo-mode-tag">DEMO MODE</span>
          <span className="demo-badge">SCENARIO CONTROLLER</span>
          <span className="demo-subtitle">Reproducible live scenarios for presentation & testing</span>
        </div>
        <button type="button" className="demo-collapse-btn">
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {isOpen && (
        <div className="demo-controller-body">
          <div className="demo-actions-grid">
            {/* 1. Normal Conditions */}
            <button
              type="button"
              className={`demo-btn ${activeScenario === 'normal' ? 'active-scenario' : ''}`}
              onClick={() => handleApplyScenario('normal', 'Nominal State')}
              disabled={isLoading !== null}
              title="Fastened seatbelt, nominal idle (15m), operational telemetry"
            >
              <CheckCircle2 size={16} color="#10B981" />
              <div className="demo-btn-text">
                <strong>1. Normal Operations</strong>
                <span>Nominal telemetry, fastened seatbelt</span>
              </div>
            </button>

            {/* 2. Safety Event */}
            <button
              type="button"
              className={`demo-btn ${activeScenario === 'seatbelt_event' ? 'active-scenario' : ''}`}
              onClick={() => handleApplyScenario('seatbelt_event', 'Safety Incident')}
              disabled={isLoading !== null}
              title="Injects unfastened seatbelt while engine running -> Critical Alert"
            >
              <AlertTriangle size={16} color="#EF4444" />
              <div className="demo-btn-text">
                <strong>2. Seatbelt Event</strong>
                <span>Unfastens seatbelt while active (Critical)</span>
              </div>
            </button>

            {/* 3. High Idle */}
            <button
              type="button"
              className={`demo-btn ${activeScenario === 'high_idle' ? 'active-scenario' : ''}`}
              onClick={() => handleApplyScenario('high_idle', 'High Idle Incident')}
              disabled={isLoading !== null}
              title="Increases idle time to 65 min (>45m threshold) -> Productivity Alert"
            >
              <Clock size={16} color="#F59E0B" />
              <div className="demo-btn-text">
                <strong>3. High Idle Alert</strong>
                <span>Sets idle to 65m (exceeds threshold)</span>
              </div>
            </button>

            {/* 4. Task Delay */}
            <button
              type="button"
              className={`demo-btn ${activeScenario === 'task_delay' ? 'active-scenario' : ''}`}
              onClick={() => handleApplyScenario('task_delay', 'Task Delay')}
              disabled={isLoading !== null}
              title="Pauses current task with weather delay reason"
            >
              <Clock size={16} color="#3B82F6" />
              <div className="demo-btn-text">
                <strong>4. Task Delay</strong>
                <span>Pauses active task with weather delay</span>
              </div>
            </button>

            {/* 5. Haul Truck Request */}
            <button
              type="button"
              className={`demo-btn ${activeScenario === 'truck_request' ? 'active-scenario' : ''}`}
              onClick={() => handleApplyScenario('truck_request', 'Truck Dispatch Request')}
              disabled={isLoading !== null}
              title="Dispatches operator support ticket for haul truck coordination"
            >
              <Truck size={16} color="#8B5CF6" />
              <div className="demo-btn-text">
                <strong>5. Truck Request</strong>
                <span>Dispatches haul truck support request</span>
              </div>
            </button>

            {/* 6. Telemetry Lost */}
            <button
              type="button"
              className={`demo-btn ${activeScenario === 'telemetry_lost' ? 'active-scenario' : ''}`}
              onClick={() => handleApplyScenario('telemetry_lost', 'CAN-Bus Degraded')}
              disabled={isLoading !== null}
              title="Sets machine_active=False to simulate degraded CAN-Bus connection"
            >
              <WifiOff size={16} color="#94A3B8" />
              <div className="demo-btn-text">
                <strong>6. Telemetry Lost</strong>
                <span>Simulates CAN-Bus signal loss</span>
              </div>
            </button>

            {/* 7. Restore Normal */}
            <button
              type="button"
              className={`demo-btn restore-btn ${activeScenario === 'restore_normal' ? 'active-scenario' : ''}`}
              onClick={() => handleApplyScenario('restore_normal', 'Restoration')}
              disabled={isLoading !== null}
              title="Clears reversible alert conditions, nominal levels"
            >
              <CheckCircle2 size={16} color="#10B981" />
              <div className="demo-btn-text">
                <strong>7. Restore Normal</strong>
                <span>Clears active alerts, restores nominal</span>
              </div>
            </button>

            {/* 8. Deterministic Reset */}
            <button
              type="button"
              className="demo-btn reset-btn"
              onClick={handleReset}
              disabled={isLoading !== null}
              title="Restores pristine database starting baseline: OP1001, EXC001, nominal tasks & telemetry"
            >
              <RotateCcw size={16} className={isLoading === 'reset' ? 'animate-spin' : ''} />
              <div className="demo-btn-text">
                <strong>8. Deterministic Reset</strong>
                <span>Restore baseline starting state</span>
              </div>
            </button>
          </div>

          {statusMessage && (
            <div className="demo-feedback-toast" role="status">
              <span className="toast-dot" />
              <span className="toast-message">{statusMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
