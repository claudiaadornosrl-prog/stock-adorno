// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  🔐 PERMISOS POR FUNCIÓN DESDE EL HUB — Stock (14-nov-2026, OK de JP en la charla de Stock)
//  JP define en el Hub (ícono de persona → Permisos) qué puede hacer cada perfil, función por función:
//   · 'h' habilitada.
//   · 'a' pide permiso: se ve, y al usarla pide el usuario y la clave de alguien que la tenga habilitada (cliente aparte
//     que no guarda sesión, marcado data-adorno-superior para la traba de equipo). La operación se hace con la sesión
//     de quien autorizó. Para MIRAR alcanza con autorizar una vez: vale hasta recargar la página.
//   · 'o' no se muestra.
//  hub_puedo('<id>') y hub_mis_locales() con la sesión de la pantalla. Para un local que no es de la persona hace
//  falta además 'stock.operar_otros_locales'. La base controla lo mismo (stock_puede): esto es para no mostrar lo que
//  después rebota. Si el Hub no contesta, la pantalla no esconde nada (la base igual decide).
//  Lo usan index.html, inventario.js y lector.html: necesita sb, toast, SUPA_URL y SUPA_KEY de la página.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const FUNC_STOCK = {
  'stock.buscar': 'Buscar artículos',
  'stock.stock_ahora': 'Pedir el stock al momento',
  'stock.listas': 'Ver las listas de productos',
  'stock.listas_ordenar': 'Ordenar la lista del local',
  'stock.listas_editar': 'Agregar o editar modelos de las listas',
  'stock.redistribucion': 'Ver y decidir la redistribución',
  'stock.no_trabajamos': 'Marcar «no lo trabajamos»',
  'stock.traslados': 'Pedir y responder traslados',
  'stock.inv_armar': 'Armar el inventario y repartir hojas',
  'stock.inv_contar': 'Contar las hojas del inventario',
  'stock.inv_controlar': 'Controlar el inventario',
  'stock.rfid_leer': 'Leer etiquetas RFID',
  'stock.rfid_comparar': 'Comparar lo leído con el sistema',
  'stock.operar_otros_locales': 'Pedir o decidir en nombre de otro local',
};
const PERM_LOCAL = { alcorta: 'Alcorta', unicenter: 'Unicenter', oficina: 'Oficina' };
let PERM = null, MIS_LOCALES = [];
const PERM_VISTO = new Set();   // funciones para mirar que ya autorizó alguien en esta carga de la página

async function cargarPermisos() {
  const ids = Object.keys(FUNC_STOCK);
  try {
    const [rs, loc] = await Promise.all([Promise.all(ids.map(f => sb.rpc('hub_puedo', { p_funcion: f }))), sb.rpc('hub_mis_locales')]);
    if (rs.some(r => r.error) || loc.error) throw new Error('el Hub no contestó');
    const p = {}; ids.forEach((f, i) => { p[f] = rs[i].data || 'o'; });
    PERM = p; MIS_LOCALES = (loc.data || []).map(l => String(l).toLowerCase());
  } catch (_) { PERM = null; MIS_LOCALES = []; }
}
const permiso = f => PERM ? (PERM[f] || 'o') : 'h';
const veo = f => permiso(f) !== 'o';
const opeTodos = () => permiso('stock.operar_otros_locales') === 'h';   // ve y decide por todos los locales
// Cómo está la función para ESE local: si no es de la persona, manda también «operar en nombre de otro local»
function permisoEn(f, local) {
  const p = permiso(f);
  if (p === 'o' || !local || !PERM) return p;
  if (MIS_LOCALES.includes(String(local).toLowerCase())) return p;
  const o = permiso('stock.operar_otros_locales');
  return o === 'o' ? 'o' : (o === 'a' || p === 'a') ? 'a' : 'h';
}
const veoEn = (f, local) => permisoEn(f, local) !== 'o';
// (16-nov-2026, pedido de Infra) «Ver como»: JP mira el módulo con los permisos de otra cuenta, en solo lectura
// (/hub/banner.js deja window.ADORNO_VERCOMO). No se graba nada ni se abre la cámara: lo habilitado o apagado avisa qué le
// pasaría a esa persona; lo que «pide permiso» (para hacer o para mirar) abre la misma ventana «Pedir autorización» que le
// aparece a ella, pero no autoriza nada (JP: «ver que la parte de pedir permiso esté funcionando bien»).
const verComo = () => !!window.ADORNO_VERCOMO;
function avisoVerComo(f, local, p) {
  const que = (FUNC_STOCK[f] || f) + (local ? ' (' + (PERM_LOCAL[local] || local) + ')' : '');
  const quien = (window.ADORNO_VERCOMO && ADORNO_VERCOMO.nombre) || 'Esta cuenta';
  toast('👁 ' + quien + (p === 'h' ? ' puede: ' : p === 'a' ? ' tendría que pedir autorización para: ' : ' no tiene habilitado: ') + que + '. En «Ver como» no se graba nada.');
}

// Cliente con el que hacer la operación: sb si está habilitada, el de quien autorizó si pide permiso, null si no se puede
async function clientePara(f, local) {
  const p = permisoEn(f, local);
  if (verComo() && p !== 'a') { avisoVerComo(f, local, p); return null; }
  if (p === 'h') return sb;
  if (p !== 'a') {
    toast('Tu perfil no tiene habilitado: ' + (FUNC_STOCK[f] || f) + (local ? ' (' + (PERM_LOCAL[local] || local) + ')' : '') + '. Pedíselo a administración (Hub → Permisos).');
    return null;
  }
  return pedirSuperior(f, local);
}
function soltarCli(db) { if (db && db !== sb) { try { db.auth.signOut({ scope: 'local' }); } catch (_) {} } }

// Para MIRAR un apartado: habilitada, o autorizada una vez en esta carga
async function puedeVer(f) {
  const p = permiso(f);
  if (p === 'h' || PERM_VISTO.has(f)) return true;
  if (p !== 'a') return false;
  const db = await pedirSuperior(f, null);
  if (!db) return false;
  PERM_VISTO.add(f); soltarCli(db); return true;
}

const permEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function permCss() {
  if (document.getElementById('sup-login-css')) return;
  const st = document.createElement('style'); st.id = 'sup-login-css';
  st.textContent = `
#sup-login { position: fixed; inset: 0; background: rgba(28,22,18,.45); z-index: 99980; display: flex; align-items: center; justify-content: center; padding: 16px; }
#sup-login .sup-box { background: #fff; color: #1c1917; border-radius: 26px; padding: 22px 20px 16px; max-width: 400px; width: 100%; box-shadow: 0 24px 50px -16px rgba(28,22,18,.45); }
#sup-login .sup-tit { font-size: 17px; font-weight: 700; margin-bottom: 6px; }
#sup-login .sup-txt { font-size: 13px; color: #57534e; line-height: 1.45; margin-bottom: 12px; }
#sup-login input { width: 100%; box-sizing: border-box; padding: 10px 16px; margin-bottom: 8px; border: 1px solid #e2e8f0; border-radius: 999px; font-size: 15px; font-family: inherit; }
#sup-login .sup-err { min-height: 18px; font-size: 12px; color: #b91c1c; margin-bottom: 6px; }
#sup-login .sup-pie { display: flex; gap: 10px; justify-content: flex-end; }
#sup-login .sup-pie button { font: inherit; font-size: 14px; padding: 9px 20px; border-radius: 999px; border: 1px solid #d6d3d1; background: transparent; color: #1c1917; cursor: pointer; }
#sup-login .sup-pie button.pri { background: #4F6B68; color: #fff; border-color: transparent; }
#sup-login .sup-pie button:disabled { opacity: .5; cursor: default; }`;
  document.head.appendChild(st);
}

// Ventana de usuario superior: autoriza quien, con SU sesión, pasa hub_autoriza (admin, o una PERSONA con legajo y la
// función habilitada: las cuentas de los locales y de la oficina nunca autorizan) y, si va con local, stock_puede para
// ese local. Devuelve su cliente (sin sesión guardada) o null si canceló.
function pedirSuperior(f, local) {
  return new Promise(listo => {
    permCss();
    document.getElementById('sup-login')?.remove();
    const d = document.createElement('div'); d.id = 'sup-login'; d.setAttribute('data-adorno-superior', '1');
    const que = (FUNC_STOCK[f] || f) + (local ? ' en ' + (PERM_LOCAL[local] || local) : '');
    d.innerHTML = `<div class="sup-box" role="dialog" aria-modal="true">
      <div class="sup-tit">Pedir autorización</div>
      <div class="sup-txt">Para <b>${permEsc(que)}</b> tiene que autorizar alguien que tenga ese permiso, con <b>su usuario personal</b>
        (por ejemplo, la encargada o administración). Las cuentas de los locales y de la oficina no autorizan. No queda abierto en este equipo.</div>
      <input id="sup-mail" type="email" placeholder="usuario (mail) de quien autoriza" autocomplete="off" autocapitalize="off" spellcheck="false">
      <input id="sup-clave" type="password" placeholder="su clave" autocomplete="new-password">
      <div id="sup-err" class="sup-err"></div>
      <div class="sup-pie"><button type="button" id="sup-no">Cancelar</button><button type="button" class="pri" id="sup-si">Autorizar</button></div></div>`;
    document.body.appendChild(d);
    const q = id => d.querySelector('#' + id), err = q('sup-err'), si = q('sup-si');
    const vc = verComo();   // «Ver como»: la misma ventana que le aparece a esa cuenta, sin escribir ni mandar nada
    if (vc) {
      d.querySelector('.sup-txt').insertAdjacentHTML('afterend', '<div class="sup-txt" style="color:#8a5a14"><b>👁 Modo «Ver como»</b>: así le aparece el pedido de permiso a esta cuenta. Es solo para mirar: no se autoriza nada.</div>');
      q('sup-mail').disabled = true; q('sup-clave').disabled = true;
    }
    const fin = v => { d.remove(); listo(v); };
    q('sup-no').onclick = () => fin(null);
    q('sup-clave').addEventListener('keydown', e => { if (e.key === 'Enter') si.click(); });
    d.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); fin(null); } });
    setTimeout(() => q('sup-mail').focus(), 50);
    si.onclick = async () => {
      if (vc) { toast('Modo «Ver como»: acá autorizaría con su usuario y clave. No se autoriza nada.'); return; }
      const em = (q('sup-mail').value || '').trim().toLowerCase(), pw = q('sup-clave').value || '';
      err.textContent = '';
      if (!em || !pw) { err.textContent = 'Completá el mail y la clave.'; return; }
      let yo = '';
      try { yo = String((await sb.auth.getUser()).data?.user?.email || '').toLowerCase(); } catch (_) {}
      if (yo && em === yo) { err.textContent = 'Tiene que ser el usuario de quien autoriza, no el de esta sesión.'; return; }
      si.disabled = true; si.textContent = 'Autorizando…';
      const cli = window.supabase.createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'adorno-stock-superior' } });
      const salir = async () => { try { await cli.auth.signOut({ scope: 'local' }); } catch (_) {} };
      try {
        const r = await cli.auth.signInWithPassword({ email: em, password: pw });
        if (r.error) throw new Error('Mail o clave incorrectos.');
        if (window.ADORNO_MFA?.pedirCodigo && !(await ADORNO_MFA.pedirCodigo(cli))) { await salir(); throw new Error('Sin el código del celular no se puede autorizar.'); }
        const [a, p] = await Promise.all([
          cli.rpc('hub_autoriza', { p_funcion: f, p_local: null }),
          local ? cli.rpc('stock_puede', { p_funcion: f, p_local: local }) : Promise.resolve({ data: true })]);
        if (a.error || a.data !== true || p.error || p.data !== true) {
          await salir();
          throw new Error('Ese usuario no puede autorizar ' + que + ': tiene que ser una persona (no la cuenta del local ni de la oficina) con esa función habilitada' + (local ? ' para ese local' : '') + '.');
        }
        cli._sup = em; toast('Autorizó ' + em); fin(cli);
      } catch (e) { err.textContent = e.message || 'No se pudo autorizar.'; si.disabled = false; si.textContent = 'Autorizar'; }
    };
  });
}
