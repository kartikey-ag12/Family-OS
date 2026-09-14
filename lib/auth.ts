// ============================================================
// lib/auth.ts — Firebase Auth helpers
// ============================================================
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";
import {
  createFamily,
  createOrUpdateUserProfile,
  getFamilyByInviteCode,
  addMemberToFamily,
} from "./firestore";

export { onAuthStateChanged };
export type { User };

export async function signUp(
  email: string,
  password: string,
  displayName: string,
  familyOption: { type: "create"; familyName: string } | { type: "join"; inviteCode: string }
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  // Set display name
  await updateProfile(user, { displayName });

  let familyId: string;

  if (familyOption.type === "create") {
    const family = await createFamily(user.uid, familyOption.familyName);
    familyId = family.id;
  } else {
    const family = await getFamilyByInviteCode(familyOption.inviteCode);
    if (!family) throw new Error("Invalid family invite code. Please check and try again.");
    await addMemberToFamily(family.id, user.uid);
    familyId = family.id;
  }

  // Create user profile in Firestore
  await createOrUpdateUserProfile(user.uid, {
    uid: user.uid,
    displayName,
    email,
    familyId,
    role: familyOption.type === "create" ? "admin" : "member",
  });

  return user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logOut(): Promise<void> {
  await signOut(auth);
}
