import { Platform } from "react-native";
import { NitroModules } from "react-native-nitro-modules";

import type {
  CashrioSms as CashrioSmsHybrid,
  NativeSmsRecord,
  SmsPageResult,
  SmsPermissionState,
} from "react-native-cashrio-sms";

export type { NativeSmsRecord, SmsPageResult, SmsPermissionState };
type CashrioSmsModule = CashrioSmsHybrid;

let nitroModule: CashrioSmsModule | null = null;

function getNitroModule(): CashrioSmsModule | null {
  if (Platform.OS !== "android") return null;
  if (nitroModule) return nitroModule;
  try {
    nitroModule = NitroModules.createHybridObject<CashrioSmsModule>("CashrioSms");
  } catch {
    nitroModule = null;
  }
  return nitroModule;
}

export function isAndroidSmsAdapterAvailable(): boolean {
  return getNitroModule() !== null;
}

export async function hasSmsPermissions(): Promise<SmsPermissionState> {
  const module = getNitroModule();
  if (!module) return { read: false, receive: false };
  return module.hasSmsPermissions();
}

export async function requestSmsPermissions(): Promise<SmsPermissionState> {
  const module = getNitroModule();
  if (!module) return { read: false, receive: false };
  return module.requestSmsPermissions();
}

export async function getHistoricalSmsCount(): Promise<number> {
  const module = getNitroModule();
  if (!module) return 0;
  return module.getHistoricalSmsCount();
}

/**
 * One historical page. `preScreen: true` applies the native coarse heuristic
 * (Kotlin mirror of shouldCaptureUnrecognizedSms) before records cross the
 * bridge; `scanned` stays in raw-row space for cursor bookkeeping. The paste
 * harness path never calls this, so it is unaffected by the pre-screen.
 */
export async function getHistoricalSmsPage(
  offset: number,
  limit: number,
  preScreen = false,
): Promise<SmsPageResult> {
  const module = getNitroModule();
  if (!module) return { records: [], scanned: 0 };
  return module.getHistoricalSmsPage(offset, limit, preScreen);
}

export function subscribeToIncomingSms(
  callback: (record: NativeSmsRecord) => void,
  options: { preScreen?: boolean } = {},
): () => void {
  const module = getNitroModule();
  if (!module) return () => {};
  module.startSmsListener(callback, options.preScreen ?? false);
  return () => module.stopSmsListener();
}

export async function showSmsNotification(title: string, body: string): Promise<boolean> {
  const module = getNitroModule();
  if (!module) return false;
  return module.showNotification(title, body);
}
