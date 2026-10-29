import * as Notifications from "expo-notifications";
import type { CampaignDay, Daypart } from "./types";

/**
 * Daily "post today's special" reminders, scheduled ON THE PHONE (no push
 * token, nothing sent from our servers). Timed early enough to change a
 * guest's plans for that daypart.
 */
const POST_AT: Record<Daypart, { dayOffset: number; hour: number; minute: number }> = {
  Breakfast: { dayOffset: -1, hour: 19, minute: 0 },
  Lunch: { dayOffset: 0, hour: 10, minute: 0 },
  Afternoon: { dayOffset: 0, hour: 11, minute: 30 },
  Dinner: { dayOffset: 0, hour: 15, minute: 0 },
  "Late-Night": { dayOffset: 0, hour: 18, minute: 0 },
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  return asked.granted;
}

/** Replace all reminders with one per remaining campaign day. Returns how many were scheduled. */
export async function scheduleReminders(restaurant: string, slug: string, days: CampaignDay[]): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  let n = 0;
  for (const d of days) {
    const t = POST_AT[d.daypart] ?? POST_AT.Dinner;
    const [y, m, day] = d.date.split("-").map(Number);
    const when = new Date(y, m - 1, day + t.dayOffset, t.hour, t.minute);
    if (when.getTime() <= now) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Post today's special — ${d.pct_off}% off ${d.item}`,
        body: `${d.discount_window} at ${restaurant}. Tap to share the poster.`,
        data: { slug, dayId: d.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
    });
    n++;
    if (n >= 60) break; // iOS keeps at most 64 pending local notifications
  }
  return n;
}

export async function cancelReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function remindersScheduled(): Promise<number> {
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}
