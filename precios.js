// ═══ 💲 CAMBIOS DE PRECIO PARA LOS LOCALES (27-nov-2026) ═══════════════════════════════════════════════════════════════
// JP: la venta nueva puede empezar a regir más adelante «para darle tiempo a los locales a cambiar los precios de los
// productos», y «cuando haya un cambio en la lista de precio, que se les avise a todos los colaboradores de los locales por
// notificación». Respuesta de JP: la lista de artículos la ven acá, en Stock. El aviso (push, app 'stock') abre
// …/stock-adorno/#precios=<id>. Se cargan en Productos → 💲 Precios (productos_aumento_grabar).
// Datos: stock_precios_cambios(p_dias) → los programados y los que empezaron a regir en los últimos 7 días, solo la venta.
// Archivo aparte (lo carga index.html) para no mezclarse con lo demás de Stock.
(function () {
  'use strict';
  const PRC = { datos: [], abierto: false, soloMios: true, listo: false };
  const LOC = { alcorta: 'Alcorta', unicenter: 'Unicenter', oficina: 'Oficina' };
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = n => (n == null || isNaN(n)) ? '—' : '$ ' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });
  const local = () => (typeof miLocalStock === 'string' ? miLocalStock : 'oficina');
  function cuando(iso) {   // «lun 1/12 a las 9:00» (hora de Argentina)
    const d = new Date(new Date(iso).getTime() - 3 * 3600e3);
    return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1} a las ${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  }
  const yaRige = a => a.estado === 'vigente' || new Date(a.rige_desde) <= new Date();
  const hayEn = (it, l) => Number(it.stock?.[l] || 0) > 0;

  const css = document.createElement('style');
  css.textContent = `
#prc-aviso { margin: 10px 14px 0; display: flex; flex-direction: column; gap: 6px; }
#prc-aviso .prc-linea { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; background: #fffbeb; border: 1px solid #fde68a; color: #78350f;
  border-radius: 18px; padding: 9px 14px; font-size: 14px; }
#prc-aviso .prc-linea.rige { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
#prc-aviso .prc-linea b { font-weight: 700; } #prc-aviso .prc-linea .prc-txt { flex: 1; min-width: 200px; }
.prc-pill { font: inherit; font-size: 13px; font-weight: 600; padding: 6px 14px; border-radius: 999px; cursor: pointer; border: 1px solid currentColor; background: #fff; color: inherit; white-space: nowrap; }
.prc-x { font: inherit; border: none; background: transparent; color: inherit; opacity: .6; cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 999px; }
.prc-x:hover { opacity: 1; background: rgba(0,0,0,.06); }
#prc-ov { position: fixed; inset: 0; z-index: 900; background: rgba(15,23,42,.45); display: flex; align-items: flex-start; justify-content: center; padding: 24px 12px; overflow: auto; }
#prc-ov .prc-box { background: #f8fafc; border-radius: 22px; width: 100%; max-width: 920px; box-shadow: 0 18px 50px rgba(15,23,42,.3); overflow: hidden; }
#prc-ov .prc-cab { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 16px 18px; background: #fff; border-bottom: 1px solid var(--border, #e5e7eb); }
#prc-ov .prc-cab h2 { margin: 0; font-size: 19px; flex: 1; }
#prc-ov .prc-cuerpo { padding: 14px; display: grid; gap: 14px; }
#prc-ov .prc-card { background: #fff; border-radius: 18px; padding: 14px 16px; box-shadow: 0 1px 4px rgba(15,23,42,.06); }
#prc-ov .prc-card.foco { outline: 2px solid var(--primary, #1565c0); }
#prc-ov .prc-card h3 { margin: 0 0 4px; font-size: 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
#prc-ov .prc-chip { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
#prc-ov .prc-chip.prog { background: #fef3c7; color: #92400e; } #prc-ov .prc-chip.ya { background: #dcfce7; color: #166534; } #prc-ov .prc-chip.prueba { background: #e5e7eb; color: #374151; }
#prc-ov .prc-sub { font-size: 13px; color: var(--muted, #6b7280); margin-bottom: 8px; }
#prc-ov table { width: 100%; border-collapse: collapse; font-size: 13px; }
#prc-ov th, #prc-ov td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #f1f5f9; }
#prc-ov th { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted, #6b7280); }
#prc-ov .num { text-align: right; white-space: nowrap; } #prc-ov .nuevo { font-weight: 700; }
#prc-ov .sube { color: #b91c1c; } #prc-ov .baja { color: #15803d; }
#prc-ov .prc-chk { display: inline-flex; gap: 6px; align-items: center; font-size: 13px; cursor: pointer; }
@media (max-width: 600px) { #prc-ov { padding: 0; } #prc-ov .prc-box { border-radius: 0; min-height: 100%; } #prc-ov .prc-desc-col { display: none; } #prc-ov .prc-solo-cel { display: block !important; } }
`;
  document.head.appendChild(css);

  async function cargar() {
    try {
      const { data, error } = await sb.rpc('stock_precios_cambios', { p_dias: 7 });
      if (error) { console.warn('stock_precios_cambios', error); return; }
      PRC.datos = Array.isArray(data) ? data : [];
      pintarAviso();
      if (PRC.abierto) pintarLista();
    } catch (e) { console.warn('precios', e); }
  }
  // ✕ en el aviso: se esconde ese cambio en esta compu (vuelve si llega otro)
  const vistos = () => { try { return new Set(JSON.parse(localStorage.getItem('stock.precios.vistos') || '[]')); } catch (_) { return new Set(); } };
  function esconder(clave) { try { const s = vistos(); s.add(clave); localStorage.setItem('stock.precios.vistos', JSON.stringify([...s].slice(-60))); } catch (_) {} pintarAviso(); }
  function pintarAviso() {
    let el = document.getElementById('prc-aviso');
    const v = vistos(), ahora = Date.now();
    // en el aviso: lo que todavía no rige y lo que empezó a regir en las últimas 48 h
    const lista = PRC.datos.filter(a => (!yaRige(a) || ahora - new Date(a.rige_desde).getTime() < 48 * 3600e3) && !v.has(a.id + ':' + (yaRige(a) ? 'r' : 'p')));
    if (!lista.length) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'prc-aviso';
      const h = document.querySelector('#app header.ab-banner');
      if (h) h.after(el); else document.getElementById('app')?.prepend(el);
    }
    const l = local();
    el.innerHTML = lista.slice(0, 3).map(a => {
      const its = a.items || [], mios = LOC[l] && l !== 'oficina' ? its.filter(it => hayEn(it, l)).length : null, rige = yaRige(a);
      return `<div class="prc-linea${rige ? ' rige' : ''}">
        <span class="prc-txt">💲 ${rige ? `<b>Ya rigen precios nuevos</b> (desde el ${esc(cuando(a.rige_desde))})` : `<b>Cambian precios el ${esc(cuando(a.rige_desde))}</b>`}: ${its.length} artículo${its.length === 1 ? '' : 's'}${a.proveedor ? ' de ' + esc(a.proveedor) : ''}${mios != null ? ` · ${mios} con stock en ${LOC[l]}` : ''}${a.es_prueba ? ' · 🧪 prueba' : ''}</span>
        <button class="prc-pill" onclick="STOCK_PRECIOS.abrir(${a.id})">Ver la lista</button>
        <button class="prc-x" onclick="STOCK_PRECIOS.esconder('${a.id}:${rige ? 'r' : 'p'}')" title="Esconder este aviso en esta compu" aria-label="Esconder">✕</button></div>`;
    }).join('') + (lista.length > 3 ? `<div class="mini" style="padding-left:14px">y ${lista.length - 3} más: <button class="prc-pill" onclick="STOCK_PRECIOS.abrir()">Ver todos</button></div>` : '');
  }
  function abrir(id) {
    PRC.abierto = true; PRC.foco = id || null;
    let ov = document.getElementById('prc-ov');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'prc-ov';
      ov.addEventListener('click', e => { if (e.target === ov) cerrar(); });
      document.body.appendChild(ov);
    }
    pintarLista();
    if (!PRC.datos.length) cargar();
  }
  function cerrar() {
    PRC.abierto = false; document.getElementById('prc-ov')?.remove();
    if (/[#&]precios=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  }
  function pintarLista() {
    const ov = document.getElementById('prc-ov'); if (!ov) return;
    const l = local(), conLocal = !!LOC[l] && l !== 'oficina';
    const cards = PRC.datos.map(a => {
      const rige = yaRige(a), todos = a.items || [];
      const its = conLocal && PRC.soloMios ? todos.filter(it => hayEn(it, l)) : todos;
      return `<div class="prc-card${PRC.foco === a.id ? ' foco' : ''}" id="prc-c-${a.id}">
        <h3>${rige ? `Desde el ${esc(cuando(a.rige_desde))}` : `El ${esc(cuando(a.rige_desde))}`}${a.proveedor ? ' · ' + esc(a.proveedor) : ''}
          <span class="prc-chip ${rige ? 'ya' : 'prog'}">${rige ? '✅ ya rige' : '⏳ todavía no rige'}</span>${a.es_prueba ? '<span class="prc-chip prueba">🧪 prueba</span>' : ''}</h3>
        <div class="prc-sub">${todos.length} artículo${todos.length === 1 ? '' : 's'}${conLocal ? ` · ${todos.filter(it => hayEn(it, l)).length} con stock en ${LOC[l]}` : ''}.
          ${rige ? 'Revisá que las etiquetas tengan el precio nuevo.' : 'Hasta esa hora se cobra el precio de hoy; cambiá las etiquetas para esa hora.'}</div>
        ${its.length ? `<div style="overflow-x:auto"><table data-tt-clave="stock-precios-${a.id}"><thead><tr><th>Código</th><th class="prc-desc-col">Descripción</th><th class="num">Hoy</th><th class="num">Nuevo</th><th class="num">Dif.</th>${conLocal ? `<th class="num">Stock ${esc(LOC[l])}</th>` : '<th class="num">Alcorta</th><th class="num">Unicenter</th>'}</tr></thead>
          <tbody>${its.map(it => { const d = it.antes > 0 && it.nuevo != null ? (it.nuevo / it.antes - 1) * 100 : null;
            return `<tr><td><b>${esc(it.sku)}</b><div class="mini prc-solo-cel" style="display:none">${esc(it.descripcion || '')}</div></td><td class="prc-desc-col">${esc(it.descripcion || '—')}</td>
              <td class="num">${plata(it.antes)}</td><td class="num nuevo">${plata(it.nuevo)}</td>
              <td class="num ${d > 0 ? 'sube' : d < 0 ? 'baja' : ''}">${d == null ? '' : (d > 0 ? '+' : '') + d.toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' %'}</td>
              ${conLocal ? `<td class="num">${Number(it.stock?.[l] || 0)}</td>` : `<td class="num">${Number(it.stock?.alcorta || 0)}</td><td class="num">${Number(it.stock?.unicenter || 0)}</td>`}</tr>`; }).join('')}</tbody></table></div>`
          : `<div class="mini">Ninguno de estos artículos tiene stock en ${esc(LOC[l] || '')}.</div>`}
      </div>`;
    }).join('');
    ov.innerHTML = `<div class="prc-box" role="dialog" aria-label="Cambios de precio">
      <div class="prc-cab"><h2>💲 Cambios de precio</h2>
        ${conLocal ? `<label class="prc-chk"><input type="checkbox" ${PRC.soloMios ? 'checked' : ''} onchange="STOCK_PRECIOS.soloMios(this.checked)"> solo lo que hay en ${esc(LOC[l])}</label>` : ''}
        <button class="prc-x" onclick="STOCK_PRECIOS.cerrar()" title="Cerrar" aria-label="Cerrar">✕</button></div>
      <div class="prc-cuerpo">${cards || '<div class="prc-card">No hay cambios de precio programados ni de los últimos 7 días.</div>'}</div></div>`;
    if (PRC.foco) setTimeout(() => document.getElementById('prc-c-' + PRC.foco)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && PRC.abierto) cerrar(); });
  window.STOCK_PRECIOS = { abrir, cerrar, esconder, recargar: cargar, soloMios: v => { PRC.soloMios = !!v; pintarLista(); } };

  // arranca cuando la app está a la vista (después del login); se refresca cada 10 minutos y al volver a la pestaña
  function abrirDesdeHash() {
    const m = /[#&]precios=(\d+)/.exec(location.hash || '');
    if (m) abrir(Number(m[1]));
  }
  function iniciar() {
    if (PRC.listo) return;
    const app = document.getElementById('app');
    if (!app || app.style.display === 'none' || typeof sb === 'undefined') return;
    PRC.listo = true;
    setTimeout(async () => { await cargar(); abrirDesdeHash(); }, 1200);   // después de detectarAdmin (el local)
    setInterval(cargar, 10 * 60e3);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) cargar(); });
    addEventListener('hashchange', abrirDesdeHash);
  }
  const t = setInterval(() => { iniciar(); if (PRC.listo) clearInterval(t); }, 1000);
})();
