import * as WebBrowser from "expo-web-browser";

/**
 * Canonical outbound URLs for the About screen. The app is local-first and
 * open-source, so the legal documents live in the repo (rendered by GitHub)
 * rather than on a hosted marketing site — see PRIVACY.md / TERMS.md at the
 * repo root.
 */
const REPO = "https://github.com/Vijayabaskar56/unmiser";
const ANDROID_PACKAGE = "com.vijayabaskar56.unmiser";

export const LEGAL_URLS = {
  privacy: `${REPO}/blob/main/PRIVACY.md`,
  terms: `${REPO}/blob/main/TERMS.md`,
  whatsNew: `${REPO}/releases`,
  rate: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
} as const;

/** Message used when the user taps "Tell a friend" (native share sheet). */
export const SHARE_MESSAGE = `Unmiser — a local-first expense tracker that reads your bank SMS on-device. Nothing ever leaves your phone. ${REPO}`;

/** Open an external URL in the in-app browser; failures are swallowed. */
export function openExternal(url: string): void {
  void WebBrowser.openBrowserAsync(url).catch(() => {});
}
