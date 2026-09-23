import React, { useState } from 'react';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import type { NavTabId } from './components/Navigation';
import { ConnectionBanner } from './components/ConnectionBanner';
import { LoadingState, ErrorState } from './components/LoadingErrorState';
import { DashboardPage } from './pages/DashboardPage';
import { TasksPage } from './pages/TasksPage';
import { AlertsPage } from './pages/AlertsPage';
import { TelemetryPage } from './pages/TelemetryPage';
import { SupervisorPage } from './pages/SupervisorPage';
import { RequestSupportModal } from './components/RequestSupportModal';
import {
  useDashboard,
  useTasks,
  useIncidents,
  useUsageInsights,
  useSupportRequests,
  apiStartTask,
  apiPauseTask,
  apiResumeTask,
  apiCompleteTask,
  apiAcknowledgeIncident,
  apiCreateSupportRequest,
  apiAcknowledgeSupportRequest,
  apiRespondSupportRequest,
  apiResolveSupportRequest,
} from './api/useApi';
import type { PauseReason, SupportRequestType, TelemetrySnapshot } from './types';

const DEFAULT_TELEMETRY: TelemetrySnapshot = {
  engine_hours: 1524.8,
  fuel_used: 3.8,
  load_cycles: 2,
  idle_minutes: 55,
  seatbelt_status: 'Unfastened',
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');
  const [isSupportModalOpen, setIsSupportModalOpen] = useState<boolean>(false);
  const [supportModalDefaultTaskId, setSupportModalDefaultTaskId] = useState<string | undefined>(undefined);

  const {
    data: dashboardData,
    loading: dashboardLoading,
    error: dashboardError,
    isLive: dashboardIsLive,
    refresh: refreshDashboard,
  } = useDashboard(true);

  const {
    data: tasksData,
    loading: tasksLoading,
    error: tasksError,
    isLive: tasksIsLive,
    refresh: refreshTasks,
  } = useTasks(true);

  const {
    data: incidentsData,
    loading: incidentsLoading,
    error: incidentsError,
    isLive: incidentsIsLive,
    refresh: refreshIncidents,
  } = useIncidents(true);

  const {
    data: usageInsightsData,
    loading: usageInsightsLoading,
    error: usageInsightsError,
    refresh: refreshUsageInsights,
  } = useUsageInsights();

  const {
    data: supportRequestsData,
    loading: supportRequestsLoading,
    error: supportRequestsError,
    refresh: refreshSupportRequests,
  } = useSupportRequests();

  const isLive = dashboardIsLive && tasksIsLive && incidentsIsLive;
  const isLoading = dashboardLoading || tasksLoading || incidentsLoading;
  const activeError = dashboardError || tasksError || incidentsError || usageInsightsError || supportRequestsError;
  const hasLoadedData = Boolean(dashboardData || tasksData || incidentsData);

  const activeIncidents = (incidentsData || []).filter(
    (i) => i.status.toUpperCase() === 'ACTIVE'
  );
  const activeAlertCount = dashboardData?.active_alert_count ?? activeIncidents.length;

  const openSupportRequests = (supportRequestsData || []).filter(
    (r) => r.status.toUpperCase() !== 'RESOLVED'
  );
  const openRequestCount = dashboardData?.open_request_count ?? openSupportRequests.length;

  const handleRefreshAll = async () => {
    await Promise.allSettled([
      refreshDashboard(),
      refreshTasks(),
      refreshIncidents(),
      refreshUsageInsights(),
      refreshSupportRequests(),
    ]);
  };

  // --- Task Workflow Handlers ---
  const handleStartTask = async (taskId: string) => {
    await apiStartTask(taskId);
    await Promise.allSettled([refreshTasks(), refreshDashboard()]);
  };

  const handlePauseTask = async (taskId: string, reason: PauseReason, note: string) => {
    await apiPauseTask(taskId, reason, note);
    await Promise.allSettled([refreshTasks(), refreshDashboard()]);
  };

  const handleResumeTask = async (taskId: string) => {
    await apiResumeTask(taskId);
    await Promise.allSettled([refreshTasks(), refreshDashboard()]);
  };

  const handleCompleteTask = async (taskId: string) => {
    await apiCompleteTask(taskId);
    await Promise.allSettled([refreshTasks(), refreshDashboard()]);
  };

  // --- Incident Handlers ---
  const handleAcknowledgeIncident = async (incidentId: string) => {
    await apiAcknowledgeIncident(incidentId);
    await Promise.allSettled([refreshIncidents(), refreshDashboard()]);
  };

  // --- Support Request Handlers ---
  const handleOpenSupportModal = (taskId?: string) => {
    setSupportModalDefaultTaskId(taskId);
    setIsSupportModalOpen(true);
  };

  const handleCreateSupportRequest = async (payload: {
    request_type: SupportRequestType;
    task_id?: string;
    message: string;
  }) => {
    await apiCreateSupportRequest(payload);
    await Promise.allSettled([refreshSupportRequests(), refreshDashboard()]);
  };

  const handleAcknowledgeSupportRequest = async (id: string) => {
    await apiAcknowledgeSupportRequest(id);
    await Promise.allSettled([refreshSupportRequests(), refreshDashboard()]);
  };

  const handleRespondSupportRequest = async (id: string, message: string) => {
    await apiRespondSupportRequest(id, message);
    await Promise.allSettled([refreshSupportRequests(), refreshDashboard()]);
  };

  const handleResolveSupportRequest = async (id: string) => {
    await apiResolveSupportRequest(id);
    await Promise.allSettled([refreshSupportRequests(), refreshDashboard()]);
  };

  return (
    <div className="app-container">
      {/* Heavy Equipment Industrial Header */}
      <Header
        operatorId={dashboardData?.operator.id || 'OP1001'}
        machineId={dashboardData?.machine.id || 'EXC001'}
        machineStatus={dashboardData?.machine.status || 'OPERATIONAL'}
        isLive={isLive}
        onRefresh={handleRefreshAll}
        isRefreshing={isLoading}
      />

      {/* Navigation Bar with Dashboard, Tasks, Safety Alerts, Telemetry, and Supervisor */}
      <Navigation
        currentTab={activeTab}
        onTabChange={setActiveTab}
        activeAlertCount={activeAlertCount}
        openRequestCount={openRequestCount}
      />

      {/* Backend Connection Status Banner */}
      <ConnectionBanner
        isLive={isLive}
        hasLoadedData={hasLoadedData}
        error={activeError}
        onRetry={handleRefreshAll}
        isLoading={isLoading}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {isLoading && !dashboardData && !tasksData && !incidentsData ? (
          <LoadingState message="Synchronizing ShiftMate equipment systems..." />
        ) : activeTab === 'dashboard' ? (
          dashboardData ? (
            <DashboardPage
              dashboard={dashboardData}
              activeIncidents={activeIncidents}
              onNavigateToAlerts={() => setActiveTab('alerts')}
              onNavigateToTasks={() => setActiveTab('tasks')}
              onNavigateToSupervisor={() => setActiveTab('supervisor')}
              onRequestSupport={() => handleOpenSupportModal(dashboardData.current_task?.task_id)}
            />
          ) : (
            <ErrorState
              title="Dashboard Data Unavailable"
              message={dashboardError || 'Failed to load dashboard data.'}
              onRetry={refreshDashboard}
            />
          )
        ) : activeTab === 'tasks' ? (
          tasksData ? (
            <TasksPage
              tasks={tasksData}
              onStartTask={handleStartTask}
              onPauseTask={handlePauseTask}
              onResumeTask={handleResumeTask}
              onCompleteTask={handleCompleteTask}
              onRefresh={refreshTasks}
              isRefreshing={tasksLoading}
              onRequestSupport={handleOpenSupportModal}
            />
          ) : (
            <ErrorState
              title="Tasks Schedule Unavailable"
              message={tasksError || 'Failed to load tasks schedule.'}
              onRetry={refreshTasks}
            />
          )
        ) : activeTab === 'alerts' ? (
          incidentsData ? (
            <AlertsPage
              incidents={incidentsData}
              onAcknowledge={handleAcknowledgeIncident}
              onRefresh={refreshIncidents}
              isRefreshing={incidentsLoading}
            />
          ) : (
            <ErrorState
              title="Incident Gateway Unavailable"
              message={incidentsError || 'Failed to load safety alerts.'}
              onRetry={refreshIncidents}
            />
          )
        ) : activeTab === 'telemetry' ? (
          <TelemetryPage
            telemetry={dashboardData?.telemetry || DEFAULT_TELEMETRY}
            insights={usageInsightsData?.insights || []}
            incidents={incidentsData || []}
            onRefresh={async () => {
              await Promise.allSettled([refreshUsageInsights(), refreshDashboard()]);
            }}
            isRefreshing={usageInsightsLoading}
          />
        ) : activeTab === 'supervisor' ? (
          <SupervisorPage
            requests={supportRequestsData || []}
            onAcknowledge={handleAcknowledgeSupportRequest}
            onRespond={handleRespondSupportRequest}
            onResolve={handleResolveSupportRequest}
            onRefresh={async () => {
              await refreshSupportRequests();
            }}
            isRefreshing={supportRequestsLoading}
          />
        ) : null}
      </main>

      {/* Operator Support Request Modal */}
      <RequestSupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        onSubmit={handleCreateSupportRequest}
        tasks={tasksData || []}
        defaultTaskId={supportModalDefaultTaskId}
      />
    </div>
  );
};

export default App;
