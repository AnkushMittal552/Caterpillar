import type { DashboardResponse, Task } from '../types';

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
  active_alert_count: 1,
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
