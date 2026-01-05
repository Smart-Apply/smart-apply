import { useEffect, useState, useRef } from 'react';
import type { ApplicationStatus } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface StreamData {
  id: string;
  status: ApplicationStatus;
  updatedAt: string;
  errorMessage: string | null;
}

interface UseApplicationStreamReturn {
  status: ApplicationStatus | null;
  error: string | null;
  isConnected: boolean;
}

/**
 * Hook for streaming real-time application status updates via Server-Sent Events (SSE)
 * 
 * @param applicationId - The ID of the application to stream status for
 * @returns Object containing current status, error state, and connection state
 * 
 * @example
 * ```tsx
 * const { status, error, isConnected } = useApplicationStream(applicationId);
 * 
 * // Use status if available, otherwise fallback to initial data
 * const currentStatus = status || application?.status;
 * ```
 */
export function useApplicationStream(applicationId: string | undefined): UseApplicationStreamReturn {
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Connect on mount and when applicationId changes
  useEffect(() => {
    if (!applicationId) {
      return;
    }

    // Create SSE connection with credentials (for JWT cookie)
    // Note: withCredentials is supported in modern browsers (Chrome 26+, Firefox 22+)
    // This ensures HttpOnly cookies are sent with the request for JWT authentication
    const eventSource = new EventSource(
      `${API_BASE_URL}/applications/${applicationId}/stream`,
      { withCredentials: true }
    );

    eventSourceRef.current = eventSource;

    // Handle connection open
    const handleOpen = () => {
      setIsConnected(true);
      setError(null);
    };

    // Handle incoming messages
    const handleMessage = (event: MessageEvent) => {
      try {
        const data: StreamData = JSON.parse(event.data);
        setStatus(data.status);
        setError(null);

        // Close connection if status is final (READY or FAILED)
        if (data.status === 'READY' || data.status === 'FAILED') {
          eventSource.close();
          setIsConnected(false);
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
        setError('Status konnte nicht verarbeitet werden');
      }
    };

    // Handle connection errors
    const handleError = () => {
      console.error('SSE connection error');
      
      // EventSource automatically attempts to reconnect on error
      // We only need to handle the error state
      if (eventSource.readyState === EventSource.CLOSED) {
        setError('Connection closed');
        setIsConnected(false);
      } else {
        setError('Connection error, retrying...');
      }
    };

    // Attach event listeners
    eventSource.addEventListener('open', handleOpen);
    eventSource.addEventListener('message', handleMessage);
    eventSource.addEventListener('error', handleError);

    // Cleanup function
    return () => {
      eventSource.removeEventListener('open', handleOpen);
      eventSource.removeEventListener('message', handleMessage);
      eventSource.removeEventListener('error', handleError);
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [applicationId]);

  return {
    status,
    error,
    isConnected,
  };
}
