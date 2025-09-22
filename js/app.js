// js/app.js
import { ensureAnonAuth } from './firebase.js';
import { listarPedidos, excluirPedido as apiExcluir } from './api.js';
import { renderRows, $, toBR } from './render.js';
import { carregarPedidoEmModal, closeModal, addItemRow, salvarEdicao } from './modal.js';
import { exportarXLSX, exportarPDF } from './export.js';

window.__rows = [];
window.__currentDocId = null;

async function buscar(){
  await ensureAnonAuth();
  const di = $("fDataIni").value;
  const df = $("fDataFim").value;
  const cliente = ($("fCliente").value||"").trim().toUpperCase();
  const tipoSel = $("fTipo").value.trim();

  const list = await listarPedidos({ dataIni: di, dataFim: df });
  const out = list.filter(x=>{
    if (cliente && !(x.cliente||"").toUpperCase().includes(cliente)) return false;
    if (tipoSel && ((x.entrega?.tipo||"").toUpperCase() !== tipoSel)) return false;
    const hi = $("fHoraIni").value, hf = $("fHoraFim").value;
    if (hi && (x.horaEntrega||"") < hi) return false;
    if (hf && (x.horaEntrega||"") > hf) return false;
    return true;
  });

  window.__rows = out;
  renderRows(out);
}

function limpar(){
  ["fDataIni","fDataFim","fHoraIni","fHoraFim","fCliente"].forEach(id=>$(id).value="");
  $("fTipo").value = ""; $("tbody").innerHTML = "";
  $("ftCount").textContent = "0 pedidos"; $("ftTotal").textContent = "R$ 0,00"; window.__rows = [];
}

async function excluirPedido(id){
  await ensureAnonAuth();
  if (!id) return;
  const ok = confirm("Gostaria de excluir o pedido?");
  if (!ok) return;
  await apiExcluir(id);
  window.__rows = window.__rows.filter(x => x.id !== id);
  renderRows(window.__rows);
  alert("Pedido excluído.");
}

function atualizarListaLocal(id, payload){
  const idx = window.__rows.findIndex(x=>x.id===id);
  if (idx>=0){ window.__rows[idx] = { ...window.__rows[idx], ...payload }; }
  renderRows(window.__rows);
}

document.addEventListener('DOMContentLoaded', async () => {
  await ensureAnonAuth();

  $("btnBuscar").onclick = buscar;
  $("btnLimpar").onclick = limpar;
  $("btnXLSX").onclick = ()=> exportarXLSX(window.__rows);
  $("btnPDF").onclick  = ()=> exportarPDF(window.__rows);

  $("tbody").addEventListener("click", (ev)=>{
    const tdEdit = ev.target.closest(".cell-client");
    if (tdEdit){ const id = tdEdit.getAttribute("data-id"); if (id) carregarPedidoEmModal(id); return; }
    const btnCancel = ev.target.closest(".btn-cancel");
    if (btnCancel){ const id = btnCancel.getAttribute("data-id"); excluirPedido(id); }
  });

  $("btnFecharModal").addEventListener("click", closeModal);
  $("btnAddItem").addEventListener("click", ()=> addItemRow({}));
  $("btnSalvar").addEventListener("click", ()=> salvarEdicao(atualizarListaLocal));

  // opcional: carregar automaticamente
  // buscar();
});
