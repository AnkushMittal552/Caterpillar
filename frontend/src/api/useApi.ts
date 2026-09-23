import { useState, useEffect, useCallback } from 'react';
import {
  getDashboard,
  getTasks,
  getIncidents,
  acknowledgeIncident as apiAcknowledgeIncident,
  startTask as apiStartTask,
  pauseTask as apiPauseTask,
  resumeTask as apiResumeTask,
  completeTask as apiCompleteTask,
  ApiError,
} from './client';
import type { DashboardResponse, Task, Incident } from '../types';
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

export {
  apiAcknowledgeIncident,
  apiStartTask,
  apiPauseTask,
  apiResumeTask,
  apiCompleteTask,
};
