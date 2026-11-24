// Piezas compartidas por los tres paneles.
import { h, vaciar, modal, campo, campoClave, aviso, mensajeError } from '../ui.js';
import { store } from '../store/index.js';
import { inst, logo, partesMarca } from '../tema.js';
import { S, salir, navegar } from '../app.js';
import { urlVista, urlDescarga, TIPOS_RECURSO, esUrlSegura } from '../drive.js';

const ROLES = { admin: 'Administración', docente: 'Docente', alumno: 'Alumno' };

export function barra(subtitulo) {
  const [a, b] = partesMarca();
  return h('header', { class: 'barra' },
    h('img', { class: 'logo-mini', src: logo(), alt: '' }),
    h('div', { class: 'titulo' }, `${a} ${b}`, h('small', null, subtitulo || inst.institucion)),
    h('div', { class: 'espacio' }),
    h('div', { class: 'usuario-chip' },
      h('span', { title: S.yo.nombre }, S.yo.nombre),
      h('button', { class: 'salir', onclick: menuUsuario, 'aria-label': 'Mi cuenta' }, '⚙️ ', ROLES[S.yo.rol])));
}

function menuUsuario() {
  modal({
    titulo: S.yo.nombre,
    contenido: h('div', null,
      h('p', null, h('b', null, 'Usuario: '), S.yo.usuario || S.yo.email, h('br'), h('b', null, 'Tipo de cuenta: '), ROLES[S.yo.rol]),
      h('div', { class: 'fila-botones' },
        h('button', { class: 'btn claro', onclick: (e) => { e.target.closest('.modal-fondo').remove(); cambiarClave(); } }, '🔑 Cambiar mi contraseña'),
        h('button', { class: 'btn rojo', onclick: (e) => { e.target.closest('.modal-fondo').remove(); salir(); } }, '🚪 Cerrar sesión'))),
  });
}

export function cambiarClave() {
  const actual = campoClave(); const nueva = campoClave({ autocomplete: 'new-password' }); const rep = campoClave({ autocomplete: 'new-password' });
  modal({
    titulo: 'Cambiar mi contraseña',
    contenido: h('div', null, campo('Contraseña actual', actual), campo('Nueva contraseña', nueva, 'Mínimo 6 caracteres.'), campo('Repetir nueva contraseña', rep)),
    botones: [{ texto: 'Cancelar', clase: 'claro' }, {
      texto: 'Guardar', clase: 'verde', accion: async () => {
        if (nueva.input.value.length < 6) { aviso('Mínimo 6 caracteres.', 'error'); return false; }
        if (nueva.input.value !== rep.input.value) { aviso('Las contraseñas nuevas no coinciden.', 'error'); return false; }
        await store.auth.cambiarClave(actual.input.value, nueva.input.value);
        aviso('Contraseña cambiada.', 'ok');
      },
    }],
  });
}

/** Panel con menú lateral (administración y docentes). */
export function panelConMenu(raiz, subtitulo, opciones, activa) {
  const cont = h('main', { class: 'contenido' });
  vaciar(raiz).append(barra(subtitulo), h('div', { class: 'panel' },
    h('nav', { class: 'menu-lateral', 'aria-label': 'Menú' }, opciones.map(([ruta, ic, texto]) =>
      h('button', { class: ruta === activa ? 'activo' : '', onclick: () => navegar(ruta) }, h('span', { class: 'ic' }, ic), texto))),
    cont));
  return cont;
}

export function encabezado(titulo, ...acciones) {
  return h('div', { class: 'encabezado' }, h('h1', null, titulo), acciones.length ? h('div', { class: 'fila-botones' }, acciones) : null);
}
export function miga(pasos) {
  return h('nav', { class: 'miga', 'aria-label': 'Ubicación' }, pasos.map(([texto, ruta], i) => [
    i ? h('span', null, '›') : null,
    ruta ? h('button', { onclick: () => navegar(ruta) }, texto) : h('span', null, texto),
  ]));
}

/** Abre un material dentro de la plataforma, sin salir a otros sitios. */
export function abrirRecurso(r) {
  const url = urlVista(r);
  if (!url || !(esUrlSegura(url) || url.startsWith('img/'))) { aviso('Este material no tiene una dirección válida.', 'error'); return; }
  const tipo = TIPOS_RECURSO[r.tipo] || TIPOS_RECURSO.enlace;
  const cerrar = () => { visor.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') cerrar(); };
  const cuerpo = r.tipo === 'imagen'
    ? h('div', { class: 'marco-img' }, h('img', { src: url, alt: r.titulo }))
    : h('iframe', { src: url, title: r.titulo, allow: 'autoplay; fullscreen', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin',
      sandbox: 'allow-scripts allow-same-origin allow-presentation' });
  const descargable = r.descargable && (r.url || '').startsWith('https://');
  const visor = h('div', { class: 'visor', role: 'dialog', 'aria-label': r.titulo },
    h('div', { class: 'cab' }, h('span', { style: { fontSize: '1.6rem' } }, tipo.icono), h('h3', null, r.titulo),
      descargable ? h('a', { class: 'btn claro chico', href: urlDescarga(r.url), target: '_blank', rel: 'noopener' }, '⬇️ Descargar') : null,
      h('button', { class: 'btn rojo chico', onclick: cerrar }, '✖ Cerrar')),
    cuerpo);
  document.body.append(visor);
  document.addEventListener('keydown', esc);
}

export function itemRecurso(r, { alAbrir, acciones } = {}) {
  const t = TIPOS_RECURSO[r.tipo] || TIPOS_RECURSO.enlace;
  return h('div', { class: 'item' + (r.visible === false ? ' inactivo' : ''), style: { cursor: 'default' } },
    h('button', { class: 'ic-redondo', style: { '--c': t.color, border: 0, cursor: 'pointer' }, onclick: () => (alAbrir || abrirRecurso)(r), 'aria-label': 'Abrir' }, t.icono),
    h('div', { class: 'cuerpo', onclick: () => (alAbrir || abrirRecurso)(r), style: { cursor: 'pointer' } },
      h('strong', null, r.titulo), h('small', null, t.nombre, r.descripcion ? ' · ' + r.descripcion : '', r.visible === false ? ' · (oculto para alumnos)' : '')),
    acciones ? h('div', { class: 'fila-botones' }, acciones) : null);
}

export function estadoActividad(a, ahora = Date.now()) {
  if (!a.publicada) return ['Borrador / oculta', 'e-gris'];
  if (a.fechaPublicacion && a.fechaPublicacion > ahora) return ['Programada', 'e-azul'];
  if (a.fechaLimite && a.fechaLimite < ahora) return ['Cerrada', 'e-naranja'];
  return ['Publicada', 'e-verde'];
}

export async function intentar(fn, exito) {
  try { const r = await fn(); if (exito) aviso(exito, 'ok'); return r; } catch (e) { console.error(e); aviso(mensajeError(e), 'error'); return undefined; }
}
export const ordenar = (lista, campoOrden = 'orden') => lista.sort((a, b) => (a[campoOrden] ?? 0) - (b[campoOrden] ?? 0) || String(a.nombre || a.titulo || '').localeCompare(b.nombre || b.titulo || ''));
