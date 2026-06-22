import { unmiserScheduler, type WebhookSyncReason } from "react-native-unmiser-scheduler";

export type WebhookSyncMode = "INTERVAL" | "SCHEDULED";

export interface WebhookScheduledTime {
  id: string;
  hour: number;
  minute: number;
  enabled: boolean;
}

export interface WebhookScheduleSettings {
  syncMode: WebhookSyncMode;
  intervalHours: number;
  scheduledTimes: WebhookScheduledTime[];
}

export interface PendingWebhookTrigger {
  id: string;
  reason: WebhookSyncReason;
  sendTestPayload: boolean;
  createdAt: string;
}

export function applyWebhookSchedule(settings: WebhookScheduleSettings): Promise<void> {
  return unmiserScheduler.applyWebhookSchedule(JSON.stringify(normalizeSettings(settings)));
}

export function cancelWebhookSchedule(): void {
  unmiserScheduler.cancelWebhookSchedule();
}

export function enqueueWebhookSync(reason: WebhookSyncReason, sendTestPayload = false): void {
  unmiserScheduler.enqueueWebhookSync(reason, sendTestPayload);
}

export function consumePendingWebhookTriggers(): PendingWebhookTrigger[] {
  const raw = unmiserScheduler.consumePendingWebhookTriggers();
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isPendingWebhookTrigger);
}

function normalizeSettings(settings: WebhookScheduleSettings): WebhookScheduleSettings {
  return {
    syncMode: settings.syncMode,
    intervalHours: Math.min(24, Math.max(1, Math.round(settings.intervalHours))),
    scheduledTimes: settings.scheduledTimes.map((time) => ({
      id: time.id,
      hour: Math.min(23, Math.max(0, Math.round(time.hour))),
      minute: Math.min(59, Math.max(0, Math.round(time.minute))),
      enabled: time.enabled,
    })),
  };
}

function isPendingWebhookTrigger(value: unknown): value is PendingWebhookTrigger {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    isWebhookSyncReason(row.reason) &&
    typeof row.sendTestPayload === "boolean" &&
    typeof row.createdAt === "string"
  );
}

function isWebhookSyncReason(value: unknown): value is WebhookSyncReason {
  return value === "MANUAL" || value === "INTERVAL" || value === "SCHEDULED" || value === "TEST";
}
