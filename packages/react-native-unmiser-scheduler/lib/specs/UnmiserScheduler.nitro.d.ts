import { type HybridObject } from "react-native-nitro-modules";
export type WebhookSyncReason = "MANUAL" | "INTERVAL" | "SCHEDULED" | "TEST";
export interface UnmiserScheduler extends HybridObject<{
  android: "kotlin";
}> {
  /**
   * Persist and apply scheduling from a JSON settings payload:
   * `{ syncMode: "INTERVAL" | "SCHEDULED", intervalHours: number,
   * scheduledTimes: [{ id, hour, minute, enabled }] }`.
   */
  applyWebhookSchedule(settingsJson: string): Promise<void>;
  cancelWebhookSchedule(): void;
  enqueueWebhookSync(reason: WebhookSyncReason, sendTestPayload: boolean): void;
  /**
   * Returns and clears native-recorded triggers as JSON:
   * `[{ id, reason, sendTestPayload, createdAt }]`.
   */
  consumePendingWebhookTriggers(): string;
}
declare const unmiserScheduler: UnmiserScheduler;
export { unmiserScheduler };
