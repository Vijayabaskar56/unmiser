import { Platform } from "react-native";
import { NitroModules } from "react-native-nitro-modules";

import type {
  CashrioSms as CashrioSmsHybrid,
  NativeSmsRecord,
  SmsPermissionState,
} from "react-native-cashrio-sms";

export type { NativeSmsRecord, SmsPermissionState };
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

export async function getHistoricalSmsPage(
  offset: number,
  limit: number,
): Promise<NativeSmsRecord[]> {
  const module = getNitroModule();
  if (!module) return [];
  return module.getHistoricalSmsPage(offset, limit);
}

export function subscribeToIncomingSms(callback: (record: NativeSmsRecord) => void): () => void {
  const module = getNitroModule();
  if (!module) return () => {};
  module.startSmsListener(callback);
  return () => module.stopSmsListener();
}

export async function showSmsNotification(title: string, body: string): Promise<boolean> {
  const module = getNitroModule();
  if (!module) return false;
  return module.showNotification(title, body);
}
