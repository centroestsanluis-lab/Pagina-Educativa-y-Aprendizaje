// Resultados por actividad, revisión manual y calificaciones por grado y materia.
import { h, vaciar, aviso, modal, confirmar, selector, campo, cargando, vacio, fechaHora, nota100, colorNota, descargarCSV, mensajeError } from '../ui.js';
import { store, registrar } from '../store/index.js';
import { S, navegar, grado, materia } from '../app.js';
import { miga, encabezado, estadoActividad, ordenar } from './comun.js';
import { construirResultado, aplicarRevision } from '../calificar.js';
import { pregunta } from './resolver.js';
import { partesClase, nombreClase } from './docente.js';

/** Califica las entregas que aún no tienen nota (cuando no hay servidor de Apps Script o falló). */
export async function calificarPendientes(entregas, resultados, actividades, claves) {
  const porId = Object.fromEntries(resultados.map((r) => [r.id, r]));
  const ops = []; const nuevos = [];
  for (const e of entregas) {
    if (porId[e.id] && e.estado !== 'pendiente') continue;
    const act = actividades[e.actividadId]; if (!act) continue;
    const r = construirResultado(e, act, claves[e.actividadId], S.uid, store.AHORA);
    ops.push({ op: 'set', col: 'resultados', id: e.id, data: r }, { op: 'update', col: 'entregas', id: e.id, data: { estado: r.estado } });
    nuevos.push({ id: e.id, ...r, calificado: Date.now() });
  }
  if (ops.length) await store.lote(ops);
  return nuevos;
}

/** Mejor resultado de cada alumno (cuenta el intento con más puntos). */
export function mejorPorAlumno(resultados) {
  const m = {};
  for (const r of resultados) { const k = r.alumnoId + '|' + r.actividadId; if (!m[k] || r.puntaje > m[k].puntaje || (r.puntaje === m[k].puntaje && r.intento > m[k].intento)) m[k] = r; }
  return m;
}

export async function alumnosDeGrado(gradoId) {
  const a = await store.list('usuarios', [['rol', '==', 'alumno'], ['gradoId', '==', gradoId]]);
  return a.sort((x, y) => (x.seccion || '').localeCompare(y.seccion || '') || x.nombre.localeCompare(y.nombre));
}

// ------------------------------------------------------------------ POR ACTIVIDAD
export async function renderResultadosActividad(cont, actividadId) {
  cargando(cont);
  let act, clave, alumnos, entregas, resultados;
  try {
    act = await store.get('actividades', actividadId);
    if (!act) { vaciar(cont).append(vacio('La actividad no existe.')); return; }
    [clave, alumnos, entregas, resultados] = await Promise.all([
      store.get('claves', actividadId), alumnosDeGrado(act.gradoId),
      store.list('entregas', [['clase', '==', act.clase], ['actividadId', '==', actividadId]]),
      store.list('resultados', [['clase', '==', act.clase], ['actividadId', '==', actividadId]]),
    ]);
    const nuevos = await calificarPendientes(entregas, resultados, { [act.id]: act }, { [act.id]: clave });
    resultados = resultados.filter((r) => !nuevos.some((n) => n.id === r.id)).concat(nuevos);
  } catch (e) { vaciar(cont).append(vacio(mensajeError(e))); return; }
  vaciar(cont);
  const recargar = () => renderResultadosActividad(cont, actividadId);
  const { gradoId, materiaId } = partesClase(act.clase);
  const raiz = S.yo.rol === 'admin' ? ['Contenidos', '/contenidos'] : ['Mis clases', '/'];
  cont.append(miga([raiz, [nombreClase(act.clase), '/clase/' + encodeURIComponent(act.clase)], ['Resultados']]));
  const mejores = mejorPorAlumno(resultados);
  const [est, estC] = estadoActividad(act);
  const notas = Object.values(mejores).filter((r) => r.estado === 'calificada').map((r) => nota100(r.puntaje, r.puntajeMax));
  const entregaron = new Set(entregas.map((e) => e.alumnoId));
  const enRevision = Object.values(mejores).filter((r) => r.estado === 'revision').length;

  cont.append(encabezado(`📊 ${act.titulo}`,
    h('button', { class: 'btn claro', onclick: () => navegar('/editar/' + act.id) }, '✏️ Editar'),
    h('button', { class: 'btn claro', onclick: () => exportar() }, '⬇️ Exportar'),
    h('button', { class: 'btn claro', onclick: () => recalificar() }, '🔄 Recalificar')),
  h('p', null, h('span', { class: 'etiqueta-estado ' + estC }, est), ' ', h('span', { class: 'texto-suave' }, `${grado(gradoId).nombre} · ${materia(materiaId).nombre} · ${act.puntajeTotal} puntos`)),
  h('div', { class: 'cifras' },
    h('div', { class: 'cifra', style: { '--c': 'var(--azul)' } }, h('b', null, `${entregaron.size}/${alumnos.length}`), h('span', null, 'Entregaron')),
    h('div', { class: 'cifra', style: { '--c': 'var(--verde)' } }, h('b', null, notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : '—'), h('span', null, 'Promedio (sobre 100)')),
    h('div', { class: 'cifra', style: { '--c': 'var(--naranja)' } }, h('b', null, enRevision), h('span', null, 'Por revisar')),
    h('div', { class: 'cifra', style: { '--c': 'var(--morado)' } }, h('b', null, act.mostrarNota ? 'Sí' : 'No'), h('span', null, 'Alumnos ven su nota'))),
  h('div', { class: 'fila-botones', style: { marginBottom: '14px' } },
    h('button', { class: 'btn ' + (act.mostrarNota ? 'claro' : 'verde'), onclick: () => cambiarVisibilidad(!act.mostrarNota) }, act.mostrarNota ? '🙈 Ocultar notas a los alumnos' : '📢 Publicar notas a los alumnos')));

  // Tabla de alumnos
  const filas = alumnos.map((a) => {
    const r = mejores[a.id + '|' + act.id]; const n = r ? nota100(r.puntaje, r.puntajeMax) : null;
    const susEntregas = entregas.filter((e) => e.alumnoId === a.id);
    const estado = !susEntregas.length ? h('span', { class: 'etiqueta-estado e-gris' }, 'Sin entregar')
      : r?.estado === 'revision' ? h('span', { class: 'etiqueta-estado e-naranja' }, 'Por revisar')
      : h('span', { class: 'etiqueta-estado e-verde' }, 'Calificada');
    return h('tr', null, h('td', null, a.nombre), h('td', { class: 'num' }, a.seccion || ''), h('td', null, estado),
      h('td', { class: 'num' }, susEntregas.length ? `${susEntregas.length}/${act.intentos || 1}` : '—'),
      h('td', { class: 'num' }, r ? `${r.puntaje}/${r.puntajeMax}` : '—'),
      h('td', { class: 'num' }, n === null ? '—' : h('span', { class: 'etiqueta-estado ' + colorNota(n) }, n)),
      h('td', null, susEntregas.length ? h('div', { class: 'fila-botones' },
        h('button', { class: 'btn chico ' + (r?.estado === 'revision' ? 'naranja' : 'claro'), onclick: () => revisar(a, susEntregas, resultados) }, r?.estado === 'revision' ? '✍️ Revisar' : '👀 Ver'),
        h('button', { class: 'btn peligro chico', title: 'Borra el último intento para que pueda hacerlo de nuevo', onclick: () => devolverIntento(a, susEntregas) }, '↩️')) : null));
  });
  cont.append(h('section', { class: 'tarjeta' }, h('h2', null, 'Alumnos'),
    alumnos.length ? h('div', { class: 'tabla-envoltura' }, h('table', null,
      h('thead', null, h('tr', null, ['Alumno', 'Secc.', 'Estado', 'Intentos', 'Puntos', 'Nota', ''].map((t, i) => h('th', { class: i && i < 6 && i !== 2 ? 'num' : '' }, t)))),
      h('tbody', null, filas))) : vacio('No hay alumnos asignados a este grado.')));

  // Análisis por pregunta (temas que necesitan refuerzo)
  const finales = Object.values(mejores);
  if (finales.length) {
    cont.append(h('section', { class: 'tarjeta' }, h('h2', null, '🎯 ¿Qué preguntas costaron más?'),
      h('p', { class: 'texto-suave chico' }, 'Porcentaje de alumnos que respondió bien cada pregunta. Lo que esté en rojo conviene reforzarlo en clase.'),
      act.preguntas.map((p, i) => {
        const ds = finales.map((r) => r.detalle?.[p.id]).filter((d) => d && !d.pendiente);
        const pct = ds.length ? Math.round((ds.reduce((s, d) => s + d.puntos / d.max, 0) / ds.length) * 100) : null;
        return h('div', { class: 'barra-h' }, h('span', { class: 'chico', title: p.enunciado }, `${i + 1}. ${(p.enunciado || '').slice(0, 40)}${(p.enunciado || '').length > 40 ? '…' : ''}`),
          h('div', { class: 'pista' }, h('div', { style: { width: (pct ?? 0) + '%', background: pct === null ? '#ccc' : pct >= 80 ? 'var(--verde)' : pct >= 60 ? 'var(--naranja)' : 'var(--rojo)' } })),
          h('b', null, pct === null ? '—' : pct + '%'));
      })));
  }

  async function cambiarVisibilidad(v) {
    try {
      const ops = [{ op: 'update', col: 'actividades', id: act.id, data: { mostrarNota: v } }, ...resultados.map((r) => ({ op: 'update', col: 'resultados', id: r.id, data: { visibleAlumno: v } }))];
      await store.lote(ops); registrar(v ? 'Publicó notas' : 'Ocultó notas', act.titulo, S.yo);
      aviso(v ? 'Los alumnos ya pueden ver su nota' : 'Notas ocultas para los alumnos', 'ok'); recargar();
    } catch (e) { aviso(mensajeError(e), 'error'); }
  }
  async function recalificar() {
    if (!(await confirmar('Se volverán a calificar todas las entregas con las respuestas correctas actuales. Las revisiones manuales de preguntas abiertas se conservan.', { si: 'Recalificar', clase: 'verde' }))) return;
    try {
      const ops = [];
      for (const e of entregas) {
        const viejo = resultados.find((r) => r.id === e.id);
        let r = construirResultado(e, act, clave, S.uid, store.AHORA);
        if (viejo) {
          const manuales = {}; for (const [pid, d] of Object.entries(viejo.detalle || {})) if (d.revisadoPorDocente) manuales[pid] = d.puntos;
          if (Object.keys(manuales).length) r = aplicarRevision(r, manuales);
        }
        ops.push({ op: 'set', col: 'resultados', id: e.id, data: r }, { op: 'update', col: 'entregas', id: e.id, data: { estado: r.estado } });
      }
      await store.lote(ops); registrar('Recalificó actividad', act.titulo, S.yo); aviso('Listo: entregas recalificadas', 'ok'); recargar();
    } catch (e) { aviso(mensajeError(e), 'error'); }
  }
  async function devolverIntento(a, susEntregas) {
    const ultima = susEntregas.sort((x, y) => y.intento - x.intento)[0];
    if (!(await confirmar(`Se borrará el intento ${ultima.intento} de ${a.nombre} y su nota, para que pueda hacerlo otra vez.`, { si: 'Borrar intento' }))) return;
    try { await store.lote([{ op: 'del', col: 'resultados', id: ultima.id }, { op: 'del', col: 'entregas', id: ultima.id }]); registrar('Devolvió intento', `${a.nombre} — ${act.titulo}`, S.yo); aviso('Intento borrado', 'ok'); recargar(); }
    catch (e) { aviso(mensajeError(e), 'error'); }
  }
  function revisar(a, susEntregas, todos) {
    const lista = susEntregas.sort((x, y) => y.intento - x.intento);
    const elegir = selector(lista.map((e) => [e.id, `Intento ${e.intento} — ${fechaHora(e.enviada)}`]), lista[0].id);
    const zona = h('div');
    const pintar = () => {
      const e = lista.find((x) => x.id === elegir.value); const r = todos.find((x) => x.id === e.id);
      const puntosManual = {};
      vaciar(zona).append(r ? h('p', null, h('b', null, 'Nota: '), `${nota100(r.puntaje, r.puntajeMax)} (${r.puntaje}/${r.puntajeMax})`) : null,
        act.preguntas.map((p, i) => {
          const d = r?.detalle?.[p.id];
          const caja = pregunta(p, i + 1, e.respuestas?.[p.id], () => {}, { detalle: d, clave: clave?.respuestas?.[p.id] });
          if (d) caja.append(h('label', { class: 'casilla', style: { marginTop: '8px' } }, d.pendiente ? '✍️ Puntos para esta respuesta:' : 'Cambiar puntos (opcional):',
            h('input', { type: 'number', min: 0, max: d.max, step: 0.5, value: d.pendiente ? '' : d.puntos, style: { width: '100px', minHeight: '44px' },
              oninput: (ev) => { if (ev.target.value === '') delete puntosManual[p.id]; else puntosManual[p.id] = Number(ev.target.value); } }), ` de ${d.max}`));
          return caja;
        }));
      zona.guardar = async () => {
        if (!r || !Object.keys(puntosManual).length) return;
        const nuevo = aplicarRevision(r, puntosManual);
        const { id: _i, ...datos } = nuevo;
        await store.lote([{ op: 'set', col: 'resultados', id: r.id, data: { ...datos, calificado: store.AHORA, calificadoPor: S.uid } }, { op: 'update', col: 'entregas', id: r.id, data: { estado: nuevo.estado } }]);
        registrar('Revisó entrega', `${a.nombre} — ${act.titulo}`, S.yo);
        aviso('Revisión guardada', 'ok');
      };
    };
    elegir.onchange = pintar; pintar();
    modal({ titulo: `Respuestas de ${a.nombre}`, ancho: true, contenido: h('div', null, lista.length > 1 ? campo('Intento', elegir) : null, zona),
      botones: [{ texto: 'Cerrar', clase: 'claro' }, { texto: 'Guardar revisión', clase: 'verde', accion: async () => { await zona.guardar(); recargar(); } }] });
  }
  function exportar() {
    const filasCSV = [['Alumno', 'Usuario', 'Sección', 'Intentos', 'Puntos', 'Puntos posibles', 'Nota (100)', 'Estado', ...act.preguntas.map((p, i) => `P${i + 1}`)]];
    for (const a of alumnos) {
      const r = mejores[a.id + '|' + act.id]; const n = entregas.filter((e) => e.alumnoId === a.id).length;
      filasCSV.push([a.nombre, a.usuario, a.seccion || '', n, r?.puntaje ?? '', r?.puntajeMax ?? act.puntajeTotal, r ? nota100(r.puntaje, r.puntajeMax) : '', !n ? 'Sin entregar' : r?.estado === 'revision' ? 'Por revisar' : 'Calificada',
        ...act.preguntas.map((p) => r?.detalle?.[p.id] ? r.detalle[p.id].puntos : '')]);
    }
    descargarCSV(`Resultados - ${act.titulo} - ${grado(gradoId).nombre}`, filasCSV);
  }
}

// ------------------------------------------------------------------ POR GRADO Y MATERIA
export async function renderCalificaciones(cont, clases) {
  vaciar(cont);
  cont.append(encabezado('📊 Calificaciones'));
  if (!clases.length) { cont.append(vacio('No hay clases disponibles.')); return; }
  const grados = [...new Set(clases.map((c) => partesClase(c).gradoId))];
  const selG = selector(grados.map((g) => [g, grado(g).nombre]), grados[0]);
  const selM = h('select');
  const selS = h('select');
  const zona = h('div');
  const llenarM = () => {
    const ms = clases.filter((c) => partesClase(c).gradoId === selG.value).map((c) => partesClase(c).materiaId);
    vaciar(selM).append(h('option', { value: '' }, 'Todas mis materias'), ms.map((m) => h('option', { value: m }, materia(m).nombre)));
  };
  selG.onchange = () => { llenarM(); cargar(); }; selM.onchange = cargar; selS.onchange = cargar;
  llenarM();
  cont.append(h('div', { class: 'tarjeta no-imprimir' }, h('div', { class: 'form-rejilla' }, campo('Grado', selG), campo('Materia', selM), campo('Sección', selS))), zona);

  let alumnosCache = {};
  async function cargar() {
    cargando(zona);
    const gId = selG.value;
    const misClasesG = clases.filter((c) => partesClase(c).gradoId === gId && (!selM.value || partesClase(c).materiaId === selM.value));
    try {
      if (!alumnosCache[gId]) alumnosCache[gId] = await alumnosDeGrado(gId);
      const secciones = [...new Set(alumnosCache[gId].map((a) => a.seccion || ''))].sort();
      if (selS.dataset.g !== gId) { selS.dataset.g = gId; vaciar(selS).append(h('option', { value: '' }, 'Todas'), secciones.map((s) => h('option', { value: s }, s || '(sin sección)'))); }
      const alumnos = alumnosCache[gId].filter((a) => !selS.value || (a.seccion || '') === selS.value);
      let acts = []; let ents = []; let res = []; const claves = {};
      for (const c of misClasesG) {
        const [a, e, r] = await Promise.all([store.list('actividades', [['clase', '==', c]]), store.list('entregas', [['clase', '==', c]]), store.list('resultados', [['clase', '==', c]])]);
        acts.push(...a); ents.push(...e); res.push(...r);
      }
      // calificar lo pendiente
      const pendientes = ents.filter((e) => e.estado === 'pendiente' || !res.some((r) => r.id === e.id));
      if (pendientes.length) {
        for (const aid of new Set(pendientes.map((e) => e.actividadId))) claves[aid] = await store.get('claves', aid);
        res.push(...await calificarPendientes(pendientes, res, Object.fromEntries(acts.map((a) => [a.id, a])), claves));
      }
      acts = acts.filter((a) => a.publicada).sort((a, b) => (a.materiaId).localeCompare(b.materiaId) || (a.creado || 0) - (b.creado || 0));
      let temas = [];
      for (const c of misClasesG) temas.push(...await store.list('temas', [['clase', '==', c]]));
      pintarMatriz(zona, alumnos, acts, mejorPorAlumno(res), ordenar(temas), gId);
    } catch (e) { vaciar(zona).append(vacio(mensajeError(e))); }
  }
  cargar();
}

function pintarMatriz(zona, alumnos, acts, mejores, temas, gId) {
  vaciar(zona);
  if (!acts.length) { zona.append(vacio('No hay actividades publicadas para esta selección.')); return; }
  const promAlumno = (a) => { const ns = acts.map((x) => mejores[a.id + '|' + x.id]).filter((r) => r?.estado === 'calificada').map((r) => nota100(r.puntaje, r.puntajeMax)); return ns.length ? Math.round(ns.reduce((p, q) => p + q, 0) / ns.length) : null; };
  const celda = (a, x) => {
    const r = mejores[a.id + '|' + x.id];
    if (!r) return h('td', { class: 'num' }, x.fechaLimite && x.fechaLimite < Date.now() ? h('span', { class: 'etiqueta-estado e-rojo' }, 'No entregó') : '—');
    if (r.estado === 'revision') return h('td', { class: 'num' }, h('span', { class: 'etiqueta-estado e-naranja' }, '⏳'));
    const n = nota100(r.puntaje, r.puntajeMax); return h('td', { class: 'num' }, h('span', { class: 'etiqueta-estado ' + colorNota(n) }, n));
  };
  zona.append(h('section', { class: 'tarjeta' },
    h('div', { class: 'encabezado' }, h('h2', null, `${grado(gId).nombre}: notas por actividad (sobre 100)`),
      h('div', { class: 'fila-botones no-imprimir' },
        h('button', { class: 'btn claro chico', onclick: () => {
          const f = [['Alumno', 'Usuario', 'Sección', ...acts.map((x) => `${materia(x.materiaId).nombre}: ${x.titulo}`), 'Promedio']];
          for (const a of alumnos) f.push([a.nombre, a.usuario, a.seccion || '', ...acts.map((x) => { const r = mejores[a.id + '|' + x.id]; return r ? (r.estado === 'revision' ? 'Por revisar' : nota100(r.puntaje, r.puntajeMax)) : ''; }), promAlumno(a) ?? '']);
          descargarCSV(`Calificaciones - ${grado(gId).nombre}`, f);
        } }, '⬇️ Exportar (Excel / Google Sheets)'),
        h('button', { class: 'btn claro chico', onclick: () => print() }, '🖨️ Imprimir'))),
    alumnos.length ? h('div', { class: 'tabla-envoltura' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Alumno'), acts.map((x) => h('th', { class: 'num', title: x.titulo }, `${materia(x.materiaId).icono || ''} ${x.titulo.slice(0, 18)}${x.titulo.length > 18 ? '…' : ''}`)), h('th', { class: 'num' }, 'Promedio'))),
      h('tbody', null, alumnos.map((a) => { const p = promAlumno(a); return h('tr', null, h('td', null, h('button', { class: 'btn claro chico', onclick: () => fichaAlumno(a, acts, mejores) }, a.nombre)), acts.map((x) => celda(a, x)), h('td', { class: 'num' }, p === null ? '—' : h('b', null, p))); })))) : vacio('No hay alumnos en este grado.')));

  // Refuerzo por tema
  const porTema = {};
  for (const x of acts) {
    const t = temas.find((tt) => tt.id === x.temaId); const k = t ? t.id : 'sin-' + x.materiaId;
    const g = (porTema[k] ||= { nombre: t ? t.nombre : 'Sin tema', materiaId: x.materiaId, notas: [] });
    for (const a of alumnos) { const r = mejores[a.id + '|' + x.id]; if (r?.estado === 'calificada') g.notas.push(nota100(r.puntaje, r.puntajeMax)); }
  }
  const filasT = Object.values(porTema).filter((t) => t.notas.length).map((t) => ({ ...t, prom: Math.round(t.notas.reduce((a, b) => a + b, 0) / t.notas.length) })).sort((a, b) => a.prom - b.prom);
  if (filasT.length) {
    zona.append(h('section', { class: 'tarjeta' }, h('h2', null, '🎯 Temas que necesitan refuerzo'),
      h('p', { class: 'texto-suave chico' }, 'Promedio del grupo por tema. Menos de 60 = conviene repasar.'),
      filasT.map((t) => h('div', { class: 'barra-h' }, h('span', null, `${materia(t.materiaId).icono || ''} ${t.nombre}`),
        h('div', { class: 'pista' }, h('div', { style: { width: t.prom + '%', background: t.prom >= 80 ? 'var(--verde)' : t.prom >= 60 ? 'var(--naranja)' : 'var(--rojo)' } })),
        h('span', { class: 'etiqueta-estado ' + colorNota(t.prom) }, t.prom)))));
  }
}

function fichaAlumno(a, acts, mejores) {
  const hechas = acts.filter((x) => mejores[a.id + '|' + x.id]);
  const pendientes = acts.filter((x) => !mejores[a.id + '|' + x.id]);
  modal({ titulo: `Progreso de ${a.nombre}`, ancho: true, contenido: h('div', null,
    h('div', { class: 'cifras' },
      h('div', { class: 'cifra', style: { '--c': 'var(--verde)' } }, h('b', null, hechas.length), h('span', null, 'Completadas')),
      h('div', { class: 'cifra', style: { '--c': 'var(--naranja)' } }, h('b', null, pendientes.length), h('span', null, 'Pendientes'))),
    h('h3', null, 'Completadas'),
    hechas.length ? h('div', { class: 'tabla-envoltura' }, h('table', null, h('tbody', null, hechas.map((x) => { const r = mejores[a.id + '|' + x.id]; const n = nota100(r.puntaje, r.puntajeMax);
      return h('tr', null, h('td', null, materia(x.materiaId).nombre), h('td', null, x.titulo), h('td', { class: 'num' }, r.estado === 'revision' ? 'Por revisar' : h('span', { class: 'etiqueta-estado ' + colorNota(n) }, n))); })))) : h('p', null, 'Ninguna.'),
    h('h3', { style: { marginTop: '14px' } }, 'Pendientes'),
    pendientes.length ? h('ul', null, pendientes.map((x) => h('li', null, `${materia(x.materiaId).nombre}: ${x.titulo}`))) : h('p', null, '¡Ninguna! 🎉')) });
}
