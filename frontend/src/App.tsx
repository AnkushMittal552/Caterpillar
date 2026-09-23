import React, { useState } from 'react';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import type { NavTabId } from './components/Navigation';
import { ConnectionBanner } from './components/ConnectionBanner';
import { LoadingState, ErrorState } from './components/LoadingErrorState';
import { DashboardPage } from './pages/DashboardPage';
import { TasksPage } from './pages/TasksPage';
import { AlertsPage } from './pages/AlertsPage';
import {
  useDashboard,
  useTasks,
  useIncidents,
  apiStartTask,
  apiPauseTask,
  apiResumeTask,
  apiCompleteTask,
  apiAcknowledgeIncident,
} from './api/useApi';
import type { PauseReason } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');

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

  const isLive = dashboardIsLive && tasksIsLive && incidentsIsLive;
  const isLoading = dashboardLoading || tasksLoading || incidentsLoading;
  const activeError = dashboardError || tasksError || incidentsError;
  const hasLoadedData = Boolean(dashboardData || tasksData || incidentsData);

  const activeIncidents = (incidentsData || []).filter(
    (i) => i.status.toUpperCase() === 'ACTIVE'
  );
  const activeAlertCount = dashboardData?.active_alert_count ?? activeIncidents.length;

  const handleRefreshAll = async () => {
    await Promise.allSettled([
      refreshDashboard(),
      refreshTasks(),
      refreshIncidents(),
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

      {/* Navigation Bar with Dashboard, Tasks, Safety Alerts, and future tabs */}
      <Navigation
        currentTab={activeTab}
        onTabChange={setActiveTab}
        activeAlertCount={activeAlertCount}
      />

      {/* Backend Connection Status Banner (Never falsy "Live") */}
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
        ) : null}
      </main>
    </div>
  );
};

export default App;
