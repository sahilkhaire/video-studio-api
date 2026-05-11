import { useState, useCallback } from 'react';

interface UseAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  immediate = true
) {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null });
    try {
      const response = await asyncFunction();
      setState({ data: response, loading: false, error: null });
      return response;
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }, [asyncFunction]);

  if (immediate) {
    execute();
  }

  return { ...state, execute };
}

export function usePolling<T>(
  asyncFunction: () => Promise<T>,
  interval = 5000,
  _enabled = true
) {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const poll = useCallback(async () => {
    try {
      const response = await asyncFunction();
      setState({ data: response, loading: false, error: null });
      return response;
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }, [asyncFunction]);

  const [pollingId, setPollingId] = useState<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback(() => {
    poll();
    const id = setInterval(poll, interval);
    setPollingId(id);
  }, [poll, interval]);

  const stopPolling = useCallback(() => {
    if (pollingId) {
      clearInterval(pollingId);
      setPollingId(null);
    }
  }, [pollingId]);

  return { ...state, startPolling, stopPolling, poll };
}
