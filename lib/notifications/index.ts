// Native notification layer (expo-notifications). Touches the OS + DB, so it's
// imported only from app code — never from unit tests, which target the pure
// modules (prefs.ts, dispatch.ts). Mirrors the lib/scan/index.ts split.

import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { subscriptions } from "@/db/schema";
import { getNotificationPrefs } from "@/db/services/notification-settings";
import type { SmsProcessOutcome } from "@/db/services/sms-processing";
import * as money from "@/lib/money";

import { smsOutcomeNotification, subscriptionReminderAt } from "./dispatch";
import { isWithinQuietHours } from "./prefs";

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

const ANDROID_CHANNEL_ID = "default";

// Identifier prefixes let us cancel just our scheduled notifications by family
// when re-syncing, without disturbing anything else.
const WEEKLY_REVIEW_ID = "weekly-review";
const SUB_RENEWAL_PREFIX = "sub-renewal-";

let handlerConfigured = false;

/**
 * Register the foreground presentation handler once. Safe to call repeatedly;
 * call it from the root layout so notifications show while the app is open.
 */
export function configureNotificationHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Ensure the Android channel exists (required before the OS will show the
 * permission prompt) and that we hold notification permission. Returns whether
 * permission is granted. No-op-safe on platforms without the prompt.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: "Money & app alerts",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const next = await Notifications.requestPermissionsAsync();
    return next.granted;
  } catch (error) {
    console.warn("[notifications] permission setup failed", error);
    return false;
  }
}

/** Present `content` immediately (trigger null = now). */
async function presentNow(content: { title: string; body: string; url?: string }): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      data: content.url ? { url: content.url } : {},
    },
    trigger: null,
  });
}

/**
 * Fire a one-off test notification (Developer options). Bypasses the pref +
 * quiet-hours gates on purpose — it exists to prove delivery works. Returns
 * whether it was presented (false if permission was denied).
 */
export async function sendTestNotification(): Promise<boolean> {
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return false;
    await presentNow({
      title: "Test notification 🔔",
      body: "On-device notifications are working — no servers involved.",
      url: "/notifications",
    });
    return true;
  } catch (error) {
    console.warn("[notifications] sendTestNotification failed", error);
    return false;
  }
}

/**
 * Fire a notification for a just-processed SMS outcome, if the user's prefs and
 * quiet hours allow it. Called from the live SMS ingestion path. Gates:
 * master switch → per-category rule (dispatch) → quiet hours.
 */
export async function notifyForSmsOutcome(db: Db, outcome: SmsProcessOutcome): Promise<void> {
  try {
    const prefs = await getNotificationPrefs(db);
    if (!prefs.pushEnabled) return;

    const content = smsOutcomeNotification(outcome, prefs);
    if (!content) return;

    // Instant alerts are suppressed during quiet hours (scheduled ones aren't).
    if (isWithinQuietHours(new Date())) return;

    await ensureNotificationPermission();
    await presentNow(content);
  } catch (error) {
    console.warn("[notifications] notifyForSmsOutcome failed", error);
  }
}

/**
 * Reconcile the OS's scheduled notifications with the current prefs + data:
 * weekly review (Sunday 6pm) and per-subscription renewal reminders (2 days
 * before). Cancels our previously-scheduled set and reschedules from scratch —
 * idempotent, so it's safe to call on every relevant pref/data change and on
 * app start.
 */
export async function syncScheduledNotifications(db: Db): Promise<void> {
  try {
    const prefs = await getNotificationPrefs(db);

    // Clear our families first (cancel-all is fine: we own all scheduled ones).
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!prefs.pushEnabled) return;

    if (prefs.weeklyReview) {
      await Notifications.scheduleNotificationAsync({
        identifier: WEEKLY_REVIEW_ID,
        content: {
          title: "Your weekly review",
          body: "See where your money went this week.",
          data: { url: "/(tabs)" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: 1, // Sunday (1 = Sunday … 7 = Saturday)
          hour: 18,
          minute: 0,
          channelId: ANDROID_CHANNEL_ID,
        },
      });
    }

    if (prefs.subscriptionRenewals) {
      const now = new Date();
      const rows = await db.select().from(subscriptions).where(eq(subscriptions.state, "ACTIVE"));

      for (const sub of rows as Array<typeof subscriptions.$inferSelect>) {
        const fireAt = subscriptionReminderAt(sub.nextPaymentDate ?? null, now);
        if (!fireAt) continue;
        const amount = money.format(sub.amount, sub.currency ?? "INR");
        await Notifications.scheduleNotificationAsync({
          identifier: `${SUB_RENEWAL_PREFIX}${sub.id}`,
          content: {
            title: `${sub.merchantName} renews soon`,
            body: `${amount} is due in 2 days.`,
            data: { url: `/subscription/${sub.id}` },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireAt,
            channelId: ANDROID_CHANNEL_ID,
          },
        });
      }
    }
  } catch (error) {
    console.warn("[notifications] syncScheduledNotifications failed", error);
  }
}
