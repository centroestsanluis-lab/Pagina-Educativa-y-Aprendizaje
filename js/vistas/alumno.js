// Panel del alumno: inicio, tareas, materias, biblioteca, juegos y logros.
import { h, vaciar, fecha, nota100, colorNota, vacio, cargando } from '../ui.js';
import { store } from '../store/index.js';
import { inst, mascota } from '../tema.js';
import { S, navegar, grado, materia } from '../app.js';
import { barra, itemRecurso, ordenar, miga } from './comun.js';

let cache = null; // datos del alumno de esta visita
async function datos(forzar = false) {
  if (cache && !forzar && Date.now() - cache.t < 20000) return cache;
  const g = S.yo.gradoId;
  const [acts, entregas, resultados, temas, recursos] = await Promise.all([
    store.list('actividades', [['gradoId', '==', g], ['publicada', '==', true]]),
    store.list('entregas', [['alumnoId', '==', S.uid]]),
    store.list('resultados', [['alumnoId', '==', S.uid], ['visibleAlumno', '==', true]]),
    store.list('temas', [['gradoId', '==', g], ['visible', '==', true]]),
    store.list('recursos', [['gradoId', '==', g], ['visible', '==', true]]),
  ]);
  const ahora = Date.now();
  const visibles = acts.filter((a) => !a.fechaPublicacion || a.fechaPublicacion <= ahora);
  const resPorAct = {};
  for (const r of resultados) if (!resPorAct[r.actividadId] || r.intento > resPorAct[r.actividadId].intento) resPorAct[r.actividadId] = r;
  const entPorAct = {};
  for (const e of entregas) (entPorAct[e.actividadId] ||= []).push(e);
  cache = { t: Date.now(), acts: visibles, entPorAct, resPorAct, temas: ordenar(temas), recursos: ordenar(recursos), resultados };
  return cache;
}
export function olvidarDatos() { cache = null; }

export function estadoAlumno(a, d) {
  const ents = d.entPorAct[a.id] || [];
  const res = d.resPorAct[a.id];
  const cerrada = a.fechaLimite && a.fechaLimite < Date.now();
  if (res && res.estado === 'calificada') return { texto: `Nota: ${nota100(res.puntaje, res.puntajeMax)}`, clase: colorNota(nota100(res.puntaje, res.puntajeMax)), hecho: true };
  if (ents.length) return { texto: res?.estado === 'revision' ? 'En revisión' : 'Entregada ✔', clase: 'e-azul', hecho: true };
  if (cerrada) return { texto: 'Cerrada', clase: 'e-gris', hecho: false, cerrada: true };
  return { texto: 'Pendiente', clase: 'e-naranja', hecho: false };
}

const NAV = () => [
  ['/', '🏠', 'Inicio', 'var(--azul)'],
  ['/tareas', inst.iconos.tareas, inst.titulos.tareas, 'var(--rojo)'],
  ['/biblioteca', inst.iconos.biblioteca, inst.titulos.biblioteca, 'var(--morado)'],
  ['/juegos', inst.iconos.juegos, inst.titulos.juegos, 'var(--verde)'],
  ['/logros', inst.iconos.logros, inst.titulos.logros, 'var(--naranja)'],
];

function marco(raiz, activa) {
  const cont = h('main', { class: 'contenido' });
  vaciar(raiz).append(h('div', { class: 'escenario' + (inst.fondo ? ' con-fondo-img' : '') },
    barra(`${grado(S.yo.gradoId).nombre}${S.yo.seccion ? ' · Sección ' + S.yo.seccion : ''}`),
    inst.banner?.activo && inst.banner.texto ? h('div', { style: { background: inst.banner.color, color: '#fff', textAlign: 'center', padding: '8px', fontWeight: 900 } }, inst.banner.texto) : null,
    cont,
    h('nav', { class: 'nav-alumno', 'aria-label': 'Menú principal' }, NAV().map(([ruta, ic, t, c]) =>
      h('button', { class: ruta === activa ? 'activo' : '', style: { '--c': c }, onclick: () => navegar(ruta) }, h('span', { class: 'ic' }, ic), t)))));
  return cont;
}

export async function render(raiz, partes, cancelada) {
  const [r, p1, p2] = partes;
  if (r === 'actividad') {
    const m = await import('./resolver.js');
    return m.renderResolver(marco(raiz, '/tareas'), p1, () => { olvidarDatos(); });
  }
  if (r === 'juegos' || r === 'juego') {
    const m = await import('../juegos/motor.js');
    const cont = marco(raiz, '/juegos');
    return r === 'juego' ? m.renderJuego(cont, p1, Number(p2) || null) : m.renderCatalogo(cont);
  }
  const cont = marco(raiz, '/' + (r || ''));
  cargando(cont);
  const d = await datos(r === undefined);
  if (cancelada()) return;
  vaciar(cont);
  if (r === 'tareas') return vistaTareas(cont, d);
  if (r === 'materia') return vistaMateria(cont, d, p1);
  if (r === 'biblioteca') return vistaBiblioteca(cont, d);
  if (r === 'logros') return vistaLogros(cont, d);
  return vistaInicio(cont, d);
}

function vistaInicio(cont, d) {
  const misMaterias = S.materias.filter((m) => m.visible !== false && (m.grados || []).includes(S.yo.gradoId));
  const pendientes = d.acts.filter((a) => !estadoAlumno(a, d).hecho && !estadoAlumno(a, d).cerrada);
  const nombre = S.yo.nombre.split(' ')[0];
  cont.append(
    h('div', { class: 'saludo' },
      h('img', { class: 'lu', src: mascota(), alt: 'LU' }),
      h('div', { class: 'burbuja' }, '¡Hola, ', h('b', null, nombre), '! ', inst.preguntaAlumno,
        pendientes.length ? h('div', { class: 'chico', style: { marginTop: '6px', color: 'var(--tinta)' } }, `Tienes ${pendientes.length} tarea(s) pendiente(s).`) : null)),
    pendientes.length ? h('button', { class: 'btn rojo grande', style: { marginBottom: '20px' }, onclick: () => navegar('/tareas') }, `📝 Ver mis tareas (${pendientes.length})`) : null,
    h('h2', null, 'Mis materias'),
    misMaterias.length ? h('div', { class: 'rejilla chica' }, misMaterias.map((m) => {
      const n = pendientes.filter((a) => a.materiaId === m.id).length;
      return h('button', { class: 'mosaico', style: { '--c': m.color }, onclick: () => navegar('/materia/' + m.id) },
        n ? h('span', { class: 'insignia' }, n) : null, h('span', { class: 'icono' }, m.icono || '📘'), m.nombre);
    })) : vacio('Todavía no hay materias asignadas a tu grado.'),
  );
}

function filaActividad(a, d) {
  const e = estadoAlumno(a, d); const m = materia(a.materiaId);
  return h('button', { class: 'item', onclick: () => navegar('/actividad/' + a.id) },
    h('span', { class: 'ic-redondo', style: { '--c': m.color } }, m.icono || '📝'),
    h('span', { class: 'cuerpo' }, h('strong', null, a.titulo), h('small', null, m.nombre, a.fechaLimite ? ' · Entregar antes del ' + fecha(a.fechaLimite) : '')),
    h('span', { class: 'etiqueta-estado ' + e.clase }, e.texto));
}

function vistaTareas(cont, d) {
  const lista = d.acts.slice().sort((a, b) => (a.fechaLimite || 9e15) - (b.fechaLimite || 9e15));
  const pend = lista.filter((a) => !estadoAlumno(a, d).hecho && !estadoAlumno(a, d).cerrada);
  const hechas = lista.filter((a) => !pend.includes(a));
  cont.append(h('h1', null, inst.iconos.tareas + ' ' + inst.titulos.tareas),
    h('h2', null, 'Por hacer'),
    pend.length ? h('div', { class: 'lista' }, pend.map((a) => filaActividad(a, d))) : vacio('¡Muy bien! No tienes tareas pendientes. 🎉'),
    h('h2', { style: { marginTop: '24px' } }, 'Terminadas y cerradas'),
    hechas.length ? h('div', { class: 'lista' }, hechas.map((a) => filaActividad(a, d))) : h('p', { class: 'texto-suave' }, 'Aquí aparecerán tus tareas terminadas.'));
}

function vistaMateria(cont, d, materiaId) {
  const m = materia(materiaId);
  const temas = d.temas.filter((t) => t.materiaId === materiaId);
  const sinTema = (lista) => lista.filter((x) => x.materiaId === materiaId && !temas.some((t) => t.id === x.temaId));
  cont.append(miga([['Inicio', '/'], [m.nombre]]), h('h1', null, `${m.icono || ''} ${m.nombre}`));
  const bloque = (titulo, recursos, acts) => (recursos.length || acts.length) ? h('section', { class: 'tarjeta' },
    h('h2', null, titulo),
    acts.length ? h('div', { class: 'lista', style: { marginBottom: '12px' } }, acts.map((a) => filaActividad(a, d))) : null,
    recursos.length ? h('div', { class: 'lista' }, recursos.map((r) => itemRecurso(r))) : null) : null;
  const partes = temas.map((t) => bloque(t.nombre, d.recursos.filter((r) => r.temaId === t.id), d.acts.filter((a) => a.temaId === t.id)));
  partes.push(bloque('Otros materiales', sinTema(d.recursos), sinTema(d.acts)));
  const algo = partes.filter(Boolean);
  cont.append(algo.length ? algo : vacio('Tu maestra o maestro todavía no ha subido materiales para esta materia.'));
}

function vistaBiblioteca(cont, d) {
  cont.append(h('h1', null, inst.iconos.biblioteca + ' ' + inst.titulos.biblioteca));
  if (!d.recursos.length) { cont.append(vacio('Aún no hay materiales en tu biblioteca.')); return; }
  const porMateria = {};
  for (const r of d.recursos) (porMateria[r.materiaId] ||= []).push(r);
  for (const [mid, lista] of Object.entries(porMateria)) {
    const m = materia(mid);
    cont.append(h('section', { class: 'tarjeta' }, h('h2', null, `${m.icono || ''} ${m.nombre}`), h('div', { class: 'lista' }, lista.map((r) => itemRecurso(r)))));
  }
}

function vistaLogros(cont, d) {
  const total = d.acts.length;
  const hechas = d.acts.filter((a) => estadoAlumno(a, d).hecho).length;
  const califs = Object.values(d.resPorAct).filter((r) => r.estado === 'calificada');
  const prom = califs.length ? Math.round(califs.reduce((s, r) => s + nota100(r.puntaje, r.puntajeMax), 0) / califs.length) : null;
  const estrellas = prom === null ? 0 : prom >= 90 ? 3 : prom >= 70 ? 2 : prom >= 50 ? 1 : 0;
  cont.append(h('h1', null, inst.iconos.logros + ' ' + inst.titulos.logros),
    h('div', { class: 'saludo' }, h('img', { class: 'lu', src: mascota(), alt: '' }),
      h('div', { class: 'burbuja' }, prom === null ? '¡Completa tus tareas para ganar estrellas!' : `${'⭐'.repeat(estrellas) || '💪'} ¡Tu promedio es ${prom}! Sigue así.`)),
    h('div', { class: 'cifras' },
      h('div', { class: 'cifra', style: { '--c': 'var(--verde)' } }, h('b', null, `${hechas}/${total}`), h('span', null, 'Tareas hechas')),
      h('div', { class: 'cifra', style: { '--c': 'var(--azul)' } }, h('b', null, prom ?? '—'), h('span', null, 'Promedio')),
      h('div', { class: 'cifra', style: { '--c': 'var(--naranja)' } }, h('b', null, total - hechas), h('span', null, 'Por hacer'))),
    h('div', { class: 'progreso', style: { marginBottom: '20px' } }, h('div', { style: { width: (total ? (hechas / total) * 100 : 0) + '%' } })));
  // Progreso por materia
  const porMat = {};
  for (const a of d.acts) { const x = (porMat[a.materiaId] ||= { total: 0, hechas: 0, notas: [] }); x.total++; if (estadoAlumno(a, d).hecho) x.hechas++; const r = d.resPorAct[a.id]; if (r?.estado === 'calificada') x.notas.push(nota100(r.puntaje, r.puntajeMax)); }
  if (Object.keys(porMat).length) {
    cont.append(h('section', { class: 'tarjeta' }, h('h2', null, 'Mi avance por materia'),
      Object.entries(porMat).map(([mid, x]) => {
        const m = materia(mid); const p = x.notas.length ? Math.round(x.notas.reduce((a, b) => a + b, 0) / x.notas.length) : null;
        return h('div', { class: 'barra-h' }, h('span', null, `${m.icono || ''} ${m.nombre}`),
          h('div', { class: 'pista' }, h('div', { style: { width: (x.hechas / x.total) * 100 + '%', background: m.color } })),
          h('span', { class: 'etiqueta-estado ' + (p === null ? 'e-gris' : colorNota(p)) }, p ?? `${x.hechas}/${x.total}`));
      })));
  }
  const lista = califs.sort((a, b) => (b.calificado || 0) - (a.calificado || 0));
  cont.append(h('section', { class: 'tarjeta' }, h('h2', null, 'Mis calificaciones'),
    lista.length ? h('div', { class: 'tabla-envoltura' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Actividad'), h('th', null, 'Materia'), h('th', { class: 'num' }, 'Puntos'), h('th', { class: 'num' }, 'Nota'))),
      h('tbody', null, lista.map((r) => {
        const a = d.acts.find((x) => x.id === r.actividadId); const n = nota100(r.puntaje, r.puntajeMax);
        return h('tr', null, h('td', null, a?.titulo || r.titulo || 'Actividad'), h('td', null, materia(r.materiaId).nombre),
          h('td', { class: 'num' }, `${r.puntaje} / ${r.puntajeMax}`), h('td', { class: 'num' }, h('span', { class: 'etiqueta-estado ' + colorNota(n) }, n)));
      })))) : h('p', { class: 'texto-suave' }, 'Aquí verás tus notas cuando tu maestra o maestro las publique.')));
}
