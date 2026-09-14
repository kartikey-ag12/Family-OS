// ============================================================
// app/api/cron/check-reminders/route.ts
// Automatic scheduled medicine reminder & follow-up checker
// Triggered via Vercel Cron or external cron (e.g. cron-job.org)
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { adminMessaging, adminDB } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// Helper to get time and date in IST (Indian Standard Time, UTC+5:30)
function getISTInfo() {
  const now = new Date();
  const timeZone = process.env.TIMEZONE || "Asia/Kolkata";

  // Format date as YYYY-MM-DD
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  // Format current time as HH:MM (24-hour)
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  // Calculate day of week in IST (0 = Sunday, 1 = Monday, ...)
  const istDate = new Date(now.toLocaleString("en-US", { timeZone }));
  const dayOfWeek = istDate.getDay();

  // 30 minutes ago (for follow-up check)
  const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);
  const time30MinsAgo = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(thirtyMinsAgo);

  return {
    dateStr: dateParts,
    currentTime: timeParts,
    dayOfWeek,
    time30MinsAgo,
    timestamp: now.toISOString(),
  };
}

async function processReminders(req: NextRequest) {
  // ─── 1. Authorization Check ──────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const searchKey = req.nextUrl.searchParams.get("key");

  if (cronSecret) {
    const isAuthorized =
      authHeader === `Bearer ${cronSecret}` ||
      searchKey === cronSecret ||
      (isVercelCron && authHeader === `Bearer ${cronSecret}`);

    if (!isAuthorized) {
      console.warn("[Cron API] ❌ Unauthorized request to /api/cron/check-reminders");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ─── 2. Validate Firebase Admin SDK ─────────────────────────
  if (!adminDB || !adminMessaging) {
    const errorMsg = "Firebase Admin SDK is not configured.";
    console.error("[Cron API] ❌ ERROR:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 503 });
  }

  const { dateStr, currentTime, dayOfWeek, time30MinsAgo } = getISTInfo();
  console.log(`\n==================================================`);
  console.log(`[Cron API] Checking medicine reminders for ${dateStr} at ${currentTime} IST (Follow-up target: ${time30MinsAgo})`);

  let remindersSent = 0;
  let followUpsSent = 0;
  const errors: string[] = [];

  try {
    // ─── 3. Query All Active Medicines ─────────────────────────
    const medicinesSnap = await adminDB
      .collection("medicines")
      .where("active", "==", true)
      .get();

    if (medicinesSnap.empty) {
      console.log("[Cron API] No active medicines found.");
      return NextResponse.json({
        success: true,
        date: dateStr,
        time: currentTime,
        remindersSent: 0,
        followUpsSent: 0,
      });
    }

    // Cache user FCM tokens to avoid redundant Firestore reads
    const userTokenCache = new Map<string, string | null>();
    async function getUserToken(uid: string): Promise<string | null> {
      if (userTokenCache.has(uid)) return userTokenCache.get(uid)!;
      try {
        const userDoc = await adminDB!.collection("users").doc(uid).get();
        const token = (userDoc.data()?.fcmToken as string) || null;
        userTokenCache.set(uid, token);
        return token;
      } catch {
        return null;
      }
    }

    // Process each medicine
    for (const doc of medicinesSnap.docs) {
      const med = doc.data();
      const medId = doc.id;

      // Filter by days of week / frequency
      if (med.frequency !== "daily") {
        const days: number[] = Array.isArray(med.days) ? med.days : [];
        if (!days.includes(dayOfWeek)) {
          continue; // Not scheduled for today
        }
      }

      // Filter by duration if set
      if (med.durationDays && med.startDate) {
        const startDate =
          typeof med.startDate.toDate === "function"
            ? med.startDate.toDate()
            : new Date(med.startDate);
        startDate.setHours(0, 0, 0, 0);
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const diffDays = Math.floor(
          (todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffDays < 0 || diffDays >= med.durationDays) {
          continue; // Out of active date range
        }
      }

      const statusDocId = `${dateStr}_${medId}`;
      const statusRef = adminDB.collection("medicineStatus").doc(statusDocId);
      const statusSnap = await statusRef.get();

      let statusData = statusSnap.exists ? statusSnap.data() : null;

      // If status record does not exist for today, create it
      if (!statusData) {
        statusData = {
          medicineId: medId,
          familyId: med.familyId,
          date: dateStr,
          status: "pending",
          markedAt: null,
          markedBy: null,
          markedByName: null,
          notificationSent: false,
          followUpSent: false,
          medicineName: med.name,
          medicineTime: med.time,
          assignedTo: med.assignedTo,
          takenAfterFood: med.takenAfterFood ?? true,
        };
        await statusRef.set(statusData);
      }

      // ─── 4. Check Scheduled Time Reminder ────────────────────
      if (med.time === currentTime) {
        if (statusData.status === "pending" && !statusData.notificationSent) {
          const assignedUid = med.assignedToUid || med.createdBy;
          const token = assignedUid ? await getUserToken(assignedUid) : null;

          if (token) {
            const foodLabel = med.takenAfterFood ? "Khane ke baad" : "Khane se pehle";
            try {
              await adminMessaging.send({
                token,
                notification: {
                  title: `💊 Dawai yaad hai! — ${med.assignedTo}`,
                  body: `${med.name} leni hai (${foodLabel}) — ${med.time}`,
                },
                webpush: {
                  notification: {
                    title: `💊 Dawai yaad hai! — ${med.assignedTo}`,
                    body: `${med.name} leni hai (${foodLabel}) — ${med.time}`,
                    icon: "/icons/icon-192.png",
                    badge: "/icons/icon-192.png",
                    requireInteraction: true,
                    actions: [
                      { action: "taken", title: "✅ Le li" },
                      { action: "dismiss", title: "Baad mein" },
                    ],
                  },
                  fcmOptions: { link: "/home" },
                },
                data: {
                  medicineName: String(med.name),
                  time: String(med.time),
                  assignedTo: String(med.assignedTo),
                },
              });

              await statusRef.set(
                {
                  notificationSent: true,
                  notifiedAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
              );

              remindersSent++;
              console.log(`[Cron API] ✅ Sent reminder for "${med.name}" to ${med.assignedTo}`);
            } catch (sendErr: unknown) {
              const msg = sendErr instanceof Error ? sendErr.message : "FCM send error";
              console.error(`[Cron API] ❌ Failed to send reminder for "${med.name}":`, msg);
              errors.push(`Reminder error for ${med.name}: ${msg}`);
            }
          } else {
            console.log(`[Cron API] ⚠️ No FCM token found for ${med.assignedTo} (${assignedUid})`);
          }
        }
      }

      // ─── 5. Check 30-Minute Follow-up Reminder ────────────────
      if (med.time === time30MinsAgo) {
        if (statusData.status === "pending" && !statusData.followUpSent) {
          // Medicine still not taken after 30 minutes -> Notify all family members
          try {
            const familyUsersSnap = await adminDB
              .collection("users")
              .where("familyId", "==", med.familyId)
              .get();

            const familyTokens: string[] = [];
            familyUsersSnap.forEach((uDoc) => {
              const fcm = uDoc.data().fcmToken as string | undefined;
              if (fcm) familyTokens.push(fcm);
            });

            if (familyTokens.length > 0) {
              const foodLabel = med.takenAfterFood ? "Khane ke baad" : "Khane se pehle";
              const messages = familyTokens.map((token) => ({
                token,
                notification: {
                  title: `⚠️ Follow-up: ${med.assignedTo} ki dawai!`,
                  body: `${med.name} (${foodLabel}) abhi tak mark nahi hui — ${med.time}`,
                },
                webpush: {
                  notification: {
                    title: `⚠️ Follow-up: ${med.assignedTo} ki dawai!`,
                    body: `${med.name} (${foodLabel}) abhi tak mark nahi hui — ${med.time}`,
                    icon: "/icons/icon-192.png",
                    requireInteraction: true,
                  },
                  fcmOptions: { link: "/home" },
                },
              }));

              await adminMessaging.sendEach(messages);
              await statusRef.set(
                {
                  followUpSent: true,
                  followUpAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
              );

              followUpsSent++;
              console.log(`[Cron API] ⚠️ Sent follow-up for "${med.name}" to ${familyTokens.length} family member(s)`);
            }
          } catch (followUpErr: unknown) {
            const msg = followUpErr instanceof Error ? followUpErr.message : "Followup error";
            console.error(`[Cron API] ❌ Follow-up error for "${med.name}":`, msg);
            errors.push(`Followup error for ${med.name}: ${msg}`);
          }
        }
      }
    }

    console.log(`[Cron API] Completed. Reminders sent: ${remindersSent}, Follow-ups sent: ${followUpsSent}`);
    console.log(`==================================================\n`);

    return NextResponse.json({
      success: true,
      date: dateStr,
      time: currentTime,
      remindersSent,
      followUpsSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: unknown) {
    console.error("[Cron API] ❌ Uncaught error during reminder check:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Support both GET and POST so Vercel Cron and external webhooks can trigger it
export async function GET(req: NextRequest) {
  return processReminders(req);
}

export async function POST(req: NextRequest) {
  return processReminders(req);
}
