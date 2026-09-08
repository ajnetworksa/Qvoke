/**
 * Client-Side Error & User Action Logger
 * Automatically transmits unhandled exceptions and user action failures
 * to the backend SQLite audit log for diagnostics.
 */

export interface LogClientErrorParams {
  action: string;
  error: Error | string;
  route?: string;
  metadata?: Record<string, any>;
}

export function logClientError({ action, error, route, metadata }: LogClientErrorParams) {
  try {
    const token = localStorage.getItem('erp_token');
    const currentRoute = route || window.location.pathname;
    const errorMsg = error instanceof Error ? error.message : String(error);
    const stackTrace = error instanceof Error ? error.stack : undefined;

    fetch('/api/logs/client-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        action,
        error: errorMsg,
        stack: stackTrace,
        route: currentRoute,
        metadata: {
          ...metadata,
          url: window.location.href,
          timestamp: new Date().toISOString()
        }
      })
    }).catch((err) => {
      console.warn('[Logger] Remote logging request failed:', err);
    });
  } catch (err) {
    console.warn('[Logger] Error in client logger:', err);
  }
}

// Global window error listener
export function setupGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    logClientError({
      action: 'Unhandled Window Error',
      error: event.error || event.message,
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logClientError({
      action: 'Unhandled Promise Rejection',
      error: event.reason || 'Unknown Promise Rejection'
    });
  });
}
