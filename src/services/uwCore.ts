import {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from './firebase';

export const SK = {
  USER_NAME: 'userName',
  USER_EMAIL: 'userEmail',
  USER_UID: 'userUID',
  UW_UID: 'uwUid',
  CUSTOM_NAME: 'customUserName',
  GOAL: 'goal',
  GOAL_DATE: 'goalExamDate',
  XP: 'uw_xp',
  STREAK: 'uw_streak',
  LAST_STREAK: 'uw_last_streak',
  TODO_BONUS: 'uw_todo_daily_bonus',
  THEME: 'theme',
  IS_SUBSCRIBED: 'isSubscribed',
  TRIAL_EXPIRY: 'trialExpiry',
  FREE_MOCK_USED: 'freeMockUsed'
};

export function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function getWeekKey(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const ys = new Date(d.getFullYear(), 0, 1);
  return `${d.getFullYear()}-W${Math.ceil((((d.getTime() - ys.getTime()) / 86400000) + 1) / 7)}`;
}

export function computeLevel(totalXP: number): number {
  if (totalXP < 100) return 1;
  if (totalXP < 300) return 2;
  if (totalXP < 600) return 3;
  if (totalXP < 1000) return 4;
  if (totalXP < 1500) return 5;
  if (totalXP < 2200) return 6;
  if (totalXP < 3000) return 7;
  if (totalXP < 4000) return 8;
  if (totalXP < 5500) return 9;
  return 10 + Math.floor((totalXP - 5500) / 1500);
}

export function getXP(): number {
  return Math.max(0, parseInt(localStorage.getItem(SK.XP) || '0', 10));
}

export async function addXP(amount: number): Promise<number> {
  const current = getXP();
  const next = current + amount;
  localStorage.setItem(SK.XP, String(next));
  window.dispatchEvent(new CustomEvent('uw_xp_changed', { detail: { xp: next, delta: amount } }));

  const uid = localStorage.getItem(SK.USER_UID) || localStorage.getItem(SK.UW_UID);
  if (uid) {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        xp: next,
        lastActive: Date.now(),
        lastActiveDate: getTodayDateStr()
      });

      const lbRef = doc(db, 'leaderboard', uid);
      const lbSnap = await getDoc(lbRef);
      const name = localStorage.getItem(SK.CUSTOM_NAME) || localStorage.getItem(SK.USER_NAME) || 'Student';
      const email = localStorage.getItem(SK.USER_EMAIL) || '';

      if (lbSnap.exists()) {
        const data = lbSnap.data();
        const prevWeekly = data.weeklyXP || 0;
        const prevWeekKey = data.weekKey || '';
        const curWeek = getWeekKey();
        const newWeekly = (prevWeekKey === curWeek) ? (prevWeekly + amount) : amount;
        await updateDoc(lbRef, {
          totalXP: next,
          weeklyXP: newWeekly,
          weekKey: curWeek,
          level: computeLevel(next),
          name,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(lbRef, {
          uid,
          name,
          email,
          totalXP: next,
          weeklyXP: amount,
          weekKey: getWeekKey(),
          level: computeLevel(next),
          focusMinutes: 0,
          updatedAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.warn('[uwCore] Sync error:', e);
    }
  }

  return next;
}

export function getStreak(): number {
  return Math.max(0, parseInt(localStorage.getItem(SK.STREAK) || '0', 10));
}

export function checkStreakUpdate(): { updated: boolean; streak: number; isMilestone: boolean } {
  const lastDate = localStorage.getItem(SK.LAST_STREAK);
  const today = getTodayDateStr();

  if (lastDate === today) {
    return { updated: false, streak: getStreak(), isMilestone: false };
  }

  let curStreak = getStreak();
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

  if (lastDate === yesterday) {
    curStreak += 1;
  } else if (!lastDate) {
    curStreak = 1;
  } else {
    // missed a day
    curStreak = 1;
  }

  localStorage.setItem(SK.STREAK, String(curStreak));
  localStorage.setItem(SK.LAST_STREAK, today);

  const isMilestone = [3, 7, 14, 21, 28, 50, 100].includes(curStreak);

  const uid = localStorage.getItem(SK.USER_UID) || localStorage.getItem(SK.UW_UID);
  if (uid) {
    updateDoc(doc(db, 'users', uid), {
      streak: curStreak,
      lastStreakDate: today
    }).catch(() => {});
  }

  return { updated: true, streak: curStreak, isMilestone };
}

export function clearUserData(): void {
  const keysToKeep = ['theme', 'installDismissed'];
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && !keysToKeep.includes(k)) {
      toRemove.push(k);
    }
  }
  toRemove.forEach(k => localStorage.removeItem(k));
  sessionStorage.clear();
}
