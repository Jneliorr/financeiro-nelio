import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signOut,
  signInAnonymously,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  getDocsFromServer,
  runTransaction,
  waitForPendingWrites,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Transaction, Category, CreditCard, FixedExpense, FinancialProfile } from '../types';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CREDIT_CARDS,
} from '../data/defaultData';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let isGoogleAuthInit = false;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Login helpers
export const checkRedirectLogin = async () => {
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (error) {
    console.error('Redirect login check error:', error);
    return null;
  }
};

export const loginWithGoogle = async () => {
  if (Capacitor.isNativePlatform()) {
    if (!isGoogleAuthInit) {
      await GoogleAuth.initialize({ scopes: ['profile', 'email'] });
      isGoogleAuthInit = true;
    }
    const googleUser = await GoogleAuth.signIn();
    const idToken = googleUser.authentication?.idToken;
    if (!idToken) throw new Error('O Google não retornou uma credencial de login.');
    return signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  }

  // Web / Mobile browser
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: unknown) {
    const errCode = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : '';
    if (errCode === 'auth/popup-blocked' || errCode === 'auth/operation-not-supported-in-this-environment') {
      return await signInWithRedirect(auth, googleProvider);
    }
    throw error;
  }
};

export const loginWithEmail = async (email: string, pass: string) => {
  return await signInWithEmailAndPassword(auth, email, pass);
};

export const registerWithEmail = async (email: string, pass: string, name?: string) => {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  if (name && cred.user) {
    await updateProfile(cred.user, { displayName: name });
  }
  return cred;
};

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);

export const loginAnonymously = async () => {
  try {
    return await signInAnonymously(auth);
  } catch (error) {
    console.warn('Anonymous login not available or disabled in Firebase:', error);
    return null;
  }
};

export const logoutUser = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      try {
        await GoogleAuth.signOut();
      } catch {
        // Ignore if wasn't signed in via native GoogleAuth
      }
    }
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

// Remove undefined values to prevent Firestore crashes
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const cleanObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleanObj[key] = sanitizeForFirestore(value);
      }
    }
    return cleanObj as T;
  }
  return data;
}

export const FINANCE_COLLECTIONS = ['categories', 'creditCards', 'fixedExpenses', 'transactions'] as const;
export type FinanceCollection = (typeof FINANCE_COLLECTIONS)[number];

export async function initializeUserFinance(userId: string, hasExistingData: boolean) {
  const userRef = doc(db, 'users', userId);
  await runTransaction(db, async (transaction) => {
    const user = await transaction.get(userRef);
    if (user.data()?.financeInitialized === true) return;

    if (!hasExistingData && !user.exists()) {
      for (const category of DEFAULT_CATEGORIES) {
        transaction.set(doc(userRef, 'categories', category.id), { ...category, userId });
      }
      for (const card of DEFAULT_CREDIT_CARDS) {
        transaction.set(doc(userRef, 'creditCards', card.id), { ...card, userId });
      }
    }
    transaction.set(userRef, { financeInitialized: true }, { merge: true });
  });
}

export async function confirmUserSync(userId: string) {
  await waitForPendingWrites(db);
  await getDocFromServer(doc(db, 'users', userId));
}

// Complete push of all local data to Firestore
export async function pushAllLocalDataToFirestore(
  userId: string,
  data: {
    categories: Category[];
    creditCards: CreditCard[];
    fixedExpenses: FixedExpense[];
    transactions: Transaction[];
  }
) {
  // Categories
  const catBatch = writeBatch(db);
  data.categories.forEach((cat) => {
    catBatch.set(doc(db, 'users', userId, 'categories', cat.id), sanitizeForFirestore({ ...cat, userId }));
  });
  await catBatch.commit();

  // Credit Cards
  const cardBatch = writeBatch(db);
  data.creditCards.forEach((card) => {
    cardBatch.set(doc(db, 'users', userId, 'creditCards', card.id), sanitizeForFirestore({ ...card, userId }));
  });
  await cardBatch.commit();

  // Fixed Expenses
  const fixedBatch = writeBatch(db);
  data.fixedExpenses.forEach((fe) => {
    fixedBatch.set(doc(db, 'users', userId, 'fixedExpenses', fe.id), sanitizeForFirestore({ ...fe, userId }));
  });
  await fixedBatch.commit();

  // Transactions
  const CHUNK_SIZE = 400;
  for (let i = 0; i < data.transactions.length; i += CHUNK_SIZE) {
    const chunk = data.transactions.slice(i, i + CHUNK_SIZE);
    const txBatch = writeBatch(db);
    chunk.forEach((tx) => {
      txBatch.set(doc(db, 'users', userId, 'transactions', tx.id), sanitizeForFirestore({ ...tx, userId }));
    });
    await txBatch.commit();
  }
}

// ----------------------------------------------------
// MULTI-PROFILE / SUB-ACCOUNTS FIRESTORE HELPERS
// ----------------------------------------------------

export async function saveProfileToFirestore(userId: string, profile: FinancialProfile) {
  const profileRef = doc(db, 'users', userId, 'profiles', profile.id);
  await setDoc(profileRef, sanitizeForFirestore({ ...profile, userId }));
}

export async function deleteProfileFromFirestore(userId: string, profileId: string) {
  // 1. Delete profile doc
  const profileRef = doc(db, 'users', userId, 'profiles', profileId);
  await deleteDoc(profileRef);

  // 2. Delete transactions in subcollection
  try {
    const txSnap = await getDocs(collection(db, 'users', userId, 'profiles', profileId, 'transactions'));
    const txBatch = writeBatch(db);
    txSnap.forEach((d) => txBatch.delete(d.ref));
    await txBatch.commit();

    // 3. Delete categories
    const catSnap = await getDocs(collection(db, 'users', userId, 'profiles', profileId, 'categories'));
    const catBatch = writeBatch(db);
    catSnap.forEach((d) => catBatch.delete(d.ref));
    await catBatch.commit();

    // 4. Delete cards
    const cardSnap = await getDocs(collection(db, 'users', userId, 'profiles', profileId, 'creditCards'));
    const cardBatch = writeBatch(db);
    cardSnap.forEach((d) => cardBatch.delete(d.ref));
    await cardBatch.commit();

    // 5. Delete fixed expenses
    const fixedSnap = await getDocs(collection(db, 'users', userId, 'profiles', profileId, 'fixedExpenses'));
    const fixedBatch = writeBatch(db);
    fixedSnap.forEach((d) => fixedBatch.delete(d.ref));
    await fixedBatch.commit();
  } catch (err) {
    console.warn('Warning deleting subcollections for profile:', err);
  }
}

export async function pushProfileDataToFirestore(
  userId: string,
  profileId: string,
  data: {
    categories: Category[];
    creditCards: CreditCard[];
    fixedExpenses: FixedExpense[];
    transactions: Transaction[];
  }
) {
  if (profileId === 'default') {
    // Sync both to default profile subcollection AND legacy root for maximum safety
    await pushAllLocalDataToFirestore(userId, data);
  }

  // Save to profile subcollection
  const catBatch = writeBatch(db);
  data.categories.forEach((cat) => {
    catBatch.set(
      doc(db, 'users', userId, 'profiles', profileId, 'categories', cat.id),
      sanitizeForFirestore({ ...cat, profileId, userId })
    );
  });
  await catBatch.commit();

  const cardBatch = writeBatch(db);
  data.creditCards.forEach((card) => {
    cardBatch.set(
      doc(db, 'users', userId, 'profiles', profileId, 'creditCards', card.id),
      sanitizeForFirestore({ ...card, profileId, userId })
    );
  });
  await cardBatch.commit();

  const fixedBatch = writeBatch(db);
  data.fixedExpenses.forEach((fe) => {
    fixedBatch.set(
      doc(db, 'users', userId, 'profiles', profileId, 'fixedExpenses', fe.id),
      sanitizeForFirestore({ ...fe, profileId, userId })
    );
  });
  await fixedBatch.commit();

  const CHUNK_SIZE = 400;
  for (let i = 0; i < data.transactions.length; i += CHUNK_SIZE) {
    const chunk = data.transactions.slice(i, i + CHUNK_SIZE);
    const txBatch = writeBatch(db);
    chunk.forEach((tx) => {
      txBatch.set(
        doc(db, 'users', userId, 'profiles', profileId, 'transactions', tx.id),
        sanitizeForFirestore({ ...tx, profileId, userId })
      );
    });
    await txBatch.commit();
  }
}

/**
 * Clears all transactions and fixed expenses from Firestore for the given user,
 * keeping categories and credit cards intact for a clean slate.
 */
export async function clearUserFirestoreTransactionsAndFixed(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const profiles = await getDocsFromServer(collection(userRef, 'profiles'));
  const accounts = [userRef, ...profiles.docs.map((profile) => profile.ref)];
  for (const account of accounts) {
    for (const name of ['fixedExpenses', 'transactions']) {
      const { docs } = await getDocsFromServer(collection(account, name));
      for (let offset = 0; offset < docs.length; offset += 400) {
        const batch = writeBatch(db);
        docs.slice(offset, offset + 400).forEach((entry) => batch.delete(entry.ref));
        await batch.commit();
      }
    }
  }
}


