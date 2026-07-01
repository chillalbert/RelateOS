import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";

// Initialize Firebase Admin SDK if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Returns the local hour (0-23) and today's date (YYYY-MM-DD) for a given IANA timezone.
 * Utilizes native Intl APIs which seamlessly account for Daylight Saving Time (DST)
 * and correct local offsets without risky manual math.
 */
function getLocalTimeAndDate(timezone: string, now: Date): { hour: number; localToday: string } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const partMap = new Map(parts.map(p => [p.type, p.value]));

  const year = partMap.get("year");
  const month = partMap.get("month");
  const day = partMap.get("day");
  const hourStr = partMap.get("hour");

  if (!year || !month || !day || !hourStr) {
    throw new Error(`Failed to extract time components for timezone: ${timezone}`);
  }

  let hour = parseInt(hourStr, 10);

  // Normalization for midnight edge cases: Some Node/Intl runtimes return 24 for midnight
  // when hour12 is disabled. Normalize 24 to 00.
  if (hour === 24) {
    hour = 0;
  }

  const localToday = `${year}-${month}-${day}`;
  return { hour, localToday };
}

/**
 * Individual user check-in handler.
 * Encapsulated in its own function to ensure one user's failure does not interrupt the execution.
 */
async function processUserReminder(
  userDoc: admin.firestore.QueryDocumentSnapshot,
  db: admin.firestore.Firestore,
  now: Date
): Promise<void> {
  const userId = userDoc.id;
  const userData = userDoc.data();
  const timezone = userData.timezone;

  if (!timezone || typeof timezone !== "string") {
    logger.info(`User ${userId} skipped: No valid timezone set.`);
    return;
  }

  let hour: number;
  let localToday: string;

  try {
    const timeInfo = getLocalTimeAndDate(timezone, now);
    hour = timeInfo.hour;
    localToday = timeInfo.localToday;
  } catch (err) {
    logger.error(`Error parsing timezone "${timezone}" for user ${userId}:`, err);
    return;
  }

  // 1. Evening Check-In Gate: Only proceed if it is currently between 9:00 PM and 9:59 PM (hour 21) in their local time.
  if (hour !== 21) {
    return;
  }

  // 2. De-duplication Gate: Skip if they already received their 9 PM notification for today's local date.
  const lastReminderSent = userData.lastReminderSent;
  if (lastReminderSent === localToday) {
    logger.info(`User ${userId} already received today's reminder for ${localToday}. Skipping.`);
    return;
  }

  // 3. FCM Token Validation Gate: Combine possible fields and fallback robustly.
  const tokens: string[] = userData.push_subscriptions || userData.fcmTokens || (userData.fcmToken ? [userData.fcmToken] : []);
  const validTokens = tokens.filter(t => typeof t === "string" && t.trim() !== "");

  if (validTokens.length === 0) {
    logger.info(`User ${userId} has no valid FCM tokens registered. Skipping.`);
    return;
  }

  // 4. Friends Check-In Retrieval:
  let uncheckedCount = 0;
  try {
    const peopleSnapshot = await db.collection("people")
      .where("user_id", "==", userId)
      .where("isCloseFriend", "==", true)
      .get();

    const uncheckedCloseFriends = peopleSnapshot.docs.filter(personDoc => {
      const personData = personDoc.data();
      const lastCheckIn = personData.lastCheckIn;
      return !lastCheckIn || lastCheckIn.date !== localToday;
    });

    uncheckedCount = uncheckedCloseFriends.length;
  } catch (err) {
    logger.error(`Error loading close friends for user ${userId}:`, err);
    return;
  }

  // 5. Action Gate: Only send if there's at least one pending close friend connection today
  if (uncheckedCount === 0) {
    logger.info(`User ${userId} is all caught up with close friends today (${localToday}). Skipping.`);
    return;
  }

  // 6. Push Dispatch:
  try {
    const title = "Daily Connection Check-In";
    const body = uncheckedCount === 1
      ? "You have 1 close friend to check in on today."
      : `You have ${uncheckedCount} close friends to check in on today.`;

    const message: admin.messaging.MulticastMessage = {
      tokens: validTokens,
      notification: {
        title,
        body,
      },
      webpush: {
        notification: {
          title,
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
        },
        fcmOptions: {
          link: "/",
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    logger.info(`Notification sent to user ${userId}: ${response.successCount} succeeded, ${response.failureCount} failed.`);

    // 7. Prevent Duplicate Fires: Update de-duplication state immediately upon successful send.
    await db.collection("users").doc(userId).update({
      lastReminderSent: localToday,
    });
  } catch (err) {
    logger.error(`Failed to dispatch FCM push or write state for user ${userId}:`, err);
  }
}

/**
 * Scheduled cloud function that triggers every hour on the hour (0 * * * *).
 */
export const sendScheduledEndOfDayReminders = onSchedule({
  schedule: "0 * * * *",
  timeZone: "UTC",
  memory: "256MiB",
}, async () => {
  const db = admin.firestore();
  const now = new Date();

  logger.info(`Scheduled end-of-day reminders execution started. Global UTC time: ${now.toISOString()}`);

  try {
    const usersSnapshot = await db.collection("users").get();

    const activeUsers = usersSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.timezone && typeof data.timezone === "string";
    });

    logger.info(`Found ${activeUsers.length} users with defined timezones to evaluate.`);

    const CHUNK_SIZE = 50;
    for (let i = 0; i < activeUsers.length; i += CHUNK_SIZE) {
      const chunk = activeUsers.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (userDoc) => {
          try {
            await processUserReminder(userDoc, db, now);
          } catch (err) {
            logger.error(`Unhandled fatal error evaluating user ${userDoc.id}:`, err);
          }
        })
      );
    }

    logger.info("Successfully finished processing scheduled check-in reminders.");
  } catch (err) {
    logger.error("Global scheduled reminders execution failed:", err);
  }
});
