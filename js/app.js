// =====================================================================
//  CESL Digital — arranque, sesión y navegación
// =====================================================================
import { iniciarStore, store } from './store/index.js';
import { aplicarTema } from './tema.js';
import { h, vaciar, aviso, mensajeError } from './ui.js';

const raiz = document.getElementById('app');
export const S = { yo: null, uid: null, grados: [], materias: [], inst: null };
let vistaActual = 0;

/** Navega a una ruta: navegar('/tareas') */
export function navegar(ruta) {
  if (location.hash === '#' + ruta) mostrar(); else location.hash = ruta;
}
export function rutaActual() { return (location.hash || '#/').slice(1).split('/').filter(Boolean); }
export async function recargarCatalogos() {
  const [g, m] = await Promise.all([store.list('grados'), store.list('materias')]);
  S.grados = g.sort((a, b) => (a.orden || 0) - (b.orden || 0));
  S.materias = m.sort((a, b) => (a.orden || 0) - (b.orden || 0));
}
export const grado = (id) => S.grados.find((g) => g.id === id) || { id, nombre: '(grado eliminado)', corto: '?', color: 'var(--tinta-suave)' };
export const materia = (id) => S.materias.find((m) => m.id === id) || { id, nombre: '(materia eliminada)', icono: '📘', color: 'var(--tinta-suave)' };

async function mostrar() {
  const n = ++vistaActual;
  const partes = rutaActual();
  window.scrollTo(0, 0);
  try {
    let modulo;
    if (!S.uid) modulo = await import('./vistas/login.js');
    else if (S.yo?.debeCambiarPassword) modulo = { render: (r) => import('./vistas/login.js').then((m) => m.renderCambioObligatorio(r)) };
    else if (S.yo.rol === 'admin') modulo = await import('./vistas/admin.js');
    else if (S.yo.rol === 'docente') modulo = await import('./vistas/docente.js');
    else modulo = await import('./vistas/alumno.js');
    if (n !== vistaActual) return;
    await modulo.render(raiz, partes, () => n !== vistaActual);
  } catch (e) {
    console.error(e);
    vaciar(raiz).append(h('div', { class: 'escenario bienvenida' }, h('div', { class: 'tarjeta', style: { maxWidth: '560px' } },
      h('h2', null, 'Algo no salió bien'), h('p', null, mensajeError(e)),
      h('div', { class: 'fila-botones' }, h('button', { class: 'btn', onclick: () => location.reload() }, 'Volver a intentar'),
        S.uid ? h('button', { class: 'btn claro', onclick: salir }, 'Cerrar sesión') : null))));
  }
}

export async function salir() {
  try { await store.auth.salir(); } catch { /* sin conexión */ }
  S.yo = null; S.uid = null;
  navegar('/');
}

async function alCambiarSesion(uid) {
  if (!uid) { S.uid = null; S.yo = null; mostrar(); return; }
  try {
    const yo = await store.get('usuarios', uid);
    if (!yo) { await store.auth.salir(); aviso('Su usuario no tiene perfil en la plataforma. Hable con la administración.', 'error'); return; }
    if (yo.activo !== true) { await store.auth.salir(); aviso('Esta cuenta está desactivada. Hable con la administración.', 'error'); return; }
    S.uid = uid; S.yo = yo;
    await recargarCatalogos();
    if (location.hash && location.hash !== '#/') history.replaceState(null, '', '#/');
    mostrar();
  } catch (e) {
    aviso(mensajeError(e), 'error');
    await store.auth.salir().catch(() => {});
  }
}

// ---- Cierre de sesión por inactividad (tablets compartidas) ----
let ultimoUso = Date.now();
['pointerdown', 'keydown', 'scroll'].forEach((ev) => addEventListener(ev, () => { ultimoUso = Date.now(); }, { passive: true }));
setInterval(() => {
  const min = Number(window.CESL_CONFIG?.minutosInactividad) || 30;
  if (S.uid && Date.now() - ultimoUso > min * 60000) { aviso('Sesión cerrada por inactividad.'); salir(); }
}, 30000);

async function arrancar() {
  try {
    await iniciarStore();
    let inst = null;
    try { inst = await store.get('config', 'institucion'); } catch { /* aún sin configurar */ }
    S.inst = aplicarTema(inst);
    if (store.modo === 'firebase' && !inst) {
      const m = await import('./vistas/login.js');
      return m.renderConfiguracionInicial(raiz);
    }
    addEventListener('hashchange', mostrar);
    store.auth.alCambiar(alCambiarSesion);
  } catch (e) {
    console.error(e);
    vaciar(raiz).append(h('div', { class: 'escenario bienvenida' }, h('div', { class: 'tarjeta', style: { maxWidth: '600px' } },
      h('h2', null, 'No se pudo iniciar CESL Digital'), h('p', null, mensajeError(e)),
      h('button', { class: 'btn', onclick: () => location.reload() }, 'Volver a intentar'))));
  }
}

if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.CESL_SIN_SW) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
arrancar();
