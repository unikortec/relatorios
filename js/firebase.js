// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB3zBW_WhVfNpX5uoJCq-6WysE5XKYKZt4",
  authDomain: "serranobrepedidos.firebaseapp.com",
  projectId: "serranobrepedidos",
  storageBucket: "serranobrepedidos.firebasestorage.app",
  messagingSenderId: "948939268023",
  appId: "1:948939268023:web:3f1f6c18f2c047c82b1232"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

let __authReady = false;
export async function ensureAnonAuth() {
  if (__authReady) return;
  await new Promise((resolve) => {
    onAuthStateChanged(auth, async (u) => {
      try { if (!u) await signInAnonymously(auth); } catch {}
      __authReady = true; resolve();
    }, async () => {
      try { await signInAnonymously(auth); } catch {}
      __authReady = true; resolve();
    });
  });
}
