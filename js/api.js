// js/api.js
import {
  collection, query, where, orderBy, limit, getDocs,
  doc, getDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from './firebase.js';

export async function listarPedidos({ dataIni, dataFim }) {
  let ref = collection(db, "pedidos");
  let qRef;

  if (dataIni || dataFim){
    const conds = [];
    if (dataIni) conds.push(where("dataEntregaISO", ">=", dataIni));
    if (dataFim) conds.push(where("dataEntregaISO", "<=", dataFim));
    qRef = query(ref, ...conds, orderBy("dataEntregaISO","desc"), limit(1000));
  } else {
    qRef = query(ref, orderBy("createdAt","desc"), limit(1000));
  }

  const snap = await getDocs(qRef);
  const list = [];
  snap.forEach(d => list.push({ id:d.id, ...d.data() }));
  return list;
}

export async function obterPedido(id){
  const ref = doc(db, "pedidos", id);
  const s = await getDoc(ref);
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function salvarPedido(id, payload){
  payload.updatedAt = serverTimestamp();
  await updateDoc(doc(db, "pedidos", id), payload);
}

export async function excluirPedido(id){
  await deleteDoc(doc(db, "pedidos", id));
}
