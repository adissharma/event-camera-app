/**
 * Error monitoring abstraction.
 *
 * No Sentry import outside this file. Sentry needs native configuration and a
 * DSN, neither of which exists yet, so the default transport logs to the
 * console — and every call site is already written correctly for the day the
 * real one is wired in.
 *
 * The same redaction discipline as analytics applies, for a sharper reason:
 * crash reports capture more context than events do, and an exception message
 * containing a signed storage URL or a guest token would ship that credential
 * to a third party.
 */

import { redact, type AnalyticsProperties } from '@/lib/analytics';

export type Severity = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

export interface MonitoringTransport {
  captureException(error: Error, context: AnalyticsProperties): void;
  captureMessage(message: string, severity: Severity, context: AnalyticsProperties): void;
  setUser(userId: string | null): void;
  addBreadcrumb(message: string, context: AnalyticsProperties): void;
}

/**
 * Strips anything credential-shaped from a message.
 *
 * Applied to the message itself, not only to structured context. Supabase and
 * storage errors routinely embed a URL or a token in their text, and that text
 * goes straight into a crash report otherwise.
 */
export function scrubMessage(message: string): string {
  return message
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/\bey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]')
    .replace(/\b[0-9a-f]{32,}\b/gi, '[token]')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '[email]');
}

export const consoleMonitoring: MonitoringTransport = {
  captureException(error, context) {
    console.error(`[monitoring] ${scrubMessage(error.message)}`, context);
  },
  captureMessage(message, severity, context) {
    console.warn(`[monitoring:${severity}] ${scrubMessage(message)}`, context);
  },
  setUser() {},
  addBreadcrumb() {},
};

export const noopMonitoring: MonitoringTransport = {
  captureException() {},
  captureMessage() {},
  setUser() {},
  addBreadcrumb() {},
};

let transport: MonitoringTransport = consoleMonitoring;

export function setMonitoringTransport(next: MonitoringTransport): void {
  transport = next;
}

export function captureException(error: unknown, context: AnalyticsProperties = {}): void {
  const normalised =
    error instanceof Error ? error : new Error(scrubMessage(String(error)));
  transport.captureException(normalised, redact(context));
}

export function captureMessage(
  message: string,
  severity: Severity = 'warning',
  context: AnalyticsProperties = {},
): void {
  transport.captureMessage(scrubMessage(message), severity, redact(context));
}

/** The user id only — never an email or a display name. */
export function setMonitoringUser(userId: string | null): void {
  transport.setUser(userId);
}

export function addBreadcrumb(message: string, context: AnalyticsProperties = {}): void {
  transport.addBreadcrumb(scrubMessage(message), redact(context));
}
