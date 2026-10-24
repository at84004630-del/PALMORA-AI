/**
 * Palmora AI — Client Error Tracking & Sentry Bridge
 * Provides structured error capture for camera failures, WebGL context loss,
 * and uncaught exceptions with zero performance overhead when unconfigured.
 */

export function captureClientException(
  error: Error | unknown,
  context?: Record<string, any>
): void {
  // Always log to console in non-production
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[Palmora Error Monitor]:', error, context);
  }

  if (typeof window === 'undefined') return;

  // If Sentry is initialized on window object
  const sentry = (window as any).Sentry;
  if (sentry && typeof sentry.captureException === 'function') {
    sentry.captureException(error, {
      extra: {
        ...context,
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
    });
  }
}

export function reportCameraFailure(
  cameraError: unknown,
  constraints?: MediaStreamConstraints
): void {
  const errorMessage = cameraError instanceof Error ? cameraError.message : String(cameraError);
  captureClientException(cameraError, {
    category: 'camera_hardware_failure',
    constraints,
    error_message: errorMessage,
  });
}
