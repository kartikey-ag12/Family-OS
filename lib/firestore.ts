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
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Family,
  FamilyMember,
  Medicine,
  MedicineStatusRecord,
  ShoppingItem,
  Expense,
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
  const fcmTokens: string[] = Array.isArray(d.fcmTokens)
    ? d.fcmTokens
    : d.fcmToken
    ? [d.fcmToken]
    : [];

  return {
    uid: snap.id,
    displayName: d.displayName,
    nickname: d.nickname || d.displayName,
    email: d.email,
    familyId: d.familyId,
    fcmToken: d.fcmToken ?? (fcmTokens.length > 0 ? fcmTokens[fcmTokens.length - 1] : undefined),
    fcmTokens,
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

export async function updateUserNickname(uid: string, nickname: string): Promise<void> {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, {
    nickname: nickname.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function getFamilyMembers(
  familyId: string
): Promise<FamilyMember[]> {
  const q = query(
    collection(db, "users"),
    where("familyId", "==", familyId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const fcmTokens: string[] = Array.isArray(data.fcmTokens)
      ? data.fcmTokens
      : data.fcmToken
      ? [data.fcmToken]
      : [];

    return {
      uid: d.id,
      displayName: data.displayName,
      nickname: data.nickname || data.displayName,
      email: data.email,
      familyId: data.familyId,
      fcmToken: data.fcmToken ?? (fcmTokens.length > 0 ? fcmTokens[fcmTokens.length - 1] : undefined),
      fcmTokens,
      role: data.role ?? "member",
      createdAt: fromTimestamp(data.createdAt) ?? new Date(),
    };
  });
}

export async function saveFcmToken(uid: string, token: string): Promise<void> {
  const ref = doc(db, "users", uid);
  await setDoc(
    ref,
    {
      fcmTokens: arrayUnion(token),
      fcmToken: token,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function removeFcmToken(uid: string, token: string): Promise<void> {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, {
    fcmTokens: arrayRemove(token),
  });
}

// ─── Medicines ────────────────────────────────────────────────

export async function addMedicine(
  medicine: Omit<Medicine, "id">
): Promise<string> {
  const ref = doc(collection(db, "medicines"));
  const startDate = medicine.startDate || new Date();

  await setDoc(ref, {
    familyId: medicine.familyId,
    name: medicine.name.trim(),
    time: medicine.time,
    frequency: medicine.frequency || "daily",
    days: medicine.days && medicine.days.length > 0 ? medicine.days : [0, 1, 2, 3, 4, 5, 6],
    takenAfterFood: medicine.takenAfterFood !== undefined ? medicine.takenAfterFood : true,
    assignedTo: medicine.assignedTo || "Family Member",
    assignedToUid: medicine.assignedToUid,
    durationDays: medicine.durationDays ?? null,
    startDate: Timestamp.fromDate(startDate),
    createdBy: medicine.createdBy,
    active: true,
    createdAt: serverTimestamp(),
  });

  // Ensure initial today's status record is created immediately
  try {
    const today = todayDateString();
    const statusRef = doc(db, "medicineStatus", statusDocId(today, ref.id));
    await setDoc(
      statusRef,
      {
        medicineId: ref.id,
        familyId: medicine.familyId,
        date: today,
        status: "pending",
        markedAt: null,
        markedBy: null,
        markedByName: null,
        notificationSent: false,
        followUpSent: false,
        medicineName: medicine.name.trim(),
        medicineTime: medicine.time,
        assignedTo: medicine.assignedTo || "Family Member",
        takenAfterFood: medicine.takenAfterFood !== undefined ? medicine.takenAfterFood : true,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("Initial status record creation warning:", err);
  }

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
    where("familyId", "==", familyId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const filtered = parseAndFilterMedicines(snap.docs);
      // Sort by scheduled time ascending
      filtered.sort((a, b) => a.time.localeCompare(b.time));
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
    where("familyId", "==", familyId)
  );
  const snap = await getDocs(q);
  const filtered = parseAndFilterMedicines(snap.docs);
  filtered.sort((a, b) => a.time.localeCompare(b.time));
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
  item: Omit<ShoppingItem, "id" | "addedAt"> & { name?: string }
): Promise<string> {
  const name = (item.itemName || item.name || "").trim();
  if (!name) {
    throw new Error("addShoppingItem: itemName is required");
  }
  const ref = doc(collection(db, "shoppingItems"));
  await setDoc(ref, {
    familyId: item.familyId,
    itemName: name,
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

// ─── Expenses (Ghar ka Hisab) ─────────────────────────────────

export async function addExpense(
  expense: Omit<Expense, "id" | "createdAt">
): Promise<string> {
  const ref = doc(collection(db, "expenses"));
  await setDoc(ref, {
    familyId: expense.familyId,
    amount: Number(expense.amount),
    category: expense.category,
    note: expense.note?.trim() || null,
    addedBy: expense.addedBy,
    addedByUid: expense.addedByUid,
    date: Timestamp.fromDate(expense.date),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function subscribeExpenses(
  familyId: string,
  callback: (expenses: Expense[]) => void
): () => void {
  const q = query(
    collection(db, "expenses"),
    where("familyId", "==", familyId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list: Expense[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          familyId: data.familyId,
          amount: Number(data.amount) || 0,
          category: data.category,
          note: data.note ?? undefined,
          addedBy: data.addedBy,
          addedByUid: data.addedByUid,
          date: fromTimestamp(data.date) ?? new Date(),
          createdAt: fromTimestamp(data.createdAt) ?? new Date(),
        };
      });

      // Sort by date descending (most recent first)
      list.sort((a, b) => b.date.getTime() - a.date.getTime());

      callback(list);
    },
    (err) => {
      console.error("[Firestore:subscribeExpenses] Error:", err);
    }
  );
}

export async function deleteExpense(expenseId: string): Promise<void> {
  await deleteDoc(doc(db, "expenses", expenseId));
}


