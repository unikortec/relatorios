// relatorios/js/firebase.js
// Compatível com Firebase 12.2.1. Reaproveita o login do app-mãe (Unikor).
// NÃO faz signIn aqui; apenas aguarda onAuthStateChanged e expõe claims (tenantId/role).

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, onAuthStateChanged, getIdTokenResult } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getFirestore,
  collection, doc, addDoc, setDoc, getDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// === CONFIG (mesmas chaves do Unikor) ===
export const firebaseConfig = {
  apiKey:            "AIzaSyC12s4PvUWtNxOlShPc7zXlzq4XWqlVo2w",
  authDomain:        "unikorapp.firebaseapp.com",
  projectId:         "unikorapp",
  storageBucket:     "unikorapp.appspot.com",
  messagingSenderId: "329806123621",
  appId:             "1:329806123621:web:9aeff2f5947cd106cf2c8c",
};

// === INIT ===
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export { app };
export const auth = getAuth(app);
export const db   = getFirestore(app);

// === AUTH STATE + CLAIMS BUS ===
let currentUser = null;
let currentClaims = null;
const subs = new Set();
const pendingLoginWaiters = new Set();

onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  currentClaims = null;

  try {
    if (currentUser) {
      const tok = await getIdTokenResult(currentUser, /*forceRefresh*/ true);
      currentClaims = tok?.claims || null;
    }
  } catch (_) {}

  console.log(
    "[Relatórios/Auth]",
    currentUser
      ? `Logado: ${currentUser.email || currentUser.uid} — claims: ${JSON.stringify(currentClaims || {})}`
      : "Não logado"
  );

  subs.forEach(fn => { try { fn(currentUser, currentClaims); } catch {} });

  if (currentUser) {
    pendingLoginWaiters.forEach(res => res({ user: currentUser, claims: currentClaims }));
    pendingLoginWaiters.clear();
  }
});

export function onAuthUser(cb) {
  if (typeof cb === 'function') {
    subs.add(cb);
    cb(currentUser, currentClaims);
    return () => subs.delete(cb);
  }
  return () => {};
}

export function getCurrentUser()   { return currentUser; }
export function getCurrentClaims() { return currentClaims; }
export function isLoggedIn()       { return !!currentUser; }

export function waitForLogin() {
  if (currentUser) return Promise.resolve({ user: currentUser, claims: currentClaims });
  return new Promise((resolve) => pendingLoginWaiters.add(resolve));
}

/** Garante tenantId/role nos claims antes de prosseguir. */
export async function requireTenantContext() {
  const { user, claims } = (currentUser ? { user: currentUser, claims: currentClaims } : await waitForLogin());
  const tenantId = claims?.tenantId || "";
  const role = claims?.role || "";
  if (!tenantId) throw new Error("Sem tenantId nos claims. Verifique provisionamento do usuário no portal.");
  return { user, tenantId, role };
}

// Reexports para conveniência (mesmo padrão Unikor)
export {
  collection, doc, addDoc, setDoc, getDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp
};