// =====================================================================
// inventario.js · Conecta el catálogo con el inventario del sistema
//   Ebenezer System Post · Sensación Aromas Originales
//   Pregunta a la base de datos el precio y si hay existencia de cada
//   producto enlazado, y muestra "Agotado" cuando no hay.
//   Solo LEE datos públicos del catálogo: no ve costos, ventas ni clientes.
//   No cambies este archivo: si algo cambia, se descarga otro desde el sistema.
// =====================================================================
(function () {
  var SUPABASE_URL = "";
  var SUPABASE_KEY = "";

  function claveCatalogo(nombre) {
    return String(nombre || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\(\s*tallas?[^)]*\)/g, ' ')
      .replace(/\(\s*oferta\s*\)/g, ' ')
      .replace(/\b\d+([.,]\d+)?\s*(ml|oz|fl\.?\s*oz|gr?)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  // Estilos de "Agotado"
  var css = document.createElement('style');
  css.textContent =
    '.product-card.inv-agotado .product-img-container{position:relative}' +
    '.product-card.inv-agotado .product-img-container img{filter:grayscale(.85);opacity:.6}' +
    '.inv-sello{position:absolute;top:10px;left:10px;z-index:2;background:rgba(20,20,20,.82);color:#fff;font-size:12px;font-weight:700;letter-spacing:.04em;padding:5px 10px;border-radius:999px;pointer-events:none}' +
    '.product-card.inv-agotado .btn-add-cart{background:#bbb!important;border-color:#bbb!important;color:#fff!important;cursor:not-allowed}' +
    '.size-pill.inv-sin{opacity:.35;text-decoration:line-through;cursor:not-allowed}';
  document.head.appendChild(css);

  var datos = null;

  function dinero(n) { return '$' + Number(n).toFixed(2); }

  function aplicarTarjeta(card) {
    if (!datos) return;
    var nombreEl = card.querySelector('.product-name');
    if (!nombreEl) return;
    var info = datos[claveCatalogo(nombreEl.textContent)];
    if (!info) return; // producto no enlazado: se queda como está

    // Precio (no se toca si la tarjeta está en oferta)
    var precioEl = card.querySelector('.product-price');
    var enOferta = !!card.querySelector('.product-price-old');
    if (precioEl && info.precio && !enOferta) {
      if (precioEl.textContent !== dinero(info.precio)) precioEl.textContent = dinero(info.precio);
      var btn = card.querySelector('.btn-add-cart');
      if (btn) {
        var oc = btn.getAttribute('onclick') || '';
        var nuevo = oc.replace(/,\s*[0-9.]+\s*\)\s*;?\s*$/, ', ' + Number(info.precio).toFixed(2) + ')');
        if (nuevo !== oc) btn.setAttribute('onclick', nuevo);
      }
    }

    // Tallas sin existencia
    var hayTallas = Object.keys(info.tallas).length > 0;
    card.querySelectorAll('.size-pill').forEach(function (pill) {
      var t = pill.textContent.trim().toUpperCase();
      var sin = hayTallas && info.tallas[t] === false;
      pill.classList.toggle('inv-sin', sin);
      pill.disabled = sin;
      if (sin) pill.classList.remove('selected');
    });

    // Disponible / Agotado
    var cont = card.querySelector('.product-img-container');
    var sello = cont && cont.querySelector('.inv-sello');
    var addBtn = card.querySelector('.btn-add-cart');
    if (!info.disponible) {
      card.classList.add('inv-agotado');
      if (cont && !sello) {
        sello = document.createElement('span');
        sello.className = 'inv-sello';
        sello.textContent = 'Agotado';
        cont.appendChild(sello);
      }
      if (addBtn) {
        if (!addBtn.hasAttribute('data-inv-texto')) addBtn.setAttribute('data-inv-texto', addBtn.innerHTML);
        addBtn.disabled = true;
        if (addBtn.textContent !== 'Agotado') addBtn.textContent = 'Agotado';
      }
    } else {
      card.classList.remove('inv-agotado');
      if (sello) sello.remove();
      if (addBtn && addBtn.hasAttribute('data-inv-texto')) {
        addBtn.innerHTML = addBtn.getAttribute('data-inv-texto');
        addBtn.removeAttribute('data-inv-texto');
        addBtn.disabled = false;
      }
    }
  }

  function aplicarTodo() {
    document.querySelectorAll('.product-card').forEach(aplicarTarjeta);
  }

  function cargar() {
    if (!SUPABASE_URL || !SUPABASE_KEY || !window.fetch) return;
    fetch(SUPABASE_URL + '/rest/v1/rpc/catalogo_publico', {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: '{}'
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (filas) {
        if (!Array.isArray(filas)) return;
        var mapa = {};
        filas.forEach(function (f) {
          var m = mapa[f.clave] || (mapa[f.clave] = { disponible: false, precio: null, precioTodos: null, tallas: {} });
          var p = f.precio_usd != null ? Number(f.precio_usd) : null;
          if (f.disponible) {
            m.disponible = true;
            if (p != null && (m.precio == null || p < m.precio)) m.precio = p;
          }
          if (p != null && (m.precioTodos == null || p < m.precioTodos)) m.precioTodos = p;
          if (f.talla) m.tallas[f.talla] = m.tallas[f.talla] || !!f.disponible;
        });
        // precio más bajo de lo que hay; si nada hay, el más bajo de todos
        Object.keys(mapa).forEach(function (k) { if (mapa[k].precio == null) mapa[k].precio = mapa[k].precioTodos; });
        datos = mapa;
        aplicarTodo();
        // Las tarjetas del carrusel 3D se dibujan con JavaScript: se revisan cada vez que cambian
        document.querySelectorAll('.carousel-3d-ring, [id^="carousel3dRing-"]').forEach(function (ring) {
          new MutationObserver(function () { ring.querySelectorAll('.product-card').forEach(aplicarTarjeta); })
            .observe(ring, { childList: true, subtree: true });
        });
      })
      .catch(function () { /* sin conexión: el catálogo se queda como está */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cargar);
  else cargar();
})();
