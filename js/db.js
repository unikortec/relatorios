// relatorios/js/db.js
// Camada multi-tenant para obedecer às suas security rules.
// Paths: /tenants/{tenantId}/pedidos  e  /tenants/{tenantId}/clientes

import {
  db, serverTimestamp,
  collection, doc, addDoc, setDoc, getDoc, getDocs, query, where, orderBy, limit,
  requireTenantContext
} from "./firebase.js";

function colPath(tenantId, coll) { return collection(db, "tenants", tenantId, coll); }
function docPath(tenantId, coll, id) { return doc(db, "tenants", tenantId, coll, id); }

function withAuthorAndTenant(base, { uid, tenantId }, { isCreate=false } = {}) {
  const now = serverTimestamp();
  const payload = { ...base, tenantId };

  if (isCreate) {
    if (!("createdAt" in payload) && !("criadoEm" in payload)) payload.createdAt = now;
    if (!("createdBy" in payload)) payload.createdBy = uid;
  }
  if (!("updatedAt" in payload) && !("atualizadoEm" in payload)) payload.updatedAt = now;
  if (!("updatedBy" in payload)) payload.updatedBy = uid;

  return payload;
}

/* ===== PEDIDOS ===== */
export async function pedidos_list({ dataIniISO, dataFimISO, clienteLike, tipo, max=1000 } = {}) {
  const { tenantId } = await requireTenantContext();
  const base = colPath(tenantId, "pedidos");

  const conds = [];
  if (dataIniISO) conds.push(where("dataEntregaISO", ">=", dataIniISO));
  if (dataFimISO) conds.push(where("dataEntregaISO", "<=", dataFimISO));

  let qRef = conds.length
    ? query(base, ...conds, orderBy("dataEntregaISO","desc"), limit(max))
    : query(base, orderBy("createdAt","desc"), limit(max));

  const snap = await getDocs(qRef);
  let list = [];
  snap.forEach(d => list.push({ id: d.id, ...d.data() }));

  if (clienteLike) {
    const needle = String(clienteLike).trim().toUpperCase();
    list = list.filter(x => (x.cliente || "").toUpperCase().includes(needle));
  }
  if (tipo) {
    const t = String(tipo).toUpperCase();
    list = list.filter(x => (x?.entrega?.tipo || "").toUpperCase() === t);
  }
  return list;
}

export async function pedidos_get(id) {
  const { tenantId } = await requireTenantContext();
  const ref = docPath(tenantId, "pedidos", id);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function pedidos_update(id, data) {
  const { user, tenantId } = await requireTenantContext();
  const ref = docPath(tenantId, "pedidos", id);
  const payload = withAuthorAndTenant({ ...(data || {}) }, { uid: user.uid, tenantId }, { isCreate:false });
  await setDoc(ref, payload, { merge:true });
}

export async function pedidos_delete(id) {
  const { tenantId } = await requireTenantContext();
  const ref = docPath(tenantId, "pedidos", id);
  const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js");
  await deleteDoc(ref);
}