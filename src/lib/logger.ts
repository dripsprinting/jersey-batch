/**
 * Production-safe logger that only outputs to console in development mode.
 * Prevents leaking sensitive error details (DB schema, RLS policy names, stack traces)
 * to browser console in production.
 */
export const logger = {
  error: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.error(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.warn(...args);
    }
  },
  log: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.log(...args);
    }
  },
};
