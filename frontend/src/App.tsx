import React, { useState } from 'react';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import type { NavTabId } from './components/Navigation';
import { ConnectionBanner } from './components/ConnectionBanner';
import { LoadingState, ErrorState } from './components/LoadingErrorState';
import { DashboardPage } from './pages/DashboardPage';
import { TasksPage } from './pages/TasksPage';
import { useDashboard, useTasks } from './api/useApi';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');

  const {
    data: dashboardData,
    loading: dashboardLoading,
    error: dashboardError,
    isLive: dashboardIsLive,
    isBackendUnavailable: dashboardUnavailable,
    refresh: refreshDashboard,
  } = useDashboard(true);

  const {
    data: tasksData,
    loading: tasksLoading,
    error: tasksError,
    isLive: tasksIsLive,
    isBackendUnavailable: tasksUnavailable,
    refresh: refreshTasks,
  } = useTasks(true);

  const isLive = dashboardIsLive && tasksIsLive;
  const isBackendUnavailable = dashboardUnavailable || tasksUnavailable;
  const isLoading = dashboardLoading || tasksLoading;
  const activeError = dashboardError || tasksError;

  const handleRefresh = () => {
    refreshDashboard();
    refreshTasks();
  };

  return (
    <div className="app-container">
      {/* Heavy Equipment Industrial Header */}
      <Header
        operatorId={dashboardData?.operator.id || 'OP1001'}
        machineId={dashboardData?.machine.id || 'EXC001'}
        machineStatus={dashboardData?.machine.status || 'OPERATIONAL'}
        isLive={isLive}
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
      />

      {/* Navigation bar with Dashboard, Tasks, and future phase tabs */}
      <Navigation currentTab={activeTab} onTabChange={setActiveTab} />

      {/* Backend Connection Status Banner (Never falsy "Live") */}
      <ConnectionBanner
        isLive={isLive}
        isBackendUnavailable={isBackendUnavailable}
        error={activeError}
        onRetry={handleRefresh}
        isLoading={isLoading}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {isLoading && !dashboardData && !tasksData ? (
          <LoadingState message="Loading ShiftMate equipment data..." />
        ) : activeTab === 'dashboard' ? (
          dashboardData ? (
            <DashboardPage dashboard={dashboardData} />
          ) : (
            <ErrorState
              title="Dashboard Data Unavailable"
              message={dashboardError || 'Failed to load dashboard data.'}
              onRetry={refreshDashboard}
            />
          )
        ) : (
          tasksData ? (
            <TasksPage tasks={tasksData} />
          ) : (
            <ErrorState
              title="Tasks Schedule Unavailable"
              message={tasksError || 'Failed to load tasks list.'}
              onRetry={refreshTasks}
            />
          )
        )}
      </main>
    </div>
  );
};

export default App;
