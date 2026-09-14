// ============================================================
// lib/types.ts — Shared TypeScript types for Family OS
// ============================================================

export type Frequency = "daily" | "specific_days";
export type MedicineStatus = "pending" | "taken" | "skipped";

export interface FamilyMember {
  uid: string;
  displayName: string;
  email: string;
  familyId: string;
  fcmToken?: string; // latest token (backwards compatibility)
  fcmTokens?: string[]; // all active device tokens
  role: "admin" | "member";
  createdAt: Date;
}

export interface Medicine {
  id: string;
  familyId: string;
  name: string;
  time: string; // "08:00"
  frequency: Frequency;
  days: number[]; // [0,1,2,3,4,5,6] — 0=Sunday. Empty means daily.
  takenAfterFood: boolean;
  assignedTo: string; // displayName
  assignedToUid: string;
  durationDays: number | null; // null = ongoing
  startDate: Date;
  createdBy: string; // uid
  active: boolean;
}

export interface MedicineStatusRecord {
  id: string; // "{YYYY-MM-DD}_{medicineId}"
  medicineId: string;
  familyId: string;
  date: string; // "YYYY-MM-DD"
  status: MedicineStatus;
  markedAt: Date | null;
  markedBy: string | null; // uid
  markedByName: string | null;
  notificationSent: boolean;
  followUpSent: boolean;
  // Denormalized for easy family view display
  medicineName: string;
  medicineTime: string;
  assignedTo: string;
  takenAfterFood: boolean;
}

export interface Family {
  id: string;
  name: string;
  inviteCode: string; // 6-char code to join family
  adminUid: string;
  memberUids: string[];
  createdAt: Date;
}

export interface ShoppingItem {
  id: string;
  familyId: string;
  itemName: string;
  quantity?: string; // e.g. "2 kilo", "1 packet"
  addedBy: string; // displayName
  addedByUid: string;
  isBought: boolean;
  addedAt: Date;
  boughtBy?: string | null;
  boughtByUid?: string | null;
  boughtAt?: Date | null;
}

