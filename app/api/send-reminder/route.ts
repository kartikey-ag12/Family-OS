import { NextRequest, NextResponse } from "next/server";
import { adminMessaging, adminDB } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  console.log("\n==================================================");
  console.log("[FCM Admin API] /api/send-reminder POST request received");

  if (!adminMessaging || !adminDB) {
    const errorMsg =
      "Firebase Admin Messaging SDK is not initialized. Please verify FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in .env.local";
    console.error("[FCM Admin API] ❌ ERROR:", errorMsg);
    console.log("==================================================\n");
    return NextResponse.json({ error: errorMsg }, { status: 503 });
  }

  try {
    const body = await req.json();
    let { token, medicineName, time, takenAfterFood, assignedTo, uid } = body;

    console.log("[FCM Admin API] Request payload:", {
      tokenProvided: !!token,
      uidProvided: !!uid,
      medicineName,
      time,
      takenAfterFood,
      assignedTo,
    });

    const targetTokens = new Set<string>();
    if (token) targetTokens.add(token);

    // If uid provided, gather all active device tokens from user profile
    if (uid) {
      const userDoc = await adminDB.collection("users").doc(uid).get();
      if (userDoc.exists) {
        const uData = userDoc.data();
        if (Array.isArray(uData?.fcmTokens)) {
          uData.fcmTokens.forEach((t: string) => {
            if (t) targetTokens.add(t);
          });
        }
        if (uData?.fcmToken) {
          targetTokens.add(uData.fcmToken);
        }
      }
    }

    const tokenList = Array.from(targetTokens);
    if (tokenList.length === 0) {
      const errorMsg = "Missing FCM token. Please ensure notification permissions are granted on your device.";
      console.error("[FCM Admin API] ❌ ERROR:", errorMsg);
      console.log("==================================================\n");
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const medName = medicineName || "Test Medicine";
    const medTime = time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const memberName = assignedTo || "Family Member";
    const foodLabel = takenAfterFood ? "Khane ke baad" : "Khane se pehle";

    const messages = tokenList.map((t) => ({
      token: t,
      notification: {
        title: `💊 Dawai yaad hai! — ${memberName}`,
        body: `${medName} leni hai (${foodLabel}) — ${medTime}`,
      },
      webpush: {
        notification: {
          title: `💊 Dawai yaad hai! — ${memberName}`,
          body: `${medName} leni hai (${foodLabel}) — ${medTime}`,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          requireInteraction: true,
          actions: [
            { action: "taken", title: "✅ Le li" },
            { action: "dismiss", title: "Baad mein" },
          ],
        },
        fcmOptions: {
          link: "/home",
        },
      },
      data: {
        title: `💊 Dawai yaad hai! — ${memberName}`,
        body: `${medName} leni hai (${foodLabel}) — ${medTime}`,
        medicineName: String(medName),
        time: String(medTime),
        assignedTo: String(memberName),
        url: "/home",
      },
    }));

    console.log(`[FCM Admin API] Sending push notification to ${tokenList.length} device(s)...`);
    const batchResponse = await adminMessaging.sendEach(messages);
    console.log(`[FCM Admin API] Result: ${batchResponse.successCount} sent, ${batchResponse.failureCount} failed.`);

    // Clean up dead/unregistered tokens
    const deadTokens: string[] = [];
    batchResponse.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const errCode = resp.error.code;
        if (
          errCode === "messaging/registration-token-not-registered" ||
          errCode === "messaging/invalid-registration-token"
        ) {
          deadTokens.push(tokenList[idx]);
        }
      }
    });

    if (deadTokens.length > 0 && uid) {
      console.log(`[FCM Admin API] Cleaning up ${deadTokens.length} expired token(s) for user ${uid}`);
      await adminDB
        .collection("users")
        .doc(uid)
        .update({
          fcmTokens: FieldValue.arrayRemove(...deadTokens),
        })
        .catch((err) => console.warn("Failed to remove dead token:", err));
    }

    console.log("==================================================\n");

    if (batchResponse.successCount === 0 && batchResponse.failureCount > 0) {
      return NextResponse.json(
        {
          error: "Device tokens expired or unregistered. Please refresh to register a fresh token.",
          isUnregistered: true,
        },
        { status: 410 }
      );
    }

    return NextResponse.json({
      success: true,
      sentCount: batchResponse.successCount,
      failedCount: batchResponse.failureCount,
    });
  } catch (err: unknown) {
    console.error("[FCM Admin API] ❌ FCM send failed with exception:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Send to all family members across all their devices ─────
export async function PUT(req: NextRequest) {
  if (!adminMessaging || !adminDB) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }
  try {
    const body = await req.json();
    const { familyId, medicineName, time, takenAfterFood, assignedTo } = body;

    if (!familyId) {
      return NextResponse.json({ error: "Missing familyId" }, { status: 400 });
    }

    // Get all family members' FCM tokens (mapping token -> uid for cleanup)
    const usersSnap = await adminDB
      .collection("users")
      .where("familyId", "==", familyId)
      .get();

    const tokenToUidMap = new Map<string, string>();
    usersSnap.forEach((doc) => {
      const uData = doc.data();
      const uid = doc.id;
      if (Array.isArray(uData.fcmTokens)) {
        uData.fcmTokens.forEach((t: string) => {
          if (t) tokenToUidMap.set(t, uid);
        });
      }
      if (uData.fcmToken) {
        tokenToUidMap.set(uData.fcmToken, uid);
      }
    });

    const tokens = Array.from(tokenToUidMap.keys());
    if (tokens.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const foodLabel = takenAfterFood ? "Khane ke baad" : "Khane se pehle";

    const messages = tokens.map((token) => ({
      token,
      notification: {
        title: `💊 Follow-up: ${assignedTo} ki dawai!`,
        body: `${medicineName} (${foodLabel}) abhi tak mark nahi hui — ${time}`,
      },
      webpush: {
        notification: {
          title: `💊 Follow-up: ${assignedTo} ki dawai!`,
          body: `${medicineName} (${foodLabel}) abhi tak mark nahi hui — ${time}`,
          icon: "/icons/icon-192.png",
          requireInteraction: true,
        },
        fcmOptions: { link: "/home" },
      },
      data: {
        title: `💊 Follow-up: ${assignedTo} ki dawai!`,
        body: `${medicineName} (${foodLabel}) abhi tak mark nahi hui — ${time}`,
        medicineName: String(medicineName),
        time: String(time),
        assignedTo: String(assignedTo),
        url: "/home",
      },
    }));

    const batchResponse = await adminMessaging.sendEach(messages);

    // Clean up dead tokens for respective users
    const userToDeadTokens = new Map<string, string[]>();
    batchResponse.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const errCode = resp.error.code;
        if (
          errCode === "messaging/registration-token-not-registered" ||
          errCode === "messaging/invalid-registration-token"
        ) {
          const deadToken = tokens[idx];
          const uid = tokenToUidMap.get(deadToken);
          if (uid) {
            const list = userToDeadTokens.get(uid) || [];
            list.push(deadToken);
            userToDeadTokens.set(uid, list);
          }
        }
      }
    });

    for (const [uid, deadList] of userToDeadTokens.entries()) {
      await adminDB
        .collection("users")
        .doc(uid)
        .update({
          fcmTokens: FieldValue.arrayRemove(...deadList),
        })
        .catch(console.warn);
    }

    return NextResponse.json({
      success: true,
      sent: batchResponse.successCount,
      failed: batchResponse.failureCount,
    });
  } catch (err: unknown) {
    console.error("FCM batch send error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
