import { useState, useEffect, useCallback } from 'react';
import {
  getDashboard,
  getTasks,
  getIncidents,
  getUsageInsights,
  getSupportRequests,
  acknowledgeIncident as apiAcknowledgeIncident,
  startTask as apiStartTask,
  pauseTask as apiPauseTask,
  resumeTask as apiResumeTask,
  completeTask as apiCompleteTask,
  createSupportRequest as apiCreateSupportRequest,
  acknowledgeSupportRequest as apiAcknowledgeSupportRequest,
  respondSupportRequest as apiRespondSupportRequest,
  resolveSupportRequest as apiResolveSupportRequest,
  predictTaskTime as apiPredictTaskTime,
  askAssistant as apiAskAssistant,
  getTrainingModules,
  getTrainingRecommendations,
  getTrainingModule as apiGetTrainingModule,
  submitTrainingQuiz as apiSubmitTrainingQuiz,
  getHandoverReport as apiGetHandoverReport,
  ApiError,
} from './client';
import type {
  DashboardResponse,
  Task,
  Incident,
  UsageInsightsResponse,
  SupportRequest,
  TrainingModule,
  TrainingRecommendation,
  ShiftHandoverReport,
} from '../types';
import { mockDashboard, mockTasks, mockIncidents } from '../mock/data';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isLive: boolean;
  isBackendUnavailable: boolean;
  refresh: () => Promise<void>;
}

export function useDashboard(allowMockFallback: boolean = true): UseApiState<DashboardResponse> {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [isBackendUnavailable, setIsBackendUnavailable] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getDashboard();
      setData(result);
      setIsLive(true);
      setIsBackendUnavailable(false);
      setError(null);
    } catch (err) {
      setIsLive(false);
      const isUnavailable =
        err instanceof ApiError &&
        (err.isNetworkError || err.status === 502 || err.status === 504 || err.status === 404);
      setIsBackendUnavailable(isUnavailable);

      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred while fetching dashboard data.';
      setError(errorMessage);

      if (allowMockFallback) {
        setData((prev) => prev ?? mockDashboard);
      }
    } finally {
      setLoading(false);
    }
  }, [allowMockFallback]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    isLive,
    isBackendUnavailable,
    refresh: fetchData,
  };
}

export function useTasks(allowMockFallback: boolean = true): UseApiState<Task[]> {
  const [data, setData] = useState<Task[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [isBackendUnavailable, setIsBackendUnavailable] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTasks();
      setData(result);
      setIsLive(true);
      setIsBackendUnavailable(false);
      setError(null);
    } catch (err) {
      setIsLive(false);
      const isUnavailable =
        err instanceof ApiError &&
        (err.isNetworkError || err.status === 502 || err.status === 504 || err.status === 404);
      setIsBackendUnavailable(isUnavailable);

      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred while fetching tasks.';
      setError(errorMessage);

      if (allowMockFallback) {
        setData((prev) => prev ?? mockTasks);
      }
    } finally {
      setLoading(false);
    }
  }, [allowMockFallback]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    isLive,
    isBackendUnavailable,
    refresh: fetchData,
  };
}

export function useIncidents(allowMockFallback: boolean = true): UseApiState<Incident[]> {
  const [data, setData] = useState<Incident[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [isBackendUnavailable, setIsBackendUnavailable] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getIncidents();
      setData(result);
      setIsLive(true);
      setIsBackendUnavailable(false);
      setError(null);
    } catch (err) {
      setIsLive(false);
      const isUnavailable =
        err instanceof ApiError &&
        (err.isNetworkError || err.status === 502 || err.status === 504 || err.status === 404);
      setIsBackendUnavailable(isUnavailable);

      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred while fetching incidents.';
      setError(errorMessage);

      if (allowMockFallback) {
        setData((prev) => prev ?? mockIncidents);
      }
    } finally {
      setLoading(false);
    }
  }, [allowMockFallback]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    isLive,
    isBackendUnavailable,
    refresh: fetchData,
  };
}

export function useUsageInsights(machineId: string = 'EXC001'): UseApiState<UsageInsightsResponse> {
  const [data, setData] = useState<UsageInsightsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [isBackendUnavailable, setIsBackendUnavailable] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getUsageInsights(machineId);
      setData(result);
      setIsLive(true);
      setIsBackendUnavailable(false);
      setError(null);
    } catch (err) {
      setIsLive(false);
      const isUnavailable =
        err instanceof ApiError &&
        (err.isNetworkError || err.status === 502 || err.status === 504 || err.status === 404);
      setIsBackendUnavailable(isUnavailable);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch machine usage insights.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    isLive,
    isBackendUnavailable,
    refresh: fetchData,
  };
}

export function useSupportRequests(statusFilter?: string): UseApiState<SupportRequest[]> {
  const [data, setData] = useState<SupportRequest[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [isBackendUnavailable, setIsBackendUnavailable] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSupportRequests(statusFilter);
      setData(result);
      setIsLive(true);
      setIsBackendUnavailable(false);
      setError(null);
    } catch (err) {
      setIsLive(false);
      const isUnavailable =
        err instanceof ApiError &&
        (err.isNetworkError || err.status === 502 || err.status === 504 || err.status === 404);
      setIsBackendUnavailable(isUnavailable);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch support requests.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    isLive,
    isBackendUnavailable,
    refresh: fetchData,
  };
}

// ---------------------------------------------------------------------------
// Phase 4 Hooks: Training & Handover
// ---------------------------------------------------------------------------

export function useTrainingModules(operatorId: string = 'OP1001'): UseApiState<TrainingModule[]> {
  const [data, setData] = useState<TrainingModule[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [isBackendUnavailable, setIsBackendUnavailable] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTrainingModules(operatorId);
      setData(result);
      setIsLive(true);
      setIsBackendUnavailable(false);
      setError(null);
    } catch (err) {
      setIsLive(false);
      const isUnavailable =
        err instanceof ApiError &&
        (err.isNetworkError || err.status === 502 || err.status === 504 || err.status === 404);
      setIsBackendUnavailable(isUnavailable);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch training modules.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    isLive,
    isBackendUnavailable,
    refresh: fetchData,
  };
}

export function useTrainingRecommendations(operatorId: string = 'OP1001'): UseApiState<TrainingRecommendation[]> {
  const [data, setData] = useState<TrainingRecommendation[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [isBackendUnavailable, setIsBackendUnavailable] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTrainingRecommendations(operatorId);
      setData(result);
      setIsLive(true);
      setIsBackendUnavailable(false);
      setError(null);
    } catch (err) {
      setIsLive(false);
      const isUnavailable =
        err instanceof ApiError &&
        (err.isNetworkError || err.status === 502 || err.status === 504 || err.status === 404);
      setIsBackendUnavailable(isUnavailable);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch training recommendations.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    isLive,
    isBackendUnavailable,
    refresh: fetchData,
  };
}

export function useHandover(
  machineId: string = 'EXC001',
  operatorId: string = 'OP1001'
): UseApiState<ShiftHandoverReport> {
  const [data, setData] = useState<ShiftHandoverReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [isBackendUnavailable, setIsBackendUnavailable] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiGetHandoverReport(machineId, operatorId);
      setData(result);
      setIsLive(true);
      setIsBackendUnavailable(false);
      setError(null);
    } catch (err) {
      setIsLive(false);
      const isUnavailable =
        err instanceof ApiError &&
        (err.isNetworkError || err.status === 502 || err.status === 504 || err.status === 404);
      setIsBackendUnavailable(isUnavailable);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch shift handover report.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [machineId, operatorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    isLive,
    isBackendUnavailable,
    refresh: fetchData,
  };
}

export {
  apiAcknowledgeIncident,
  apiStartTask,
  apiPauseTask,
  apiResumeTask,
  apiCompleteTask,
  apiCreateSupportRequest,
  apiAcknowledgeSupportRequest,
  apiRespondSupportRequest,
  apiResolveSupportRequest,
  apiPredictTaskTime,
  apiAskAssistant,
  apiGetTrainingModule,
  apiSubmitTrainingQuiz,
  apiGetHandoverReport,
};

