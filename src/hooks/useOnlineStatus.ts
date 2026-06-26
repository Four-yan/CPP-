import { useState, useEffect, useCallback } from 'react';

export interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean;
}

export function useOnlineStatus(): OnlineStatus {
  const [status, setStatus] = useState<OnlineStatus>(() => ({
    isOnline: navigator.onLine,
    wasOffline: false,
  }));

  const updateStatus = useCallback((online: boolean) => {
    setStatus((prev) => ({
      isOnline: online,
      wasOffline: prev.wasOffline || !online,
    }));
  }, []);

  useEffect(() => {
    const handleOnline = () => updateStatus(true);
    const handleOffline = () => updateStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateStatus]);

  return status;
}
