// Utilidades de interfaz: construcción de elementos, avisos, ventanas, fechas, CSV.

// Permite escribir el.append(lista, condicion ? x : null): aplana listas e ignora vacíos.
const aplanar = (hijos) => hijos.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false);
const appendNativo = Element.prototype.append;
Element.prototype.append = function (...hijos) { appendNativo.apply(this, aplanar(hijos)); };

/** Crea un elemento. h('div', {class:'x', onclick: fn}, 'texto', otroNodo) */
export function h(tag, attrs, ...hijos) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
      else if (k === 'html') el.innerHTML = v; // solo con textos propios, nunca con datos del usuario
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  agregar(el, hijos);
  return el;
}
function agregar(el, hijos) {
  for (const c of hijos) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) agregar(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
export function vaciar(el) { while (el.firstChild) el.firstChild.remove(); return el; }

/** Aviso flotante breve. */
export function aviso(texto, tipo = '') {
  const cont = document.getElementById('avisos');
  const a = h('div', { class: 'aviso ' + tipo }, texto);
  cont.append(a);
  setTimeout(() => a.remove(), tipo === 'error' ? 5000 : 2800);
}

/** Ventana modal. botones: [{texto, clase, valor, accion}] — devuelve una promesa con el valor elegido. */
export function modal({ titulo, contenido, botones = [{ texto: 'Cerrar', clase: 'claro', valor: null }], ancho = false, alAbrir }) {
  return new Promise((resolver) => {
    const raiz = document.getElementById('modal-raiz');
    const cerrar = (v) => { fondo.remove(); document.removeEventListener('keydown', esc); resolver(v); };
    const esc = (e) => { if (e.key === 'Escape') cerrar(null); };
    const caja = h('div', { class: 'modal' + (ancho ? ' ancho' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo || 'Ventana' },
      titulo ? h('h2', null, titulo) : null,
      typeof contenido === 'string' ? h('p', null, contenido) : contenido,
      botones.length ? h('div', { class: 'fila-botones derecha', style: { marginTop: '16px' } },
        botones.map((b) => h('button', {
          class: 'btn ' + (b.clase || ''), type: 'button',
          onclick: async (e) => {
            if (b.accion) {
              const btn = e.currentTarget; btn.disabled = true;
              try { const r = await b.accion(caja); if (r === false) { btn.disabled = false; return; } cerrar(r === undefined ? b.valor : r); }
              catch (err) { btn.disabled = false; aviso(mensajeError(err), 'error'); }
            } else cerrar(b.valor);
          }
        }, b.texto))) : null);
    const fondo = h('div', { class: 'modal-fondo', onclick: (e) => { if (e.target === fondo) cerrar(null); } }, caja);
    raiz.append(fondo);
    document.addEventListener('keydown', esc);
    const primero = caja.querySelector('input, select, textarea');
    if (primero) setTimeout(() => primero.focus(), 50);
    if (alAbrir) alAbrir(caja, cerrar);
  });
}
export const confirmar = (texto, { si = 'Sí, continuar', clase = 'rojo', titulo = '¿Está seguro?' } = {}) =>
  modal({ titulo, contenido: texto, botones: [{ texto: 'Cancelar', clase: 'claro', valor: false }, { texto: si, clase, valor: true }] });

/** Campo de formulario con etiqueta. */
export function campo(etiqueta, control, ayuda) {
  const id = control.id || ('c' + Math.random().toString(36).slice(2, 9));
  control.id = id;
  return h('div', { class: 'campo' }, h('label', { for: id }, etiqueta), control, ayuda ? h('span', { class: 'ayuda' }, ayuda) : null);
}
export function selector(opciones, valor, attrs = {}) {
  return h('select', attrs, opciones.map(([v, t]) => h('option', { value: v, selected: String(v) === String(valor) }, t)));
}
export function casilla(texto, marcada, attrs = {}) {
  return h('label', { class: 'casilla' }, h('input', { type: 'checkbox', checked: !!marcada, ...attrs }), texto);
}

/** Campo de contraseña con botón para mostrar/ocultar. */
export function campoClave(attrs = {}) {
  const inp = h('input', { type: 'password', autocomplete: 'current-password', ...attrs });
  const b = h('button', { type: 'button', 'aria-label': 'Mostrar u ocultar', onclick: () => { inp.type = inp.type === 'password' ? 'text' : 'password'; } }, '👁️');
  const envoltura = h('div', { class: 'mostrar-clave' }, inp, b);
  envoltura.input = inp;
  return envoltura;
}

// ---------- Fechas ----------
const fmtFecha = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtFechaHora = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const fecha = (ms) => (ms ? fmtFecha.format(new Date(ms)) : '—');
export const fechaHora = (ms) => (ms ? fmtFechaHora.format(new Date(ms)) : '—');
/** ms → valor para <input type=datetime-local> */
export function aInputFecha(ms) {
  if (!ms) return '';
  const d = new Date(ms); const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export const deInputFecha = (v) => (v ? new Date(v).getTime() : null);

// ---------- Texto ----------
export function normalizar(t) {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
export function slug(t) { return normalizar(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }
export function barajar(arr, semilla) {
  const a = arr.slice();
  let s = semilla ?? Math.floor(Math.random() * 1e9);
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Mensajes de error comprensibles para personas sin conocimientos técnicos. */
export function mensajeError(err) {
  const c = err?.code || err?.message || String(err);
  const mapa = {
    'auth/invalid-credential': 'Usuario o contraseña incorrectos.',
    'auth/wrong-password': 'Usuario o contraseña incorrectos.',
    'auth/user-not-found': 'Usuario o contraseña incorrectos.',
    'auth/invalid-email': 'El usuario o correo no tiene un formato válido.',
    'auth/too-many-requests': 'Demasiados intentos. Por seguridad, espere unos minutos e intente de nuevo.',
    'auth/user-disabled': 'Esta cuenta está desactivada. Hable con la administración.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese usuario o correo.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/requires-recent-login': 'Por seguridad, vuelva a escribir su contraseña actual.',
    'auth/network-request-failed': 'No hay conexión a internet. Revise el Wi-Fi.',
    'permission-denied': 'No tiene permiso para realizar esta acción.',
    'unavailable': 'No hay conexión con el servidor. Revise el Wi-Fi.',
    'not-found': 'No se encontró la información solicitada.',
  };
  for (const [k, v] of Object.entries(mapa)) if (c.includes(k)) return v;
  return err?.mensaje || err?.message || 'Ocurrió un problema. Intente de nuevo.';
}
export class ErrorCesl extends Error { constructor(code, mensaje) { super(mensaje || code); this.code = code; this.mensaje = mensaje; } }

// ---------- Archivos ----------
export function descargar(nombre, contenido, tipo = 'text/plain') {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
  const a = h('a', { href: URL.createObjectURL(blob), download: nombre });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
/** Descarga un CSV que abre bien en Excel y Google Sheets (UTF-8 con BOM, separado por comas). */
export function descargarCSV(nombre, filas) {
  const celda = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const texto = '﻿' + filas.map((f) => f.map(celda).join(',')).join('\r\n');
  descargar(nombre.endsWith('.csv') ? nombre : nombre + '.csv', texto, 'text/csv;charset=utf-8');
}
/** Reduce una imagen a un tamaño ligero para las tablets. Devuelve data URL. */
export function comprimirImagen(archivo, maxLado = 900, calidad = 0.8) {
  return new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onerror = () => mal(new ErrorCesl('imagen', 'No se pudo leer la imagen.'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => mal(new ErrorCesl('imagen', 'El archivo no es una imagen válida.'));
      img.onload = () => {
        const esc = Math.min(1, maxLado / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const png = archivo.type === 'image/png' && maxLado <= 600;
        let url = c.toDataURL(png ? 'image/png' : 'image/webp', calidad);
        if (!png && !url.startsWith('data:image/webp')) url = c.toDataURL('image/jpeg', calidad);
        ok(url);
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}
export function leerArchivoTexto(archivo) {
  return new Promise((ok, mal) => { const l = new FileReader(); l.onload = () => ok(l.result); l.onerror = mal; l.readAsText(archivo); });
}
export function leerArchivoBase64(archivo) {
  return new Promise((ok, mal) => { const l = new FileReader(); l.onload = () => ok(String(l.result).split(',')[1]); l.onerror = mal; l.readAsDataURL(archivo); });
}
export function cargando(el, texto = 'Cargando…') {
  vaciar(el).append(h('div', { class: 'vacio' }, h('img', { src: 'img/lu-sm.webp', alt: '' }), texto));
}
export function vacio(texto) { return h('div', { class: 'vacio' }, h('img', { src: 'img/lu-sm.webp', alt: '' }), texto); }
export function porcentaje(p, max) { return max ? Math.round((p / max) * 1000) / 10 : 0; }
/** Nota en escala de 100 (la que se usa en Guatemala). */
export function nota100(p, max) { return max ? Math.round((p / max) * 100) : 0; }
export function colorNota(n) { return n >= 80 ? 'e-verde' : n >= 60 ? 'e-naranja' : 'e-rojo'; }
