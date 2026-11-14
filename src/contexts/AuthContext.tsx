import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from '../lib/firebase';
import type { ServerKeyUsage, UserProfile } from '../types';

const MAIN_ADMIN_EMAIL = 'predimahrobi@gmail.com';
const BOOTSTRAP_ADMIN_EMAILS = new Set([MAIN_ADMIN_EMAIL, 'sp.freemusichub@gmail.com']);
const EMAIL_SESSION_STORAGE_KEY = 'efemmakomik_email_session_token';
const LEGACY_EMAIL_SESSION_STORAGE_KEY = 'nusakomik_email_session_token';

export function generateApiKey(isAdmin: boolean): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let token = '';
  for (let i = 0; i < bytes.length; i += 1) {
    token += chars[bytes[i] % chars.length];
  }
  return `${isAdmin ? 'kmk_adm_' : 'kmk_usr_'}${token}`;
}

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  liveUsage: ServerKeyUsage | null;
  loading: boolean;
  authError: string | null;
  needsEmailVerification: boolean;
  authModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (displayName: string, email: string, password: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  reloadVerificationStatus: () => Promise<boolean>;
  logoutConfirmOpen: boolean;
  requestSignOut: () => void;
  cancelSignOut: () => void;
  confirmSignOut: () => Promise<void>;
  signOutUser: () => Promise<void>;
  regenerateApiKey: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function usageToProfile(usage: ServerKeyUsage): UserProfile {
  return {
    uid: usage.uid,
    email: usage.email,
    displayName: usage.displayName,
    photoURL: '',
    role: usage.role,
    plan: usage.plan,
    apiKey: usage.apiKey,
    dailyLimit: usage.dailyLimit,
    monthlyLimit: usage.monthlyLimit,
    requestsThisMonth: usage.requestsThisMonth,
    usageMonth: usage.usageMonth,
    packageId: usage.packageId,
    packageName: usage.packageName,
    requestsToday: usage.requestsToday,
    requestsTotal: usage.requestsTotal,
    status: usage.status,
  };
}

function mapFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email atau password tidak sesuai.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'Email sudah terdaftar. Silakan masuk dengan password Anda.';
  }
  if (code === 'auth/weak-password') {
    return 'Password minimal harus 6 karakter.';
  }
  if (code === 'auth/invalid-email') {
    return 'Format email tidak valid.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Provider Email/Password belum diaktifkan di Firebase Console. Aktifkan di Authentication -> Sign-in method -> Email/Password, atau gunakan Google OAuth.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Login Google dibatalkan sebelum selesai.';
  }
  return err instanceof Error ? err.message : 'Autentikasi gagal.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [liveUsage, setLiveUsage] = useState<ServerKeyUsage | null>(null);
  const [backendSessionToken, setBackendSessionToken] = useState<string | null>(() => {
    try {
      if (typeof window === 'undefined') return null;
      return (
        window.localStorage.getItem(EMAIL_SESSION_STORAGE_KEY) ||
        window.localStorage.getItem(LEGACY_EMAIL_SESSION_STORAGE_KEY)
      );
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const openAuthModal = useCallback(() => {
    setAuthError(null);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const syncWithBackend = useCallback(async (fbUser: User, profile: UserProfile) => {
    try {
      const idToken = await fbUser.getIdToken();
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          apiKey: profile.apiKey,
          role: profile.role,
          plan: profile.plan,
          dailyLimit: profile.dailyLimit,
          status: profile.status,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { status: boolean; data?: ServerKeyUsage };
        if (json.data) {
          setLiveUsage(json.data);
          setUserProfile((prev) =>
            prev
              ? {
                  ...prev,
                  plan: json.data!.plan,
                  role: json.data!.role,
                  dailyLimit: json.data!.dailyLimit,
                  monthlyLimit: json.data!.monthlyLimit,
                  requestsThisMonth: json.data!.requestsThisMonth,
                  usageMonth: json.data!.usageMonth,
                  packageId: json.data!.packageId,
                  packageName: json.data!.packageName,
                }
              : prev
          );
        }
      }
    } catch {
      // Non-blocking backend sync
    }
  }, []);

  const ensureUserProfile = useCallback(
    async (fbUser: User) => {
      if (!fbUser.emailVerified) {
        setNeedsEmailVerification(true);
        setUserProfile(null);
        setLiveUsage(null);
        return;
      }

      setNeedsEmailVerification(false);
      const userPath = `users/${fbUser.uid}`;
      const userRef = doc(db, 'users', fbUser.uid);
      const isBootstrapAdmin =
        BOOTSTRAP_ADMIN_EMAILS.has((fbUser.email || '').toLowerCase()) && fbUser.emailVerified;

      let snap;
      try {
        snap = await getDoc(userRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, userPath);
      }

      const safeName = (fbUser.displayName || fbUser.email?.split('@')[0] || 'Developer').slice(0, 120);
      const safePhoto = (fbUser.photoURL || '').slice(0, 500);
      const safeEmail = (fbUser.email || '').slice(0, 254);

      if (!snap.exists()) {
        let freeLimit = 10;
        try {
          const settingsRes = await fetch('/api/public/settings');
          if (settingsRes.ok) {
            const sJson = (await settingsRes.json()) as { status: boolean; data?: { freeDailyTokens?: number } };
            if (typeof sJson.data?.freeDailyTokens === 'number' && sJson.data.freeDailyTokens > 0) {
              freeLimit = sJson.data.freeDailyTokens;
            }
          }
        } catch {
          // fallback to 10
        }

        const newProfile: UserProfile = {
          uid: fbUser.uid,
          email: safeEmail,
          displayName: safeName,
          photoURL: safePhoto,
          role: isBootstrapAdmin ? 'admin' : 'user',
          plan: isBootstrapAdmin ? 'admin_unlimited' : 'free',
          apiKey: generateApiKey(isBootstrapAdmin),
          dailyLimit: isBootstrapAdmin ? -1 : freeLimit,
          requestsToday: 0,
          requestsTotal: 0,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        };

        try {
          await setDoc(userRef, newProfile);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, userPath);
        }

        setUserProfile(newProfile);
        await syncWithBackend(fbUser, newProfile);
      } else {
        const existing = snap.data() as UserProfile;
        const updates: Record<string, unknown> = {
          displayName: safeName,
          photoURL: safePhoto,
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (isBootstrapAdmin && existing.role !== 'admin') {
          updates.role = 'admin';
          updates.plan = 'admin_unlimited';
          updates.dailyLimit = -1;
        }

        try {
          await updateDoc(userRef, updates);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, userPath);
        }

        const merged: UserProfile = {
          ...existing,
          displayName: safeName,
          photoURL: safePhoto,
          role: isBootstrapAdmin ? 'admin' : existing.role,
          plan: isBootstrapAdmin ? 'admin_unlimited' : existing.plan,
          dailyLimit: isBootstrapAdmin ? -1 : existing.dailyLimit,
        };
        setUserProfile(merged);
        await syncWithBackend(fbUser, merged);
      }
    },
    [syncWithBackend]
  );

  // Restore server-issued email session (e.g. Admin Utama) if no Firebase user is active
  const restoreBackendSession = useCallback(async (token: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/user/usage', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return false;
      const json = (await res.json()) as { status: boolean; data?: ServerKeyUsage | null };
      if (json.status && json.data) {
        setLiveUsage(json.data);
        setUserProfile(usageToProfile(json.data));
        setNeedsEmailVerification(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          await ensureUserProfile(user);
          setAuthError(null);
        } catch (err) {
          setAuthError(err instanceof Error ? err.message : 'Gagal memuat profil pengguna.');
        }
      } else {
        const storedToken = (() => {
          try {
            return (
              window.localStorage.getItem(EMAIL_SESSION_STORAGE_KEY) ||
              window.localStorage.getItem(LEGACY_EMAIL_SESSION_STORAGE_KEY)
            );
          } catch {
            return null;
          }
        })();
        if (storedToken) {
          const ok = await restoreBackendSession(storedToken);
          if (!ok) {
            try {
              window.localStorage.removeItem(EMAIL_SESSION_STORAGE_KEY);
              window.localStorage.removeItem(LEGACY_EMAIL_SESSION_STORAGE_KEY);
            } catch {
              // ignore
            }
            setBackendSessionToken(null);
            setUserProfile(null);
            setLiveUsage(null);
          } else {
            setBackendSessionToken(storedToken);
          }
        } else {
          setUserProfile(null);
          setLiveUsage(null);
          setNeedsEmailVerification(false);
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, [ensureUserProfile, restoreBackendSession]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setAuthModalOpen(false);
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  }, []);

  const applyBackendSession = useCallback((sessionToken: string, record: ServerKeyUsage) => {
    try {
      window.localStorage.setItem(EMAIL_SESSION_STORAGE_KEY, sessionToken);
    } catch {
      // ignore storage quota errors
    }
    setBackendSessionToken(sessionToken);
    setLiveUsage(record);
    setUserProfile(usageToProfile(record));
    setNeedsEmailVerification(false);
    setAuthModalOpen(false);
    setAuthError(null);
  }, []);

  const signInWithEmail = useCallback(
    async (rawEmail: string, password: string) => {
      setAuthError(null);
      const email = rawEmail.trim().toLowerCase();
      if (!email || !password) {
        const msg = 'Email dan password wajib diisi.';
        setAuthError(msg);
        throw new Error(msg);
      }

      const tryBackendEmailLogin = async (): Promise<boolean> => {
        const res = await fetch('/api/auth/email-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) return false;
        const json = (await res.json()) as {
          status: boolean;
          sessionToken?: string;
          data?: ServerKeyUsage;
        };
        if (json.status && json.sessionToken && json.data) {
          applyBackendSession(json.sessionToken, json.data);
          return true;
        }
        return false;
      };

      // Admin Utama server-verified email login
      if (email === MAIN_ADMIN_EMAIL) {
        const ok = await tryBackendEmailLogin();
        if (!ok) {
          const msg = 'Email atau password admin utama salah.';
          setAuthError(msg);
          throw new Error(msg);
        }
        return;
      }

      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        if (!cred.user.emailVerified) {
          setNeedsEmailVerification(true);
        } else {
          setAuthModalOpen(false);
        }
      } catch (err) {
        const code = (err as { code?: string })?.code || '';
        const shouldTryBackend =
          code === 'auth/operation-not-allowed' ||
          code === 'auth/invalid-credential' ||
          code === 'auth/user-not-found' ||
          code === 'auth/wrong-password';

        if (shouldTryBackend) {
          const ok = await tryBackendEmailLogin();
          if (ok) return;
          const msg =
            code === 'auth/operation-not-allowed'
              ? 'Email belum terdaftar atau password tidak sesuai. Silakan pilih tab "Daftar Baru" jika belum memiliki akun.'
              : 'Email atau password tidak sesuai.';
          setAuthError(msg);
          throw new Error(msg);
        }

        const msg = mapFirebaseAuthError(err);
        setAuthError(msg);
        throw new Error(msg);
      }
    },
    [applyBackendSession]
  );

  const registerWithEmail = useCallback(
    async (displayName: string, rawEmail: string, password: string) => {
      setAuthError(null);
      const email = rawEmail.trim().toLowerCase();
      const safeName = displayName.trim().slice(0, 120) || email.split('@')[0] || 'Developer';
      if (!email || !password) {
        const msg = 'Email dan password wajib diisi.';
        setAuthError(msg);
        throw new Error(msg);
      }
      if (email === MAIN_ADMIN_EMAIL) {
        await signInWithEmail(email, password);
        return;
      }
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: safeName });
        await sendEmailVerification(cred.user);
        setNeedsEmailVerification(true);
      } catch (err) {
        const code = (err as { code?: string })?.code || '';
        if (code === 'auth/operation-not-allowed') {
          const res = await fetch('/api/auth/email-register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName: safeName, email, password }),
          });
          const json = (await res.json()) as {
            status: boolean;
            message?: string;
            sessionToken?: string;
            data?: ServerKeyUsage;
          };
          if (res.ok && json.status && json.sessionToken && json.data) {
            applyBackendSession(json.sessionToken, json.data);
            return;
          }
          const msg = json.message || 'Gagal mendaftarkan akun email.';
          setAuthError(msg);
          throw new Error(msg);
        }

        const msg = mapFirebaseAuthError(err);
        setAuthError(msg);
        throw new Error(msg);
      }
    },
    [signInWithEmail, applyBackendSession]
  );

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) return;
    setAuthError(null);
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  }, []);

  const reloadVerificationStatus = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const refreshed = auth.currentUser;
    if (refreshed.emailVerified) {
      await ensureUserProfile(refreshed);
      setAuthModalOpen(false);
      return true;
    }
    return false;
  }, [ensureUserProfile]);

  const signOutUser = useCallback(async () => {
    try {
      window.localStorage.removeItem(EMAIL_SESSION_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_EMAIL_SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
    setBackendSessionToken(null);
    setNeedsEmailVerification(false);
    setLogoutConfirmOpen(false);
    if (auth.currentUser) {
      await signOut(auth);
    }
    setUserProfile(null);
    setLiveUsage(null);
  }, []);

  const requestSignOut = useCallback(() => {
    setLogoutConfirmOpen(true);
  }, []);

  const cancelSignOut = useCallback(() => {
    setLogoutConfirmOpen(false);
  }, []);

  const confirmSignOut = useCallback(async () => {
    await signOutUser();
  }, [signOutUser]);

  const getIdToken = useCallback(async () => {
    if (firebaseUser) return firebaseUser.getIdToken();
    return backendSessionToken;
  }, [firebaseUser, backendSessionToken]);

  const regenerateApiKey = useCallback(async () => {
    if (!userProfile) return;

    if (firebaseUser && firebaseUser.emailVerified) {
      const isAdmin = userProfile.role === 'admin';
      const nextKey = generateApiKey(isAdmin);
      const userPath = `users/${firebaseUser.uid}`;
      const userRef = doc(db, 'users', firebaseUser.uid);

      try {
        await updateDoc(userRef, {
          apiKey: nextKey,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, userPath);
      }

      const updatedProfile: UserProfile = { ...userProfile, apiKey: nextKey };
      setUserProfile(updatedProfile);
      await syncWithBackend(firebaseUser, updatedProfile);
      return;
    }

    if (backendSessionToken) {
      const res = await fetch('/api/auth/regenerate-key', {
        method: 'POST',
        headers: { Authorization: `Bearer ${backendSessionToken}` },
      });
      if (res.ok) {
        const json = (await res.json()) as { status: boolean; data?: ServerKeyUsage };
        if (json.data) {
          setLiveUsage(json.data);
          setUserProfile(usageToProfile(json.data));
        }
      }
    }
  }, [firebaseUser, backendSessionToken, userProfile, syncWithBackend]);

  const refreshUsage = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    try {
      const res = await fetch('/api/user/usage', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = (await res.json()) as { status: boolean; data?: ServerKeyUsage | null };
        if (json.data) {
          setLiveUsage(json.data);
          setUserProfile((prev) =>
            prev
              ? {
                  ...prev,
                  role: json.data!.role,
                  plan: json.data!.plan,
                  dailyLimit: json.data!.dailyLimit,
                  monthlyLimit: json.data!.monthlyLimit,
                  requestsThisMonth: json.data!.requestsThisMonth,
                  usageMonth: json.data!.usageMonth,
                  packageId: json.data!.packageId,
                  packageName: json.data!.packageName,
                  requestsToday: json.data!.requestsToday,
                  requestsTotal: json.data!.requestsTotal,
                  status: json.data!.status,
                }
              : usageToProfile(json.data!)
          );
        }
      }
    } catch {
      // Ignore transient network error
    }
  }, [firebaseUser, getIdToken]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        liveUsage,
        loading,
        authError,
        needsEmailVerification,
        authModalOpen,
        openAuthModal,
        closeAuthModal,
        clearAuthError,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resendVerificationEmail,
        reloadVerificationStatus,
        logoutConfirmOpen,
        requestSignOut,
        cancelSignOut,
        confirmSignOut,
        signOutUser,
        regenerateApiKey,
        refreshUsage,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
