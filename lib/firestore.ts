// ============================================================
// lib/firestore.ts — All Firestore CRUD helpers
// Kept minimal and batched to stay within free-tier limits
// ============================================================
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp,
  orderBy,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Family,
  FamilyMember,
  Medicine,
  MedicineStatusRecord,
  ShoppingItem,
} from "./types";

// ─── Utilities ────────────────────────────────────────────────

export function todayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function statusDocId(date: string, medicineId: string): string {
  return `${date}_${medicineId}`;
}

function fromTimestamp(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  return ts.toDate();
}

// ─── Family ───────────────────────────────────────────────────

export async function getFamily(familyId: string): Promise<Family | null> {
  const snap = await getDoc(doc(db, "families", familyId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: snap.id,
    name: d.name,
    inviteCode: d.inviteCode,
    adminUid: d.adminUid,
    memberUids: d.memberUids ?? [],
    createdAt: fromTimestamp(d.createdAt) ?? new Date(),
  };
}

export async function getFamilyByInviteCode(
  code: string
): Promise<Family | null> {
  const q = query(
    collection(db, "families"),
    where("inviteCode", "==", code.toUpperCase())
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return {
    id: snap.docs[0].id,
    name: d.name,
    inviteCode: d.inviteCode,
    adminUid: d.adminUid,
    memberUids: d.memberUids ?? [],
    createdAt: fromTimestamp(d.createdAt) ?? new Date(),
  };
}

export async function createFamily(
  adminUid: string,
  familyName: string
): Promise<Family> {
  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const ref = doc(collection(db, "families"));
  const family: Omit<Family, "id"> = {
    name: familyName,
    inviteCode,
    adminUid,
    memberUids: [adminUid],
    createdAt: new Date(),
  };
  await setDoc(ref, { ...family, createdAt: serverTimestamp() });
  return { id: ref.id, ...family };
}

export async function addMemberToFamily(
  familyId: string,
  uid: string
): Promise<void> {
  const ref = doc(db, "families", familyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Family not found");
  const existing: string[] = snap.data().memberUids ?? [];
  if (!existing.includes(uid)) {
    await updateDoc(ref, { memberUids: [...existing, uid] });
  }
}

// ─── Users / Family Members ───────────────────────────────────

export async function getUserProfile(uid: string): Promise<FamilyMember | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    uid: snap.id,
    displayName: d.displayName,
    email: d.email,
    familyId: d.familyId,
    fcmToken: d.fcmToken,
    role: d.role ?? "member",
    createdAt: fromTimestamp(d.createdAt) ?? new Date(),
  };
}

export async function createOrUpdateUserProfile(
  uid: string,
  data: Partial<FamilyMember>
): Promise<void> {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getFamilyMembers(
  familyId: string
): Promise<FamilyMember[]> {
  const q = query(
    collection(db, "users"),
    where("familyId", "==", familyId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    uid: d.id,
    displayName: d.data().displayName,
    email: d.data().email,
    familyId: d.data().familyId,
    fcmToken: d.data().fcmToken,
    role: d.data().role ?? "member",
    createdAt: fromTimestamp(d.data().createdAt) ?? new Date(),
  }));
}

export async function saveFcmToken(uid: string, token: string): Promise<void> {
  await updateDoc(doc(db, "users", uid), { fcmToken: token });
}

// ─── Medicines ────────────────────────────────────────────────

export async function addMedicine(
  medicine: Omit<Medicine, "id">
): Promise<string> {
  const ref = doc(collection(db, "medicines"));
  await setDoc(ref, {
    ...medicine,
    startDate: Timestamp.fromDate(medicine.startDate),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

function parseAndFilterMedicines(docs: any[]): Medicine[] {
  const todayDay = new Date().getDay(); // 0=Sunday, 1=Monday... (local calendar)

  return docs
    .map((d) => {
      const data = typeof d.data === "function" ? d.data() : d;
      const id = d.id ?? data.id;
      return {
        id,
        familyId: data.familyId,
        name: data.name,
        time: data.time,
        frequency: data.frequency,
        days: data.days ?? [],
        takenAfterFood: data.takenAfterFood,
        assignedTo: data.assignedTo,
        assignedToUid: data.assignedToUid,
        durationDays: data.durationDays ?? null,
        startDate: fromTimestamp(data.startDate) ?? new Date(),
        createdBy: data.createdBy,
        active: data.active !== false,
      } as Medicine;
    })
    .filter((med) => {
      if (!med.active) return false;
      // Filter by frequency
      if (med.frequency === "daily") return true;
      return Array.isArray(med.days) && med.days.includes(todayDay);
    })
    .filter((med) => {
      // Filter by duration (local calendar dates)
      if (!med.durationDays) return true;
      const start = new Date(med.startDate);
      start.setHours(0, 0, 0, 0);
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((todayDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays < med.durationDays;
    });
}

export function subscribeTodaysMedicines(
  familyId: string,
  callback: (medicines: Medicine[]) => void
): () => void {
  const q = query(
    collection(db, "medicines"),
    where("familyId", "==", familyId),
    where("active", "==", true),
    orderBy("time")
  );

  return onSnapshot(
    q,
    (snap) => {
      const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      console.log(`[Firestore:subscribeTodaysMedicines] familyId="${familyId}" raw medicines count: ${raw.length}`, raw);
      const filtered = parseAndFilterMedicines(snap.docs);
      console.log(`[Firestore:subscribeTodaysMedicines] filtered for today (${new Date().toLocaleDateString()}):`, filtered);
      callback(filtered);
    },
    (err) => {
      console.error("[Firestore:subscribeTodaysMedicines] Error:", err);
    }
  );
}

export async function getTodaysMedicines(familyId: string): Promise<Medicine[]> {
  const q = query(
    collection(db, "medicines"),
    where("familyId", "==", familyId),
    where("active", "==", true),
    orderBy("time")
  );
  const snap = await getDocs(q);
  const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`[Firestore:getTodaysMedicines] familyId="${familyId}" raw fetched count: ${raw.length}`, raw);
  const filtered = parseAndFilterMedicines(snap.docs);
  console.log(`[Firestore:getTodaysMedicines] filtered for today (${new Date().toLocaleDateString()}):`, filtered);
  return filtered;
}

export async function deactivateMedicine(medicineId: string): Promise<void> {
  await updateDoc(doc(db, "medicines", medicineId), { active: false });
}

// ─── Medicine Status ──────────────────────────────────────────

export async function ensureTodaysStatusRecords(
  medicines: Medicine[],
  familyId: string
): Promise<void> {
  if (medicines.length === 0) return;
  const today = todayDateString();
  const batch = writeBatch(db);
  let writeCount = 0;

  for (const med of medicines) {
    const id = statusDocId(today, med.id);
    const ref = doc(db, "medicineStatus", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      batch.set(ref, {
        medicineId: med.id,
        familyId,
        date: today,
        status: "pending",
        markedAt: null,
        markedBy: null,
        markedByName: null,
        notificationSent: false,
        followUpSent: false,
        // Denormalized fields for family view
        medicineName: med.name,
        medicineTime: med.time,
        assignedTo: med.assignedTo,
        takenAfterFood: med.takenAfterFood,
      });
      writeCount++;
    }
  }
  if (writeCount > 0) await batch.commit();
}

export function subscribeTodaysStatus(
  familyId: string,
  callback: (records: MedicineStatusRecord[]) => void
): () => void {
  const today = todayDateString();
  const q = query(
    collection(db, "medicineStatus"),
    where("familyId", "==", familyId),
    where("date", "==", today)
  );

  return onSnapshot(q, (snap) => {
    const records: MedicineStatusRecord[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        medicineId: data.medicineId,
        familyId: data.familyId,
        date: data.date,
        status: data.status,
        markedAt: fromTimestamp(data.markedAt),
        markedBy: data.markedBy ?? null,
        markedByName: data.markedByName ?? null,
        notificationSent: data.notificationSent ?? false,
        followUpSent: data.followUpSent ?? false,
        medicineName: data.medicineName,
        medicineTime: data.medicineTime,
        assignedTo: data.assignedTo,
        takenAfterFood: data.takenAfterFood,
      };
    });
    callback(records);
  });
}

export async function markMedicineStatus(
  statusId: string,
  status: "taken" | "skipped",
  uid: string,
  displayName: string
): Promise<void> {
  await updateDoc(doc(db, "medicineStatus", statusId), {
    status,
    markedAt: serverTimestamp(),
    markedBy: uid,
    markedByName: displayName,
  });
}

export async function getTodaysStatusForFamily(
  familyId: string
): Promise<MedicineStatusRecord[]> {
  const today = todayDateString();
  const q = query(
    collection(db, "medicineStatus"),
    where("familyId", "==", familyId),
    where("date", "==", today)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      medicineId: data.medicineId,
      familyId: data.familyId,
      date: data.date,
      status: data.status,
      markedAt: fromTimestamp(data.markedAt),
      markedBy: data.markedBy ?? null,
      markedByName: data.markedByName ?? null,
      notificationSent: data.notificationSent ?? false,
      followUpSent: data.followUpSent ?? false,
      medicineName: data.medicineName,
      medicineTime: data.medicineTime,
      assignedTo: data.assignedTo,
      takenAfterFood: data.takenAfterFood,
    };
  });
}

// ─── Shopping List ────────────────────────────────────────────

export async function addShoppingItem(
  item: Omit<ShoppingItem, "id" | "addedAt">
): Promise<string> {
  const ref = doc(collection(db, "shoppingItems"));
  await setDoc(ref, {
    familyId: item.familyId,
    itemName: item.itemName.trim(),
    quantity: item.quantity?.trim() || null,
    addedBy: item.addedBy,
    addedByUid: item.addedByUid,
    isBought: false,
    addedAt: serverTimestamp(),
    boughtBy: null,
    boughtByUid: null,
    boughtAt: null,
  });
  return ref.id;
}

export function subscribeShoppingItems(
  familyId: string,
  callback: (items: ShoppingItem[]) => void
): () => void {
  const q = query(
    collection(db, "shoppingItems"),
    where("familyId", "==", familyId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const items: ShoppingItem[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          familyId: data.familyId,
          itemName: data.itemName,
          quantity: data.quantity ?? undefined,
          addedBy: data.addedBy,
          addedByUid: data.addedByUid,
          isBought: data.isBought ?? false,
          addedAt: fromTimestamp(data.addedAt) ?? new Date(),
          boughtBy: data.boughtBy ?? null,
          boughtByUid: data.boughtByUid ?? null,
          boughtAt: fromTimestamp(data.boughtAt),
        };
      });

      // Sort by addedAt descending
      items.sort((a, b) => {
        const timeA = a.addedAt ? a.addedAt.getTime() : 0;
        const timeB = b.addedAt ? b.addedAt.getTime() : 0;
        return timeB - timeA;
      });

      callback(items);
    },
    (err) => {
      console.error("[Firestore:subscribeShoppingItems] Error:", err);
    }
  );
}

export async function toggleShoppingItemBought(
  itemId: string,
  isBought: boolean,
  uid: string,
  displayName: string
): Promise<void> {
  const ref = doc(db, "shoppingItems", itemId);
  await updateDoc(ref, {
    isBought,
    boughtBy: isBought ? displayName : null,
    boughtByUid: isBought ? uid : null,
    boughtAt: isBought ? serverTimestamp() : null,
  });
}

export async function deleteShoppingItem(itemId: string): Promise<void> {
  await deleteDoc(doc(db, "shoppingItems", itemId));
}

export async function clearBoughtShoppingItems(
  itemIds: string[]
): Promise<void> {
  if (itemIds.length === 0) return;
  const batch = writeBatch(db);
  for (const id of itemIds) {
    batch.delete(doc(db, "shoppingItems", id));
  }
  await batch.commit();
}

