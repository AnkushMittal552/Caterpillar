import type { DashboardResponse, Task, Incident } from '../types';

export const mockDashboard: DashboardResponse = {
  operator: {
    id: 'OP1001',
    name: 'Operator 1',
  },
  machine: {
    id: 'EXC001',
    status: 'OPERATIONAL',
    engine_hours: 1524.8,
  },
  current_task: {
    task_id: 'T001',
    task_type: 'Earth Excavation',
    status: 'IN_PROGRESS',
    planned_minutes: 60,
    predicted_minutes: 55,
    progress: 40,
  },
  telemetry: {
    engine_hours: 1524.8,
    fuel_used: 3.8,
    load_cycles: 2,
    idle_minutes: 55,
    seatbelt_status: 'Unfastened',
  },
  active_alert_count: 2,
  open_request_count: 2,
};

export const mockTasks: Task[] = [
  {
    task_id: 'T001',
    task_type: 'Earth Excavation',
    status: 'IN_PROGRESS',
    planned_minutes: 60,
    predicted_minutes: 55,
    progress: 40,
  },
  {
    task_id: 'T002',
    task_type: 'Trenching',
    status: 'PENDING',
    planned_minutes: 90,
    predicted_minutes: 85,
    progress: 0,
  },
  {
    task_id: 'T003',
    task_type: 'Material Loading',
    status: 'PENDING',
    planned_minutes: 45,
    predicted_minutes: 50,
    progress: 0,
  },
];

export const mockIncidents: Incident[] = [
  {
    id: 'INC-201',
    type: 'SEATBELT_UNFASTENED',
    category: 'SAFETY',
    severity: 'HIGH',
    title: 'Seatbelt Unfastened',
    message: 'Operator seatbelt sensor detected unfastened state while machine engine is active.',
    machine_id: 'EXC001',
    task_id: 'T001',
    status: 'ACTIVE',
    created_at: '2026-09-23T10:04:00Z',
    evidence: {
      'Seatbelt Status': 'Unfastened',
      'Machine Active': 'Yes',
      'Engine RPM': '1450',
    },
  },
  {
    id: 'INC-202',
    type: 'HIGH_IDLE_TIME',
    category: 'PRODUCTIVITY',
    severity: 'MEDIUM',
    title: 'High Idle Time Exceeded',
    message: 'Machine has exceeded idle duration threshold without executing load cycles.',
    machine_id: 'EXC001',
    task_id: 'T001',
    status: 'ACTIVE',
    created_at: '2026-09-23T10:15:00Z',
    evidence: {
      'Idle Time': '55 min',
      'Load Cycles': 2,
      'Threshold': 'Demo threshold 45 min',
    },
  },
  {
    id: 'INC-198',
    type: 'PROXIMITY_ALERT',
    category: 'SAFETY',
    severity: 'CRITICAL',
    title: 'Perimeter Proximity Warning',
    message: 'Rear radar detected personnel within safety barrier zone.',
    machine_id: 'EXC001',
    task_id: 'T001',
    status: 'ACKNOWLEDGED',
    created_at: '2026-09-23T08:45:00Z',
    acknowledged_at: '2026-09-23T08:46:12Z',
    evidence: {
      'Zone': 'Rear Exclusion Zone',
      'Distance': '2.1 m',
      'Action Taken': 'Operator horn sounded',
    },
  },
  {
    id: 'INC-190',
    type: 'TELEMETRY_SYNC',
    category: 'SYSTEM',
    severity: 'INFO',
    title: 'Scheduled Telemetry Gateway Sync',
    message: 'Diagnostic gateway completed scheduled log transmission.',
    machine_id: 'EXC001',
    status: 'RESOLVED',
    created_at: '2026-09-23T07:00:00Z',
    resolved_at: '2026-09-23T07:05:00Z',
    evidence: {
      'Packets Sent': 1042,
      'Latency': '34 ms',
    },
  },
];
