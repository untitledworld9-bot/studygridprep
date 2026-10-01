import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  increment,
  deleteDoc,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
  where,
  serverTimestamp,
  Timestamp,
  writeBatch,
  arrayUnion
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyB_13GJOiLQwxsirfJ7T_4WinaxVmSp7fs",
  authDomain: "untitled-world-2e645.firebaseapp.com",
  projectId: "untitled-world-2e645",
  storageBucket: "untitled-world-2e645.firebasestorage.app",
  messagingSenderId: "990115586087",
  appId: "1:990115586087:web:963f68bd59dec5ef0c6e02",
  measurementId: "G-X2PB6L0C75"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export {
  app,
  db,
  auth,
  provider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  collection,
  addDoc,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  increment,
  deleteDoc,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
  where,
  serverTimestamp,
  Timestamp,
  writeBatch,
  arrayUnion
};
