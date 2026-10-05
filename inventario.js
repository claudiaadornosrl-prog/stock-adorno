// ═══════════════════════════════════════════════════════════════════════
//  📋 INVENTARIO CÍCLICO · Stock (5-oct-2026, pedido JP)
//
//  3 cuatrimestres fijos (ene–abr, may–ago, sep–dic), 16 semanas cada uno.
//  · La encargada (o admin) arma el cuatrimestre: el sistema parte el stock del
//    local en hojas de 30–60 SKU por proveedor/tipo y las reparte entre quienes
//    cuentan (Oficina: Monzón). Puede mover hojas de persona o semana y publica.
//  · La vendedora ve SOLO sus hojas y cuenta A CIEGAS: nunca ve el stock. Al
//    guardar, lo que difiere queda marcado (sin decir cuánto) para contar de
//    nuevo. Puede agregar un SKU que encontró fuera de la hoja. Al cerrar, le
//    llega aviso a la encargada.
//  · La encargada ve sistema / 1ª / 2ª contada, recuenta el picking (15 % al
//    azar + todo lo que difirió), decide ajustar o no, y al marcar la hoja
//    controlada el sistema le deja la lista para cargar en el Dragonfish
//    (motivo INV + apellido de quien contó).
//  Toda la lógica y los permisos viven en las RPC stock_inv_* (Supabase).
// ═══════════════════════════════════════════════════════════════════════
const INV = { local: null, ciclo: null, hoja: null, hojas: [], mis: [], ciclos: [], emps: [] };
const LOCAL_NOMBRE = { alcorta: 'Alcorta', unicenter: 'Unicenter', oficina: 'Oficina' };
const invFecha = f => f ? f.split('-').reverse().join('/') : '';
const invEstado = e => ({ pendiente: '⬜ Pendiente', contando: '✏️ Contando', contada: '📨 Contada · a controlar', controlada: '✅ Controlada' }[e] || e);
const invN = v => (v === null || v === undefined) ? '' : String(v);

async function invInit() {
  const c = document.getElementById('view-inventario');
  c.innerHTML = '<div class="inv-vacio">Cargando…</div>';
  INV.local = INV.local || miLocalStock;
  const [mis, ciclos] = await Promise.all([
    sb.rpc('stock_inv_mis_hojas'),
    (esAdmin || esGerente) ? sb.rpc('stock_inv_ciclos', { p_local: esAdmin ? null : miLocalStock }) : Promise.resolve({ data: [] }),
  ]);
  INV.mis = mis.data || []; INV.ciclos = ciclos.data || [];
  invRenderInicio();
}

function invRenderInicio() {
  const c = document.getElementById('view-inventario');
  const gest = esAdmin || esGerente;
  const ciclos = INV.ciclos.filter(x => esAdmin ? (!INV.local || x.local === INV.local) : true);
  c.innerHTML = `
    ${INV.mis.length || !gest ? `<div class="card inv-card">
      <h3 class="inv-h3">📋 Mis hojas de inventario</h3>
      ${INV.mis.length ? INV.mis.map(h => `
        <div class="inv-hoja ${h.estado}" onclick="invAbrirHoja(${h.id})">
          <div class="inv-hoja-top"><b>Semana ${h.semana}</b> <span class="inv-mini">desde el ${invFecha(h.semana_desde)}</span>
            <span class="inv-chip">${invEstado(h.estado)}</span></div>
          <div class="inv-hoja-tit">${escHtml(h.titulo)}</div>
          <div class="inv-mini">${h.skus} artículos${h.pendientes_segunda ? ` · <b style="color:#b45309">${h.pendientes_segunda} para volver a contar</b>` : ''}</div>
        </div>`).join('')
      : '<div class="inv-vacio">No tenés hojas asignadas por ahora.</div>'}
    </div>` : ''}

    ${gest ? `<div class="card inv-card">
      <div class="inv-row">
        <h3 class="inv-h3" style="flex:1">🗂 Inventarios de ${esAdmin ? '' : LOCAL_NOMBRE[miLocalStock]}</h3>
        ${esAdmin ? `<select onchange="INV.local=this.value;invRenderInicio()" class="inv-sel">
          ${['alcorta','unicenter','oficina'].map(l => `<option value="${l}" ${INV.local === l ? 'selected' : ''}>${LOCAL_NOMBRE[l]}</option>`).join('')}</select>` : ''}
        <button class="inv-btn" onclick="invNuevoCiclo()">➕ Armar cuatrimestre</button>
      </div>
      ${ciclos.length ? ciclos.map(x => {
        const pct = x.skus ? Math.round(x.skus_controlados * 100 / x.skus) : 0;
        return `<div class="inv-hoja" onclick="invAbrirCiclo(${x.id})">
          <div class="inv-hoja-top"><b>${x.anio} · C${x.cuatri}</b> <span class="inv-mini">${invFecha(x.desde)} → ${invFecha(x.hasta)}${esAdmin ? ' · ' + LOCAL_NOMBRE[x.local] : ''}</span>
            <span class="inv-chip ${x.estado}">${x.estado === 'borrador' ? '📝 Borrador (no publicado)' : x.estado === 'publicado' ? '🟢 En curso' : '🔒 Cerrado'}</span></div>
          <div class="inv-barra"><div style="width:${pct}%"></div></div>
          <div class="inv-mini">${x.hojas} hojas · ${x.controladas} controladas · ${x.contadas} a controlar · ${x.contando} contando · ${x.pendientes} pendientes
            · ${x.skus} SKU, ${pct} % controlado${x.skus_con_dif ? ` · <b style="color:#b45309">${x.skus_con_dif} con diferencia</b>` : ''}</div>
        </div>`; }).join('')
      : '<div class="inv-vacio">Todavía no hay inventarios armados. "Armar cuatrimestre" genera las hojas del período.</div>'}
    </div>` : ''}`;
}

// ── Armar cuatrimestre ───────────────────────────────────────────────
async function invNuevoCiclo() {
  const local = esAdmin ? (INV.local || 'oficina') : miLocalStock;
  const { data: emps, error } = await sb.rpc('stock_inv_empleados', { p_local: local });
  if (error) { toast('No pude leer el personal: ' + error.message); return; }
  const hoy = new Date(), anio = hoy.getFullYear(), cuatri = Math.floor(hoy.getMonth() / 4) + 1;
  const c = document.getElementById('view-inventario');
  c.innerHTML = `<div class="card inv-card">
    <h3 class="inv-h3">➕ Armar cuatrimestre · ${LOCAL_NOMBRE[local]}</h3>
    <p class="inv-mini" style="margin:0 0 10px">El sistema toma todos los artículos con stock del local, los agrupa por proveedor y tipo en hojas de 30 a 60 SKU,
      y las reparte parejas en 16 semanas entre las personas marcadas. Después podés mover hojas de persona o de semana antes de publicar.</p>
    <div class="inv-row">
      <label>Año <select id="inv-anio" class="inv-sel">${[anio - 1, anio, anio + 1].map(a => `<option ${a === anio ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
      <label>Cuatrimestre <select id="inv-cuatri" class="inv-sel">
        <option value="1" ${cuatri === 1 ? 'selected' : ''}>C1 · enero–abril</option>
        <option value="2" ${cuatri === 2 ? 'selected' : ''}>C2 · mayo–agosto</option>
        <option value="3" ${cuatri === 3 ? 'selected' : ''}>C3 · septiembre–diciembre</option></select></label>
    </div>
    <div style="margin:10px 0 4px;font-weight:700;font-size:13px">¿Quiénes cuentan?</div>
    ${(emps || []).map(e => `<label class="inv-check"><input type="checkbox" value="${e.id}" ${e.rol === 'empleado' || local === 'oficina' ? 'checked' : ''}> ${escHtml(e.nombre)} <span class="inv-mini">${e.rol === 'gerente' ? 'encargada' : ''}</span></label>`).join('')}
    <div class="inv-row" style="margin-top:14px;justify-content:flex-end">
      <button class="inv-btn gh" onclick="invInit()">Cancelar</button>
      <button class="inv-btn" onclick="invGenerar('${local}')">Generar hojas</button>
    </div></div>`;
}
async function invGenerar(local) {
  const ids = [...document.querySelectorAll('#view-inventario input[type=checkbox]:checked')].map(i => +i.value);
  if (!ids.length) { toast('Marcá al menos una persona.'); return; }
  const anio = +document.getElementById('inv-anio').value, cuatri = +document.getElementById('inv-cuatri').value;
  const { data, error } = await sb.rpc('stock_inv_generar', { p_local: local, p_anio: anio, p_cuatri: cuatri, p_empleados: ids });
  if (error) { toast(error.message); return; }
  toast(`✓ ${data.hojas} hojas armadas. Revisalas y publicá.`);
  await invInit(); invAbrirCiclo(data.ciclo_id);
}

// ── Ciclo: hojas por semana (encargada / admin) ─────────────────────
async function invAbrirCiclo(id) {
  const ciclo = INV.ciclos.find(x => x.id === id) || (await sb.rpc('stock_inv_ciclos', { p_local: null })).data?.find(x => x.id === id);
  if (!ciclo) return;
  INV.ciclo = ciclo;
  const [{ data: hojas, error }, { data: emps }] = await Promise.all([sb.rpc('stock_inv_hojas', { p_ciclo: id }), sb.rpc('stock_inv_empleados', { p_local: ciclo.local })]);
  if (error) { toast(error.message); return; }
  INV.hojas = hojas || []; INV.emps = emps || [];
  const c = document.getElementById('view-inventario');
  const sem = {}; INV.hojas.forEach(h => (sem[h.semana] ||= []).push(h));
  const hoy = new Date().toISOString().slice(0, 10);
  const porPersona = {}; INV.hojas.forEach(h => { const p = porPersona[h.empleado_nombre] ||= { n: 0, ok: 0, dif: 0 }; p.n++; if (h.estado === 'controlada') p.ok++; p.dif += h.con_diferencia || 0; });
  c.innerHTML = `<div class="card inv-card">
    <div class="inv-row"><button class="inv-btn gh" onclick="invInit()">‹ Volver</button>
      <h3 class="inv-h3" style="flex:1">${ciclo.anio} · C${ciclo.cuatri} · ${LOCAL_NOMBRE[ciclo.local]}</h3>
      ${ciclo.estado === 'borrador' ? `<button class="inv-btn" onclick="invPublicar(${id})">📣 Publicar</button>
        <button class="inv-btn gh" style="color:#b91c1c" onclick="invBorrarCiclo(${id})">Borrar</button>` : `<span class="inv-chip ${ciclo.estado}">${ciclo.estado === 'publicado' ? '🟢 En curso' : '🔒 Cerrado'}</span>`}
    </div>
    <p class="inv-mini">${ciclo.estado === 'borrador' ? 'Borrador: las vendedoras todavía no lo ven. Podés cambiar persona o semana de cualquier hoja y después publicar.' : 'Tocá una hoja contada para controlarla. Las pendientes se pueden reasignar.'}</p>
    <div class="inv-mini" style="margin:6px 0 10px">${Object.entries(porPersona).map(([n, p]) => `<span class="inv-chip">${escHtml(n)}: ${p.ok}/${p.n}${p.dif ? ` · ${p.dif} dif` : ''}</span>`).join(' ')}</div>
    ${Object.keys(sem).sort((a, b) => a - b).map(s => `
      <div class="inv-sem ${sem[s][0].semana_desde <= hoy && hoy < invSumar(sem[s][0].semana_desde, 7) ? 'actual' : ''}">
        <div class="inv-sem-tit">Semana ${s} <span class="inv-mini">desde el ${invFecha(sem[s][0].semana_desde)}</span></div>
        ${sem[s].map(h => `<div class="inv-hoja ${h.estado}" onclick="invAbrirHoja(${h.id})">
          <div class="inv-hoja-top"><b>${escHtml(h.empleado_nombre || '—')}</b> <span class="inv-chip">${invEstado(h.estado)}</span></div>
          <div class="inv-hoja-tit">${escHtml(h.titulo)}</div>
          <div class="inv-mini">${h.skus} SKU · ${Math.round(h.unidades)} unidades${h.con_diferencia ? ` · <b style="color:#b45309">${h.con_diferencia} con diferencia</b>` : ''}${h.controlada_at ? ` · controlada ${invFecha(String(h.controlada_at).slice(0, 10))}` : ''}</div>
          ${h.estado === 'pendiente' ? `<div class="inv-row" style="margin-top:6px" onclick="event.stopPropagation()">
            <select class="inv-sel" onchange="invReasignar(${h.id}, +this.value, null)"><option value="">↔ persona…</option>${INV.emps.map(e => `<option value="${e.id}" ${e.id === h.empleado_id ? 'selected' : ''}>${escHtml(e.nombre)}</option>`).join('')}</select>
            <select class="inv-sel" onchange="invReasignar(${h.id}, null, +this.value)">${Array.from({ length: 16 }, (_, i) => `<option value="${i + 1}" ${i + 1 === h.semana ? 'selected' : ''}>Semana ${i + 1}</option>`).join('')}</select>
          </div>` : ''}
        </div>`).join('')}
      </div>`).join('')}
  </div>`;
}
const invSumar = (iso, d) => { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
async function invReasignar(hoja, emp, semana) {
  const { error } = await sb.rpc('stock_inv_reasignar', { p_hoja: hoja, p_empleado: emp, p_semana: semana });
  if (error) { toast(error.message); return; }
  toast('✓ Hoja movida'); invAbrirCiclo(INV.ciclo.id);
}
async function invPublicar(id) {
  if (!confirm('Publicar el cuatrimestre: a partir de ahora cada persona ve sus hojas y puede empezar a contar. ¿Confirmás?')) return;
  const { error } = await sb.rpc('stock_inv_publicar', { p_ciclo: id });
  if (error) { toast(error.message); return; }
  // aviso a cada persona con hojas
  const porEmp = {}; INV.hojas.forEach(h => { if (h.empleado_id) porEmp[h.empleado_id] = (porEmp[h.empleado_id] || 0) + 1; });
  for (const [emp, n] of Object.entries(porEmp)) {
    try { await sb.functions.invoke('enviar-push', { body: { empleado_id: +emp, app: 'stock', title: '📋 Inventario del cuatrimestre',
      body: `Tenés ${n} hoja${n > 1 ? 's' : ''} de inventario asignada${n > 1 ? 's' : ''}. Entrá a Stock › Inventario para ver cuándo te toca cada una.`, tag: 'inv-publicado', url: './?vista=inventario' } }); } catch (_) {}
  }
  toast('✓ Publicado'); await invInit(); invAbrirCiclo(id);
}
async function invBorrarCiclo(id) {
  if (!confirm('¿Borrar este borrador con todas sus hojas?')) return;
  const { error } = await sb.rpc('stock_inv_borrar_ciclo', { p_ciclo: id });
  if (error) { toast(error.message); return; }
  toast('Borrado'); invInit();
}

// ── La hoja ──────────────────────────────────────────────────────────
async function invAbrirHoja(id) {
  const { data, error } = await sb.rpc('stock_inv_hoja', { p_hoja: id });
  if (error) { toast(error.message); return; }
  INV.hoja = data;
  const h = data.hoja;
  if (data.gestiona && (h.estado === 'contada' || h.estado === 'controlada')) invRenderControl();
  else if (data.gestiona && h.estado !== 'contando' && h.estado !== 'pendiente') invRenderControl();
  else invRenderConteo();
}

// Conteo a ciegas (vendedora). También lo ve la encargada mientras la hoja está pendiente/contando (solo lectura si no es suya).
function invRenderConteo() {
  const d = INV.hoja, h = d.hoja, items = d.items;
  const c = document.getElementById('view-inventario');
  const cerrada = h.estado === 'contada' || h.estado === 'controlada';
  const segunda = items.filter(i => i.conteo1 != null && i.difiere && i.conteo2 == null);
  const sinContar = items.filter(i => i.conteo1 == null);
  c.innerHTML = `<div class="card inv-card">
    <div class="inv-row"><button class="inv-btn gh" onclick="${d.gestiona && INV.ciclo ? 'invAbrirCiclo(' + h.ciclo_id + ')' : 'invInit()'}">‹ Volver</button>
      <h3 class="inv-h3" style="flex:1">Semana ${h.semana} · ${escHtml(h.titulo)}</h3></div>
    <div class="inv-mini" style="margin-bottom:8px">${escHtml(h.empleado_nombre || '')} · ${h.skus} artículos · ${invEstado(h.estado)}</div>
    ${cerrada ? '<div class="inv-aviso ok">Esta hoja ya está cerrada. Gracias por contar.</div>' : `
    <div class="inv-aviso">Contá lo que hay físicamente y escribí la cantidad. <b>Si no hay nada, poné 0.</b> No vas a ver el stock del sistema:
      si algo no coincide, el sistema te lo marca en amarillo para que lo cuentes de nuevo, sin decirte cuánto hay.</div>
    ${segunda.length ? `<div class="inv-aviso warn"><b>${segunda.length} artículo${segunda.length > 1 ? 's' : ''} para volver a contar</b> (en amarillo). Contalos otra vez y guardá.</div>` : ''}`}
    <div class="inv-lista">
      ${items.map(i => {
        const estado = i.conteo1 == null ? 'nuevo' : (i.difiere && i.conteo2 == null) ? 'recontar' : 'ok';
        return `<div class="inv-item ${estado}${i.fuera_de_hoja ? ' extra' : ''}" data-sku="${escHtml(i.sku)}">
          ${i.foto ? `<img src="${escHtml(i.foto)}" loading="lazy" alt="">` : '<div class="inv-nofoto">📦</div>'}
          <div class="inv-item-txt"><div class="inv-item-desc">${escHtml(i.descripcion || i.sku)}</div>
            <div class="inv-mini">${escHtml(i.sku)}${i.fuera_de_hoja ? ' · agregado' : ''}${estado === 'recontar' ? ' · <b style="color:#b45309">volver a contar</b>' : ''}${estado === 'ok' && !cerrada ? ' · ✓' : ''}</div></div>
          ${cerrada ? `<div class="inv-cant-fija">${invN(i.conteo2 ?? i.conteo1)}</div>`
            : estado === 'ok' ? `<div class="inv-cant-fija">${invN(i.conteo1)}</div>`
            : `<input class="inv-cant" type="number" inputmode="numeric" min="0" step="1" data-sin-miles placeholder="¿cuántos?" data-ronda="${estado === 'recontar' ? 2 : 1}" value="">`}
        </div>`; }).join('')}
    </div>
    ${cerrada ? '' : `
    <div class="inv-row" style="margin-top:10px">
      <input id="inv-extra-sku" class="inv-sel" placeholder="SKU que encontraste y no está en la hoja" style="flex:1">
      <input id="inv-extra-cant" class="inv-sel" type="number" inputmode="numeric" min="0" placeholder="cant." style="width:70px" data-sin-miles>
      <button class="inv-btn gh" onclick="invAgregarSku()">➕</button>
    </div>
    <div class="inv-row" style="margin-top:14px;justify-content:flex-end;gap:8px">
      <button class="inv-btn gh" onclick="invGuardarConteo(false)">💾 Guardar lo contado</button>
      <button class="inv-btn" onclick="invGuardarConteo(true)" ${sinContar.length || segunda.length ? 'title="Primero hay que contar todo"' : ''}>✅ Terminé la hoja</button>
    </div>`}
  </div>`;
}
async function invGuardarConteo(cerrar) {
  const h = INV.hoja.hoja;
  const r1 = [], r2 = [];
  document.querySelectorAll('#view-inventario .inv-item').forEach(el => {
    const inp = el.querySelector('input.inv-cant'); if (!inp || inp.value === '') return;
    (inp.dataset.ronda === '2' ? r2 : r1).push({ sku: el.dataset.sku, cantidad: Number(inp.value) });
  });
  if (!r1.length && !r2.length && !cerrar) { toast('No escribiste ninguna cantidad.'); return; }
  let res = null;
  if (r1.length) { const { data, error } = await sb.rpc('stock_inv_contar', { p_hoja: h.id, p_items: r1, p_ronda: 1 }); if (error) { toast(error.message); return; } res = data; }
  if (r2.length) { const { data, error } = await sb.rpc('stock_inv_contar', { p_hoja: h.id, p_items: r2, p_ronda: 2 }); if (error) { toast(error.message); return; } res = data; }
  if (cerrar) {
    const { data, error } = await sb.rpc('stock_inv_cerrar', { p_hoja: h.id });
    if (error) { toast(error.message); await invAbrirHoja(h.id); return; }
    try { await sb.functions.invoke('enviar-push', { body: { local: h.local, app: 'stock', title: '📋 Hoja de inventario terminada',
      body: `${h.empleado_nombre || 'Una vendedora'} terminó "${h.titulo.slice(0, 50)}" (semana ${h.semana})${data.con_diferencia ? ` · ${data.con_diferencia} artículo(s) con diferencia` : ' · sin diferencias'}. Entrá a Stock › Inventario para controlarla.`,
      tag: 'inv-hoja-' + h.id, url: './?vista=inventario' } }); } catch (_) {}
    toast('✓ Hoja cerrada. Le avisamos a la encargada.');
  } else if (res) {
    toast(res.para_segunda_contada ? `Guardado. ${res.para_segunda_contada} artículo(s) para volver a contar.` : (res.sin_contar ? `Guardado. Faltan ${res.sin_contar}.` : '✓ Guardado, todo coincide.'));
  }
  await invAbrirHoja(h.id);
}
async function invAgregarSku() {
  const sku = document.getElementById('inv-extra-sku').value.trim(), cant = document.getElementById('inv-extra-cant').value;
  if (!sku || cant === '') { toast('Poné el SKU y la cantidad.'); return; }
  const { data, error } = await sb.rpc('stock_inv_agregar_sku', { p_hoja: INV.hoja.hoja.id, p_sku: sku, p_cantidad: Number(cant) });
  if (error) { toast(error.message); return; }
  toast('✓ Agregado ' + data.sku); invAbrirHoja(INV.hoja.hoja.id);
}

// ── Control (encargada / admin) ──────────────────────────────────────
function invRenderControl() {
  const d = INV.hoja, h = d.hoja, items = d.items;
  const c = document.getElementById('view-inventario');
  const controlada = h.estado === 'controlada';
  const movidos = items.filter(i => i.stock_cierre != null && i.stock_foto != null && i.stock_cierre !== i.stock_foto);
  const ajustes = items.filter(i => i.decision === 'ajustar' && Number(i.ajuste));
  const apellido = (h.empleado_nombre || '').split(' ')[0].toUpperCase();
  c.innerHTML = `<div class="card inv-card">
    <div class="inv-row"><button class="inv-btn gh" onclick="${INV.ciclo ? 'invAbrirCiclo(' + h.ciclo_id + ')' : 'invInit()'}">‹ Volver</button>
      <h3 class="inv-h3" style="flex:1">Control · semana ${h.semana} · ${escHtml(h.titulo)}</h3></div>
    <div class="inv-mini" style="margin-bottom:8px">Contó ${escHtml(h.empleado_nombre || '')} · cerró el ${h.contada_at ? new Date(h.contada_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
      ${controlada ? ` · <b style="color:#166534">controlada por ${escHtml(h.controlada_por || '')} el ${new Date(h.controlada_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</b>` : ''}</div>
    ${controlada ? '' : `<div class="inv-aviso">Los marcados con 🎯 son el picking: los que dieron diferencia más un 15 % al azar. Recontalos, escribí lo que viste
      y decidí en cada diferencia si se ajusta o no. Al marcar la hoja controlada te queda la lista para cargar en el Dragonfish.</div>`}
    ${movidos.length ? `<div class="inv-aviso warn">⚠ ${movidos.length} artículo${movidos.length > 1 ? 's' : ''} cambió de stock mientras se contaba (ventas o traslados): la diferencia se compara contra el stock de cuando se abrió la hoja.</div>` : ''}
    <div class="inv-tabla-wrap"><table class="inv-tabla"><thead><tr><th>Artículo</th><th>Sist.</th><th>1ª</th><th>2ª</th><th>Dif.</th><th>Recuento</th><th>Decisión</th></tr></thead><tbody>
      ${items.map(i => {
        const ult = i.conteo2 ?? i.conteo1, dif = ult == null ? null : ult - (i.stock_foto ?? 0);
        return `<tr class="${dif ? 'dif' : ''}${i.picking ? ' pick' : ''}" data-sku="${escHtml(i.sku)}">
          <td><div class="inv-item-desc">${i.picking ? '🎯 ' : ''}${escHtml(i.descripcion || i.sku)}</div><div class="inv-mini">${escHtml(i.sku)}${i.fuera_de_hoja ? ' · <b>agregado por la vendedora</b>' : ''}${i.stock_cierre != null && i.stock_cierre !== i.stock_foto ? ` · se movió a ${i.stock_cierre}` : ''}</div></td>
          <td class="num">${invN(i.stock_foto)}</td><td class="num">${invN(i.conteo1)}</td><td class="num">${invN(i.conteo2)}</td>
          <td class="num ${dif > 0 ? 'mas' : dif < 0 ? 'menos' : ''}">${dif == null ? '' : (dif > 0 ? '+' : '') + dif}</td>
          <td>${controlada ? invN(i.recuento_enc) : `<input class="inv-cant chica" type="number" inputmode="numeric" min="0" data-sin-miles value="${invN(i.recuento_enc)}">`}</td>
          <td>${controlada ? (i.decision === 'ajustar' ? `ajustar (${i.ajuste > 0 ? '+' : ''}${i.ajuste})` : i.decision === 'no_ajustar' ? 'no ajustar' : '')
            : (dif || i.recuento_enc != null) ? `<select class="inv-sel chica"><option value="">—</option><option value="ajustar" ${i.decision === 'ajustar' ? 'selected' : ''}>Ajustar</option><option value="no_ajustar" ${i.decision === 'no_ajustar' ? 'selected' : ''}>No ajustar</option></select>` : ''}</td>
        </tr>`; }).join('')}
    </tbody></table></div>
    ${controlada || ajustes.length ? `<div class="card" style="margin-top:12px;padding:12px">
      <b>Para cargar en el Dragonfish</b> · movimiento motivo <b>INV</b> · observación <b>${escHtml(apellido)}</b>
      ${ajustes.length ? `<table class="inv-tabla" style="margin-top:6px"><thead><tr><th>SKU</th><th>Artículo</th><th>Ajuste</th></tr></thead><tbody>
        ${ajustes.map(i => `<tr><td>${escHtml(i.sku)}</td><td>${escHtml(i.descripcion || '')}</td><td class="num ${i.ajuste > 0 ? 'mas' : 'menos'}">${i.ajuste > 0 ? '+' : ''}${i.ajuste}</td></tr>`).join('')}
      </tbody></table>
      <button class="inv-btn gh" style="margin-top:8px" onclick="invCopiarAjustes()">📋 Copiar lista</button>` : '<div class="inv-mini">Sin ajustes: todo coincidió.</div>'}
      ${h.obs_control ? `<div class="inv-mini" style="margin-top:6px">Obs.: ${escHtml(h.obs_control)}</div>` : ''}
    </div>` : ''}
    ${controlada ? '' : `
    <label class="inv-mini" style="display:block;margin-top:10px">Observaciones <input id="inv-obs" class="inv-sel" style="width:100%" placeholder="opcional"></label>
    <div class="inv-row" style="margin-top:12px;justify-content:flex-end;gap:8px">
      <button class="inv-btn gh" onclick="invGuardarControl(false)">💾 Guardar</button>
      <button class="inv-btn" onclick="invGuardarControl(true)">✅ Marcar controlada</button>
    </div>`}
  </div>`;
}
async function invGuardarControl(cerrar) {
  const h = INV.hoja.hoja, items = [];
  document.querySelectorAll('#view-inventario tr[data-sku]').forEach(tr => {
    const rec = tr.querySelector('input.inv-cant'), dec = tr.querySelector('select');
    const it = { sku: tr.dataset.sku };
    if (rec && rec.value !== '') it.recuento = Number(rec.value);
    if (dec && dec.value) it.decision = dec.value;
    if (it.recuento != null || it.decision) items.push(it);
  });
  if (cerrar && !confirm('Marcar la hoja como controlada. Después no se edita. ¿Cargaste (o vas a cargar) los ajustes en el Dragonfish con motivo INV?')) return;
  const { data, error } = await sb.rpc('stock_inv_controlar', { p_hoja: h.id, p_items: items, p_cerrar: cerrar, p_obs: document.getElementById('inv-obs')?.value || null });
  if (error) { toast(error.message); return; }
  toast(cerrar ? '✓ Hoja controlada' : '✓ Guardado');
  await invAbrirHoja(h.id);
}
function invCopiarAjustes() {
  const h = INV.hoja.hoja, ap = (h.empleado_nombre || '').split(' ')[0].toUpperCase();
  const txt = INV.hoja.items.filter(i => i.decision === 'ajustar' && Number(i.ajuste)).map(i => `${i.sku}\t${i.ajuste > 0 ? '+' : ''}${i.ajuste}\t${i.descripcion || ''}`).join('\n');
  navigator.clipboard?.writeText(`INV ${ap} · semana ${h.semana} · ${h.titulo}\n${txt}`).then(() => toast('Lista copiada')).catch(() => toast('No se pudo copiar'));
}

// ── estilos ──
(function () {
  const s = document.createElement('style');
  s.textContent = `
  .inv-card{padding:14px;margin:0 0 12px}.inv-h3{font-size:16px;margin:0 0 8px}.inv-mini{font-size:12px;color:#64748b}
  .inv-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.inv-sel{padding:8px 10px;border:1px solid #cbd5e1;border-radius:9px;font-size:14px;font-family:inherit;background:#fff}
  .inv-sel.chica,.inv-cant.chica{padding:5px 7px;font-size:13px;width:84px}
  .inv-btn{background:var(--primary,#1d4ed8);color:#fff;border:none;border-radius:9px;padding:9px 14px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}
  .inv-btn.gh{background:#fff;color:#334155;border:1px solid #cbd5e1}
  .inv-hoja{border:1px solid #e2e8f0;border-radius:11px;padding:10px 12px;margin:8px 0;cursor:pointer;background:#fff}
  .inv-hoja.contando{border-color:#fbbf24;background:#fffbeb}.inv-hoja.contada{border-color:#60a5fa;background:#eff6ff}.inv-hoja.controlada{opacity:.75}
  .inv-hoja-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.inv-hoja-tit{font-weight:600;margin:3px 0}
  .inv-chip{font-size:11.5px;border-radius:999px;padding:2px 8px;background:#f1f5f9;color:#334155;margin-left:auto}
  .inv-chip.publicado{background:#dcfce7;color:#166534}.inv-chip.borrador{background:#fef3c7;color:#92400e}
  .inv-barra{height:7px;background:#e2e8f0;border-radius:4px;overflow:hidden;margin:6px 0 4px}.inv-barra div{height:100%;background:#16a34a}
  .inv-sem{border-left:3px solid #e2e8f0;padding-left:10px;margin:12px 0}.inv-sem.actual{border-left-color:#16a34a}.inv-sem-tit{font-weight:700;font-size:13.5px}
  .inv-check{display:block;padding:6px 0;font-size:14px}.inv-vacio{color:#64748b;text-align:center;padding:18px;font-size:14px}
  .inv-aviso{background:#f1f5f9;border-radius:9px;padding:9px 11px;font-size:13px;margin:0 0 10px}.inv-aviso.warn{background:#fef3c7;color:#92400e}.inv-aviso.ok{background:#dcfce7;color:#166534}
  .inv-item{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9}
  .inv-item img,.inv-nofoto{width:52px;height:52px;object-fit:cover;border-radius:8px;background:#f1f5f9;flex:none;display:flex;align-items:center;justify-content:center;font-size:22px}
  .inv-item-txt{flex:1;min-width:0}.inv-item-desc{font-weight:600;font-size:14px;line-height:1.25}
  .inv-item.recontar{background:#fef3c7;margin:0 -6px;padding:8px 6px;border-radius:8px}.inv-item.ok .inv-item-desc{color:#64748b;font-weight:500}.inv-item.extra{background:#eff6ff}
  .inv-cant{width:88px;padding:10px 8px;font-size:18px;text-align:center;border:2px solid #cbd5e1;border-radius:10px;font-family:inherit}
  .inv-item.recontar .inv-cant{border-color:#f59e0b}.inv-cant-fija{width:88px;text-align:center;font-size:18px;font-weight:700;color:#334155}
  .inv-tabla-wrap{overflow-x:auto}.inv-tabla{width:100%;border-collapse:collapse;font-size:13px}.inv-tabla th,.inv-tabla td{padding:6px 5px;border-bottom:1px solid #f1f5f9;text-align:left;vertical-align:top}
  .inv-tabla td.num,.inv-tabla th.num{text-align:right}.inv-tabla tr.dif{background:#fff7ed}.inv-tabla tr.pick td:first-child{font-weight:600}.inv-tabla td.mas{color:#166534;font-weight:700}.inv-tabla td.menos{color:#b91c1c;font-weight:700}`;
  document.head.appendChild(s);
})();
