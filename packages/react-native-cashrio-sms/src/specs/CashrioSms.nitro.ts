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

export interface CashrioSms extends HybridObject<{ android: "kotlin" }> {
  hasSmsPermissions(): SmsPermissionState;
  requestSmsPermissions(): Promise<SmsPermissionState>;
  getHistoricalSmsPage(offset: number, limit: number): Promise<NativeSmsRecord[]>;
  showNotification(title: string, body: string): Promise<boolean>;
  startSmsListener(onSms: (sms: NativeSmsRecord) => void): void;
  stopSmsListener(): void;
}

const cashrioSms = NitroModules.createHybridObject<CashrioSms>("CashrioSms");

export { cashrioSms };
