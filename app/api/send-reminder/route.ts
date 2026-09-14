// ============================================================
// app/api/send-reminder/route.ts
// Server-side API route to send FCM push notification
// Called from client when a medicine is added/scheduled
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { adminMessaging, adminDB } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  console.log("\n==================================================");
  console.log("[FCM Admin API] /api/send-reminder POST request received");

  if (!adminMessaging) {
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

    // Fallback: If token not provided directly, try looking up user's fcmToken by uid in Firestore
    if (!token && uid && adminDB) {
      console.log(`[FCM Admin API] Token not provided in body, querying Firestore for user uid: ${uid}`);
      const userDoc = await adminDB.collection("users").doc(uid).get();
      if (userDoc.exists) {
        token = userDoc.data()?.fcmToken;
        if (token) {
          console.log("[FCM Admin API] Found fcmToken in Firestore user profile.");
        }
      }
    }

    if (!token) {
      const errorMsg = "Missing FCM token. Please ensure notification permissions are granted and token is saved.";
      console.error("[FCM Admin API] ❌ ERROR:", errorMsg);
      console.log("==================================================\n");
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const medName = medicineName || "Test Medicine";
    const medTime = time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const memberName = assignedTo || "Family Member";
    const foodLabel = takenAfterFood ? "Khane ke baad" : "Khane se pehle";

    const message = {
      token,
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
    };

    console.log(`[FCM Admin API] Attempting to send message to token (prefix: ${token.slice(0, 15)}...)...`);
    const response = await adminMessaging.send(message);
    console.log("[FCM Admin API] ✅ FCM Message sent successfully! Message ID:", response);
    console.log("==================================================\n");
    return NextResponse.json({ success: true, messageId: response });
  } catch (err: unknown) {
    console.error("[FCM Admin API] ❌ FCM send failed with exception:");
    let isUnregistered = false;
    if (err instanceof Error) {
      console.error("  Name:", err.name);
      console.error("  Message:", err.message);
      if (
        err.message.includes("Device unregistered") ||
        err.message.includes("registration-token-not-registered") ||
        err.message.includes("invalid-registration-token")
      ) {
        isUnregistered = true;
      }
    } else {
      console.error("  Unknown error detail:", err);
    }
    console.log("==================================================\n");

    if (isUnregistered) {
      return NextResponse.json(
        {
          error:
            "Device token expired or unregistered. Generating a fresh token for your browser...",
          isUnregistered: true,
        },
        { status: 410 }
      );
    }

    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Send to all family members ─────────────────────────────
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

    // Get all family member FCM tokens
    const usersSnap = await adminDB
      .collection("users")
      .where("familyId", "==", familyId)
      .get();

    const tokens: string[] = [];
    usersSnap.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const token = doc.data().fcmToken as string | undefined;
      if (token) tokens.push(token);
    });

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
