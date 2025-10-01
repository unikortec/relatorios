// js/db.js
// Compat layer para Firestore multi-tenant conforme suas rules.
// - Caminho base: /tenants/{tenantId}/...
// - Injeta sempre: { tenantId, createdBy/updatedBy, createdAt/updatedAt } quando apropriado
// - Valida que estamos escrevendo no tenant certo (matchesTenantField)
// - Fornece utilidades p/ pedidos e clientes (CRUD)

import {
  db, auth, serverTimestamp,
  collection, doc, addDoc, setDoc, getDoc, getDocs, query, where, orderBy, limit,
  requireTenantContext
} from "./firebase.js";

/** Retorna ref de coleção sob o tenant atual */
function colPath(tenantId, collName) {
  return collection(db, "tenants", tenantId, collName);
}
function docPath(tenantId, collName, id) {
  return doc(db, "tenants", tenantId, collName, id);
}

/** Enriquecimento obrigatório para WRITE conforme suas rules */
function withAuthorAndTenant(base, { uid, tenantId }, { isCreate = false } = {}) {
  const now = serverTimestamp();
  const payload = {
    ...base,
    tenantId,
  };

  // created*
  if (isCreate) {
    // aceita PT ou EN (suas rules checam os 2)
    if (!("criadoEm" in payload) && !("createdAt" in payload)) {
      payload.createdAt = now;
    }
    if (!("createdBy" in payload)) {
      payload.createdBy = uid;
    }
  }

  // updated*
  if (!("atualizadoEm" in payload) && !("updatedAt" in payload)) {
    payload.updatedAt = now;
  }
  if (!("updatedBy" in payload)) {
    payload.updatedBy = uid;
  }

  return payload;
}

/* ===========================
   ==  PEDIDOS (CRUD) ==
   =========================== */
export async function pedidos_list({ dataIniISO, dataFimISO, clienteLike, tipo, max = 1000 } = {}) {
  const { tenantId } = await requireTenantContext();
  const base = colPath(tenantId, "pedidos");

  // Monta query incremental
  const conds = [];
  if (dataIniISO) conds.push(where("dataEntregaISO", ">=", dataIniISO));
  if (dataFimISO) conds.push(where("dataEntregaISO", "<=", dataFimISO));
  let qRef;

  if (conds.length) {
    qRef = query(base, ...conds, orderBy("dataEntregaISO", "desc"), limit(max));
  } else {
    // fallback por criação mais recente
    qRef = query(base, orderBy("createdAt", "desc"), limit(max));
  }

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

export async function pedidos_create(data) {
  const { user, tenantId } = await requireTenantContext();
  const payload = withAuthorAndTenant({ ...(data || {}) }, { uid: user.uid, tenantId }, { isCreate: true });
  const ref = await addDoc(colPath(tenantId, "pedidos"), payload);
  return { id: ref.id };
}

export async function pedidos_set(id, data) {
  const { user, tenantId } = await requireTenantContext();
  const ref = docPath(tenantId, "pedidos", id);
  const payload = withAuthorAndTenant({ ...(data || {}) }, { uid: user.uid, tenantId }, { isCreate: true });
  await setDoc(ref, payload, { merge: true });
}

export async function pedidos_update(id, data) {
  const { user, tenantId } = await requireTenantContext();
  const ref = docPath(tenantId, "pedidos", id);
  const payload = withAuthorAndTenant({ ...(data || {}) }, { uid: user.uid, tenantId }, { isCreate: false });
  await setDoc(ref, payload, { merge: true });
}

export async function pedidos_delete(id) {
  const { tenantId } = await requireTenantContext();
  const ref = docPath(tenantId, "pedidos", id);
  // deleteDoc também é possível, mas mantém consistência com merge vazio proibido:
  // Preferível usar import explícito de deleteDoc se desejar deletar de fato:
  const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js");
  await deleteDoc(ref);
}

/* ===========================
   ==  CLIENTES (CRUD) ==
   =========================== */
export async function clientes_findByNomeUpper(nomeUpper) {
  const { tenantId } = await requireTenantContext();
  const base = colPath(tenantId, "clientes");
  const qRef = query(base, where("nomeUpper", "==", String(nomeUpper || "").toUpperCase()), limit(1));
  const snap = await getDocs(qRef);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function clientes_upsert(nome, endereco, isentoFrete = false, extras = {}) {
  const { user, tenantId } = await requireTenantContext();
  const nomeUpper = String(nome || "").toUpperCase().trim();
  if (!nomeUpper) return;

  // tenta achar
  const found = await clientes_findByNomeUpper(nomeUpper);
  const base = {
    nome: nomeUpper,
    nomeUpper,
    endereco: String(endereco || "").toUpperCase().trim(),
    isentoFrete: !!isentoFrete,
    cnpj: extras?.cnpj || "",
    ie: extras?.ie || "",
    cep: extras?.cep || "",
    contato: extras?.contato || "",
  };

  if (found) {
    await pedidos_update(found.id, base); // reutiliza "update" para herdar updatedAt/updatedBy/tenantId
  } else {
    // cria novo na coleção de clientes
    const payload = withAuthorAndTenant({ ...base, compras: 0 }, { uid: user.uid, tenantId }, { isCreate: true });
    await addDoc(colPath(tenantId, "clientes"), payload);
  }
}

/* ===========================
   ==  SELF-TEST PERMISSÕES ==
   =========================== */
export async function __smokeTestPermissoes() {
  const { user, tenantId, role } = await requireTenantContext();
  const baseCol = colPath(tenantId, "pedidos");

  const { addDoc, getDoc, setDoc, doc, deleteDoc } =
    await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js");

  const res = { tenantId, role, create:false, read:false, update:false, delete:false, error:null, id:null };

  try {
    // CREATE
    const refNew = await addDoc(baseCol, withAuthorAndTenant({ teste:true }, { uid: user.uid, tenantId }, { isCreate:true }));
    res.id = refNew.id;
    res.create = true;

    // READ
    const snap = await getDoc(doc(db, "tenants", tenantId, "pedidos", refNew.id));
    res.read = snap.exists();

    // UPDATE
    await setDoc(doc(db, "tenants", tenantId, "pedidos", refNew.id),
      withAuthorAndTenant({ teste:false }, { uid: user.uid, tenantId }, { isCreate:false }),
      { merge: true }
    );
    res.update = true;

    // DELETE
    await deleteDoc(doc(db, "tenants", tenantId, "pedidos", refNew.id));
    res.delete = true;
  } catch (e) {
    res.error = String(e?.message || e);
  }

  console.log("[DB] Smoke test permissões:", res);
  return res;
}