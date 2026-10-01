import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  provider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from '../services/firebase';
import { SK, getTodayDateStr, clearUserData, getXP, getStreak, checkStreakUpdate } from '../services/uwCore';

export interface UserProfile {
  name: string;
  email: string;
  uid: string;
  goal?: string;
  goalDate?: string;
  xp: number;
  streak: number;
  isSubscribed?: boolean;
  trialExpiry?: number;
  focusTime?: number;
}

interface AuthContextType {
  user: any | null;
  profile: UserProfile;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginAsGuest: (name?: string, email?: string) => Promise<void>;
  logout: () => Promise<void>;
  setGoal: (goal: string, date?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const defaultProfile: UserProfile = {
  name: 'Student',
  email: '',
  uid: '',
  xp: 0,
  streak: 0
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: defaultProfile,
  loading: true,
  loginWithGoogle: async () => {},
  loginAsGuest: async () => {},
  logout: async () => {},
  setGoal: async () => {},
  refreshProfile: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile>(() => {
    return {
      name: localStorage.getItem(SK.CUSTOM_NAME) || localStorage.getItem(SK.USER_NAME) || 'Student',
      email: localStorage.getItem(SK.USER_EMAIL) || '',
      uid: localStorage.getItem(SK.USER_UID) || '',
      goal: localStorage.getItem(SK.GOAL) || '',
      goalDate: localStorage.getItem(SK.GOAL_DATE) || '',
      xp: getXP(),
      streak: getStreak(),
      isSubscribed: localStorage.getItem(SK.IS_SUBSCRIBED) === 'true'
    };
  });

  const syncFirestoreProfile = async (uid: string, fallbackName: string, fallbackEmail: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const d = snap.data();
        const updated: UserProfile = {
          uid,
          name: d.name || fallbackName,
          email: d.email || fallbackEmail,
          xp: d.xp ?? getXP(),
          streak: d.streak ?? getStreak(),
          goal: d.goal || localStorage.getItem(SK.GOAL) || '',
          goalDate: d.goalDate || localStorage.getItem(SK.GOAL_DATE) || '',
          isSubscribed: d.isSubscribed ?? false,
          focusTime: d.focusTime ?? 0
        };
        localStorage.setItem(SK.USER_NAME, updated.name);
        localStorage.setItem(SK.USER_EMAIL, updated.email);
        localStorage.setItem(SK.XP, String(updated.xp));
        localStorage.setItem(SK.STREAK, String(updated.streak));
        if (updated.goal) localStorage.setItem(SK.GOAL, updated.goal);
        if (updated.goalDate) localStorage.setItem(SK.GOAL_DATE, updated.goalDate);
        setProfile(updated);
      } else {
        await setDoc(userRef, {
          uid,
          name: fallbackName,
          email: fallbackEmail,
          xp: getXP(),
          streak: getStreak(),
          focusTime: 0,
          status: 'Online',
          room: 'global',
          lastActive: Date.now(),
          lastActiveDate: getTodayDateStr()
        });
      }
    } catch (err) {
      console.warn('[AuthContext] Firestore sync error:', err);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const uid = currentUser.uid;
        const name = currentUser.displayName || currentUser.email?.split('@')[0] || 'Student';
        const email = currentUser.email || '';

        localStorage.setItem(SK.USER_UID, uid);
        localStorage.setItem(SK.UW_UID, uid);
        localStorage.setItem(SK.USER_NAME, name);
        localStorage.setItem(SK.USER_EMAIL, email);

        checkStreakUpdate();
        await syncFirestoreProfile(uid, name, email);
      } else {
        // If localStorage has user info, keep local profile
        const storedUid = localStorage.getItem(SK.USER_UID);
        const storedName = localStorage.getItem(SK.USER_NAME);
        if (storedUid && storedName) {
          checkStreakUpdate();
        }
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const loggedUser = result.user;
      setUser(loggedUser);
      const uid = loggedUser.uid;
      const name = loggedUser.displayName || loggedUser.email?.split('@')[0] || 'Student';
      const email = loggedUser.email || '';

      localStorage.setItem(SK.USER_UID, uid);
      localStorage.setItem(SK.UW_UID, uid);
      localStorage.setItem(SK.USER_NAME, name);
      localStorage.setItem(SK.USER_EMAIL, email);

      checkStreakUpdate();
      await syncFirestoreProfile(uid, name, email);
    } catch (err: any) {
      if (err?.code === 'auth/unauthorized-domain') {
        console.warn('[AuthContext] Domain not authorized in Firebase Console yet:', window.location.hostname);
      } else {
        console.error('[AuthContext] Login error:', err);
      }
      throw err;
    }
  };

  const loginAsGuest = async (customName = 'Ayush Gupta', customEmail = 'ayushgupt640@gmail.com') => {
    const uid = 'preview_' + Math.random().toString(36).substring(2, 10);
    const guestUser = {
      uid,
      displayName: customName,
      email: customEmail
    };
    setUser(guestUser);
    localStorage.setItem(SK.USER_UID, uid);
    localStorage.setItem(SK.UW_UID, uid);
    localStorage.setItem(SK.USER_NAME, customName);
    localStorage.setItem(SK.USER_EMAIL, customEmail);

    checkStreakUpdate();
    try {
      await syncFirestoreProfile(uid, customName, customEmail);
    } catch (e) {
      // ignore in offline/preview
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out error:', e);
    }
    clearUserData();
    setUser(null);
    setProfile(defaultProfile);
  };

  const setGoal = async (newGoal: string, date?: string) => {
    localStorage.setItem(SK.GOAL, newGoal);
    if (date) localStorage.setItem(SK.GOAL_DATE, date);

    setProfile(prev => ({ ...prev, goal: newGoal, goalDate: date }));

    const uid = profile.uid || localStorage.getItem(SK.USER_UID);
    if (uid) {
      try {
        await updateDoc(doc(db, 'users', uid), {
          goal: newGoal,
          goalDate: date || null
        });
      } catch (e) {
        console.warn('Could not sync goal to firestore:', e);
      }
    }
  };

  const refreshProfile = async () => {
    const uid = profile.uid || localStorage.getItem(SK.USER_UID);
    if (uid) {
      await syncFirestoreProfile(uid, profile.name, profile.email);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        loginWithGoogle,
        loginAsGuest,
        logout,
        setGoal,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
