// ═══════════════════════════════════════════════════════════════════════
//  Stock Adorno · manual.js — Manual de uso (overlay 📖, autoinyectable)
//  🚨 REGLA: cada vez que se agrega o cambia una función del módulo,
//  actualizar la sección correspondiente acá (y bump del ?v= en index.html).
// ═══════════════════════════════════════════════════════════════════════

function _mEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function _manualSecciones() {
  const gerente = (typeof esGerente !== 'undefined' && esGerente) ||
                  (typeof esAdmin !== 'undefined' && esAdmin);

  const base = [
    {
      icon: '🔎', titulo: 'Buscar artículos',
      desc: 'Stock, precio y foto de cualquier artículo en los 3 locales.',
      pasos: [
        'Escribí parte de la descripción o el SKU. Con "🏭 Buscar por proveedor" (menú ⋮) buscás por marca.',
        'Cada resultado muestra el stock por local y el precio vigente (el precio oficial es el de Oficina).',
        'Tocá un artículo para ver los colores y variantes disponibles.',
        'Tus búsquedas recientes quedan guardadas abajo del buscador para repetirlas con un toque.',
        'El rayito ⚡ verifica el stock en vivo contra el servidor del local (por si el número parece viejo).',
      ],
    },
    {
      icon: '📷', titulo: 'Escáner de códigos',
      desc: 'Escaneá el código de barras del producto con la cámara y va directo a la ficha.',
      pasos: [
        'Tocá el ícono de la cámara al lado del buscador.',
        'Apuntá al código de barras — funciona en Android y iPhone.',
        'Si el producto no tiene foto, podés tocar "📷 Pedir foto" y le llega el aviso a Oficina (salvo discontinuados).',
      ],
    },
    {
      icon: '📤', titulo: 'Compartir por WhatsApp',
      desc: 'Mandale la ficha del producto (foto + precio + stock) a una clienta.',
      pasos: [
        'Desde la ficha del artículo, tocá "📤 Compartir".',
        'Se arma el mensaje con la foto y los datos — elegís el contacto y listo.',
      ],
    },
    {
      icon: '🌿', titulo: 'Espalma',
      desc: 'Precios y colores en vivo de los productos Espalma, buscando por patrón.',
      pasos: [
        'Pestaña Espalma → escribí el patrón o parte del nombre.',
        'Muestra el precio actual y los colores disponibles directo de la base.',
      ],
    },
    {
      icon: '🚚', titulo: 'Pedir traslado',
      desc: 'Cuando una clienta quiere algo que no tenés pero otro local sí, pedís el traslado desde acá.',
      pasos: [
        'Desde la ficha del artículo, tocá "Pedir traslado" y elegí el local que tiene stock y la cantidad.',
        'Al local le llega una notificación; la respuesta pasa por: pendiente → revisando → apartado o sin stock.',
        'Cuando respondan, te llega el aviso a vos con el resultado.',
        'Antes de pedir, mirá el 📨 historial — capaz otra compañera ya lo pidió.',
      ],
    },
    {
      icon: '📨', titulo: 'Historial de solicitudes',
      desc: 'Todas las solicitudes de traslado de los últimos 30 días, de todos los locales.',
      pasos: [
        'Pestaña 📨 → ves cada solicitud con su estado y quién la hizo.',
        'Podés buscar por artículo o local.',
        'Si una solicitud está pendiente y es para tu local, tocála para responderla desde ahí.',
      ],
    },
    {
      icon: '⋮', titulo: 'Menú de opciones',
      desc: 'El botón ⋮ de arriba a la derecha agrupa los ajustes.',
      pasos: [
        '🔔 Notificaciones: activalas para enterarte de traslados y avisos. En iPhone requiere la app instalada en pantalla de inicio.',
        '🎯 Solo resultado exacto / 🚫 Ocultar sin stock / 📋 Vista tabla: filtros de búsqueda a gusto.',
        '⬇ Instalar la app: para tenerla como aplicación en el celu.',
      ],
    },
  ];

  if (gerente) {
    base.splice(6, 0, {
      icon: '🔄', titulo: 'Redistribución (encargadas)',
      desc: 'Todos los lunes el sistema sugiere traslados entre sucursales: artículos que un local tiene de sobra y a otro le faltan.',
      pasos: [
        'Los lunes a la mañana te llega una notificación con las sugerencias nuevas.',
        'En la pestaña 🔄 ves cada sugerencia: qué artículo, cuánto sobra en el origen y cuánto falta en destino.',
        '"Pedir traslado" arma la solicitud (podés cambiar la cantidad antes de enviar).',
        '"Ignorar" la saca PARA SIEMPRE — usalo cuando ese local no trabaja esa línea. No vuelve a aparecer.',
        'Son sugerencias: el sistema nunca mueve stock solo, siempre decidís vos.',
      ],
    });
  }
  return base;
}

function abrirManual() {
  if (document.getElementById('manual-overlay')) return;
  const items = _manualSecciones();
  const ov = document.createElement('div');
  ov.id = 'manual-overlay';
  ov.innerHTML = `
    <div class="m-box">
      <div class="m-head">
        <span style="font-size:22px;">📖</span>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:16px;">Manual · Stock</div>
          <div style="font-size:12px;opacity:.85;">Guía rápida de cada herramienta del módulo</div>
        </div>
        <button class="m-close" onclick="cerrarManual()">✕</button>
      </div>
      ${items.map((s, i) => `
        <div class="m-sec">
          <div class="m-tit">${s.icon} ${i + 1}. ${_mEsc(s.titulo)}</div>
          <div class="m-desc">${_mEsc(s.desc)}</div>
          <ul class="m-pasos">${s.pasos.map(p => `<li>${_mEsc(p)}</li>`).join('')}</ul>
        </div>`).join('')}
      <div class="m-foot">💡 Este manual se actualiza junto con el sistema. ¿Falta algo o no funciona? Avisale a JP.</div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) cerrarManual(); });
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';
}

function cerrarManual() {
  const ov = document.getElementById('manual-overlay');
  if (ov) ov.remove();
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarManual(); });

(function _manualInit() {
  const css = document.createElement('style');
  css.textContent = `
    #manual-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:20px 12px;overflow-y:auto;-webkit-overflow-scrolling:touch;}
    #manual-overlay .m-box{background:#f8fafc;border-radius:14px;max-width:760px;width:100%;padding-bottom:6px;box-shadow:0 20px 60px rgba(0,0,0,.3);}
    #manual-overlay .m-head{position:sticky;top:0;background:#1d4ed8;color:#fff;padding:14px 18px;border-radius:14px 14px 0 0;display:flex;align-items:center;gap:10px;z-index:1;}
    #manual-overlay .m-close{background:rgba(255,255,255,.18);border:none;color:#fff;font-size:16px;border-radius:8px;padding:6px 11px;cursor:pointer;}
    #manual-overlay .m-sec{background:#fff;border:1px solid #e2e8f0;border-left:4px solid #1d4ed8;border-radius:10px;margin:14px 14px 0;padding:14px 18px;}
    #manual-overlay .m-tit{font-weight:700;font-size:15px;margin-bottom:4px;color:#1e3a8a;}
    #manual-overlay .m-desc{font-size:13px;color:#475569;margin-bottom:8px;}
    #manual-overlay .m-pasos{margin:0 0 2px 18px;padding:0;font-size:13px;line-height:1.65;color:#334155;}
    #manual-overlay .m-pasos li{margin-bottom:4px;}
    #manual-overlay .m-foot{margin:16px 14px 12px;background:#fef3c7;border-left:4px solid #d97706;border-radius:8px;padding:11px 14px;font-size:12.5px;color:#92400e;}`;
  document.head.appendChild(css);

  const kebab = document.getElementById('kebab-menu');
  if (kebab) {
    const b = document.createElement('button');
    b.textContent = '📖 Manual';
    b.onclick = () => { kebab.classList.remove('open'); abrirManual(); };
    kebab.appendChild(b);
  }
})();
