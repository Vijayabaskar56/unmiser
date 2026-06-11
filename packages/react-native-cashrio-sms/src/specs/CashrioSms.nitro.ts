import { NitroModules, type HybridObject } from "react-native-nitro-modules";

export interface SmsPermissionState {
  read: boolean;
  receive: boolean;
}

export interface NativeSmsRecord {
  sender: string;
  body: string;
  receivedAt: string;
}

/**
 * One historical page. `scanned` is the number of raw inbox rows consumed
 * (the offset advance), which exceeds `records.length` when `preScreen`
 * dropped rows natively — JS must use `scanned`, not `records.length`, for
 * cursor bookkeeping and end-of-inbox detection.
 */
export interface SmsPageResult {
  records: NativeSmsRecord[];
  scanned: number;
}

export interface CashrioSms extends HybridObject<{ android: "kotlin" }> {
  hasSmsPermissions(): SmsPermissionState;
  requestSmsPermissions(): Promise<SmsPermissionState>;
  /** Total raw rows in the SMS inbox (scan progress denominator). */
  getHistoricalSmsCount(): Promise<number>;
  /**
   * Read one page oldest-to-newest. When `preScreen` is true the
   * manifest-INDEPENDENT coarse heuristic (bank-like DLT sender + a
   * transaction-looking body; the Kotlin mirror of
   * lib/parser/sms-filter.ts#shouldCaptureUnrecognizedSms) drops obvious
   * noise before it crosses the bridge. It never evaluates manifest
   * dispatch/filter regexes — manifest semantics stay TS-only.
   */
  getHistoricalSmsPage(offset: number, limit: number, preScreen: boolean): Promise<SmsPageResult>;
  showNotification(title: string, body: string): Promise<boolean>;
  /** `preScreen` applies the same coarse heuristic to realtime messages. */
  startSmsListener(onSms: (sms: NativeSmsRecord) => void, preScreen: boolean): void;
  stopSmsListener(): void;
}

const cashrioSms = NitroModules.createHybridObject<CashrioSms>("CashrioSms");

export { cashrioSms };
