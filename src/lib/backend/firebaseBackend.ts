import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, setPersistence, browserLocalPersistence,
} from 'firebase/auth';
import {
  getFirestore, collection, doc, setDoc, deleteDoc, getDocs, onSnapshot,
  addDoc, query, orderBy, limit,
} from 'firebase/firestore';
import type { DataBackend } from './types';
import type { AuditEntry } from '@/types';

const firebaseConfig = {
  apiKey: 'AIzaSyDYRnT8FbHofCQVXo8uvYrx1gLsZYqmmQ8',
  authDomain: 'portal-gestion-c159a.firebaseapp.com',
  projectId: 'portal-gestion-c159a',
  storageBucket: 'portal-gestion-c159a.firebasestorage.app',
  messagingSenderId: '775009737601',
  appId: '1:775009737601:web:d4294cfeef4688a0cd6680',
};

const KV_COLLECTION = 'portal_kv';
const AUDIT_COLLECTION = 'portal_audit';
const safeDocId = (key: string) => String(key).replace(/\//g, '__');

export function createFirebaseBackend(): DataBackend {
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  setPersistence(auth, browserLocalPersistence).catch(() => {});

  return {
    async signIn(email, password) { await signInWithEmailAndPassword(auth, email, password); },
    async signOut() { await signOut(auth); },
    async resetPassword(email) { await sendPasswordResetEmail(auth, email); },
    onAuthChanged(cb) {
      return onAuthStateChanged(auth, (u) => cb(u ? { email: u.email || '' } : null));
    },

    async loadAllKV() {
      const snap = await getDocs(collection(db, KV_COLLECTION));
      const out: Record<string, string> = {};
      snap.forEach((d) => { const data = d.data(); out[(data._key as string) || d.id] = data.value as string; });
      return out;
    },
    listenKV(onChange) {
      return onSnapshot(collection(db, KV_COLLECTION), (snap) => {
        const changes: { key: string; value: string | null }[] = [];
        snap.docChanges().forEach((ch) => {
          const data = ch.doc.data();
          const key = (data && (data._key as string)) || ch.doc.id;
          changes.push({ key, value: ch.type === 'removed' ? null : (data.value as string) });
        });
        if (changes.length) onChange(changes);
      }, (err) => console.error('onSnapshot portal_kv', err));
    },
    async setKV(key, value) {
      await setDoc(doc(db, KV_COLLECTION, safeDocId(key)), {
        _key: key, value, _by: auth.currentUser?.email || '', _ts: Date.now(),
      });
    },
    async removeKV(key) { await deleteDoc(doc(db, KV_COLLECTION, safeDocId(key))); },

    logAudit(entry) {
      addDoc(collection(db, AUDIT_COLLECTION), {
        key: entry.key || '', accion: entry.accion || '', label: entry.label || '', ctx: entry.ctx || '',
        byEmail: auth.currentUser?.email || '',
        byName: entry.byName || auth.currentUser?.email || '',
        ts: Date.now(),
      }).catch((e) => console.error('Audit log error', entry, e));
    },
    listenAudit(onChange) {
      const q = query(collection(db, AUDIT_COLLECTION), orderBy('ts', 'desc'), limit(400));
      return onSnapshot(q, (snap) => {
        const rows: AuditEntry[] = [];
        snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Omit<AuditEntry, 'id'>) }));
        onChange(rows);
      }, (err) => console.error('onSnapshot portal_audit', err));
    },
  };
}
