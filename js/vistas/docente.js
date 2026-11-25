// Panel docente (y vistas de contenidos que también usa la administración).
import { h, vaciar, aviso, modal, confirmar, campo, selector, casilla, vacio, cargando, comprimirImagen, leerArchivoBase64, fecha, mensajeError } from '../ui.js';
import { store, registrar } from '../store/index.js';
import { claseDe, ID_SEP } from '../store/permisos.js';
import { S, navegar, grado, materia } from '../app.js';
import { panelConMenu, encabezado, miga, itemRecurso, estadoActividad, intentar, ordenar } from './comun.js';
import { tipoPorEnlace, TIPOS_RECURSO, llamarServidor, servidorConfigurado, esUrlSegura } from '../drive.js';

const MENU = [
  ['/', '🏠', 'Mis clases'],
  ['/calificaciones', '📊', 'Calificaciones'],
  ['/mis-juegos', '🧩', 'Juegos de aprendizaje'],
  ['/juegos', '🎮', 'Aprende Jugando'],
];

export async function render(raiz, partes, cancelada) {
  const [r, p1, p2] = partes;
  const activa = r ? '/' + r : '/';
  const cont = panelConMenu(raiz, 'Panel docente', MENU, ['/calificaciones', '/juegos', '/mis-juegos'].includes(activa) ? activa : r === 'juego' ? '/juegos' : '/');
  return rutasContenido(cont, partes, cancelada) || (async () => {
    if (r === 'mis-juegos') { const m = await import('./juegos-admin.js'); return m.renderJuegosAdmin(cont, partes); }
    if (r === 'calificaciones') { const m = await import('./resultados.js'); return m.renderCalificaciones(cont, misClases()); }
    if (r === 'juegos' || r === 'juego') { const m = await import('../juegos/motor.js'); return r === 'juego' ? m.renderJuego(cont, p1, Number(p2) || null) : m.renderCatalogo(cont); }
    return inicioDocente(cont);
  })();
}

/** Rutas compartidas con la administración. Devuelve una promesa si la ruta es de contenidos. */
export function rutasContenido(cont, [r, p1, p2]) {
  if (r === 'clase') return vistaClase(cont, decodeURIComponent(p1), p2 || 'contenidos');
  if (r === 'nueva') return import('./editor.js').then((m) => m.renderEditor(cont, null, decodeURIComponent(p1)));
  if (r === 'editar') return import('./editor.js').then((m) => m.renderEditor(cont, p1));
  if (r === 'resultados') return import('./resultados.js').then((m) => m.renderResultadosActividad(cont, p1));
  return null;
}

/** Clases (grado + materia) que puede trabajar el usuario actual. */
export function misClases() {
  if (S.yo.rol === 'admin') {
    const todas = [];
    for (const g of S.grados) for (const m of S.materias) if ((m.grados || []).includes(g.id)) todas.push(claseDe(g.id, m.id));
    return todas;
  }
  return (S.yo.clases || []).filter((c) => { const [g, m] = c.split(ID_SEP); return S.grados.some((x) => x.id === g) && S.materias.some((x) => x.id === m); });
}
export const partesClase = (c) => { const [g, m] = c.split(ID_SEP); return { gradoId: g, materiaId: m, clase: c }; };
export const nombreClase = (c) => { const { gradoId, materiaId } = partesClase(c); return `${materia(materiaId).nombre} · ${grado(gradoId).nombre}`; };

async function inicioDocente(cont) {
  const clases = misClases();
  cont.append(encabezado(`¡Hola, ${S.yo.nombre.split(' ')[0]}!`));
  if (!clases.length) { cont.append(vacio('Todavía no tiene grados y materias asignados. Pida a la administración que se los asigne.')); return; }
  cont.append(h('p', { class: 'texto-suave' }, 'Elija una clase para subir materiales, crear actividades o ver resultados.'),
    h('div', { class: 'rejilla' }, clases.map((c) => {
      const { gradoId, materiaId } = partesClase(c); const m = materia(materiaId); const g = grado(gradoId);
      return h('button', { class: 'mosaico', style: { '--c': m.color, minHeight: '150px' }, onclick: () => navegar('/clase/' + encodeURIComponent(c)) },
        h('span', { class: 'icono' }, m.icono || '📘'), m.nombre, h('span', { style: { fontSize: '.95rem', opacity: .9 } }, g.nombre));
    })));
  // Pendientes de revisión
  const pend = [];
  for (const c of clases) {
    try { pend.push(...(await store.list('resultados', [['clase', '==', c], ['estado', '==', 'revision']]))); } catch { /* sin permiso */ }
  }
  if (pend.length) {
    cont.append(h('div', { class: 'tarjeta', style: { marginTop: '20px' } }, h('h2', null, `📝 ${pend.length} respuesta(s) esperan su revisión`),
      h('div', { class: 'lista' }, [...new Set(pend.map((p) => p.actividadId))].map((aid) => {
        const p = pend.find((x) => x.actividadId === aid);
        return h('button', { class: 'item', onclick: () => navegar('/resultados/' + aid) }, h('span', { class: 'ic-redondo', style: { '--c': 'var(--naranja)' } }, '⏳'),
          h('span', { class: 'cuerpo' }, h('strong', null, p.titulo || 'Actividad'), h('small', null, nombreClase(p.clase), ' · ', pend.filter((x) => x.actividadId === aid).length, ' por revisar')));
      }))));
  }
}

// ------------------------------------------------------------------ CLASE
async function vistaClase(cont, clase, pestana) {
  const { gradoId, materiaId } = partesClase(clase);
  if (!misClases().includes(clase)) { cont.append(vacio('No tiene asignada esta clase.')); return; }
  const g = grado(gradoId); const m = materia(materiaId);
  const raizInicio = S.yo.rol === 'admin' ? '/contenidos' : '/';
  vaciar(cont).append(miga([[S.yo.rol === 'admin' ? 'Contenidos' : 'Mis clases', raizInicio], [`${m.nombre} · ${g.nombre}`]]),
    encabezado(`${m.icono || ''} ${m.nombre} — ${g.nombre}`,
      h('button', { class: 'btn verde', onclick: () => navegar('/nueva/' + encodeURIComponent(clase)) }, '➕ Nueva actividad'),
      h('button', { class: 'btn morado', onclick: () => editarRecurso(null, clase, () => vistaClase(cont, clase, pestana)) }, '📎 Subir material'),
      h('button', { class: 'btn claro', onclick: () => editarTema(null, clase, () => vistaClase(cont, clase, pestana)) }, '📁 Nuevo tema')));
  const zona = h('div'); cont.append(zona); cargando(zona);
  let temas, recursos, acts;
  try {
    [temas, recursos, acts] = await Promise.all([
      store.list('temas', [['clase', '==', clase]]), store.list('recursos', [['clase', '==', clase]]), store.list('actividades', [['clase', '==', clase]]),
    ]);
  } catch (e) { vaciar(zona).append(vacio(mensajeError(e))); return; }
  vaciar(zona);
  ordenar(temas); ordenar(recursos);
  acts.sort((a, b) => (b.creado || 0) - (a.creado || 0));
  const recargar = () => vistaClase(cont, clase, pestana);
  const grupos = [...temas.map((t) => ({ tema: t, id: t.id })), { tema: null, id: '' }];
  for (const gr of grupos) {
    const rs = recursos.filter((r) => (gr.tema ? r.temaId === gr.id : !temas.some((t) => t.id === r.temaId)));
    const as = acts.filter((a) => (gr.tema ? a.temaId === gr.id : !temas.some((t) => t.id === a.temaId)));
    if (!gr.tema && !rs.length && !as.length) continue;
    zona.append(h('section', { class: 'tarjeta' + (gr.tema?.visible === false ? ' inactivo' : '') },
      h('div', { class: 'encabezado' }, h('h2', null, gr.tema ? `📁 ${gr.tema.nombre}` : '📂 Sin tema'),
        gr.tema ? h('div', { class: 'fila-botones' },
          gr.tema.visible === false ? h('span', { class: 'etiqueta-estado e-gris' }, 'Oculto') : null,
          h('button', { class: 'btn claro chico', onclick: () => editarTema(gr.tema, clase, recargar) }, '✏️ Editar'),
          h('button', { class: 'btn peligro chico', onclick: () => borrarTema(gr.tema, rs.length + as.length, recargar) }, '🗑️')) : null),
      as.length ? h('div', { class: 'lista', style: { marginBottom: '12px' } }, as.map((a) => filaActividadDocente(a, recargar))) : null,
      rs.length ? h('div', { class: 'lista' }, rs.map((r) => itemRecurso(r, { acciones: [
        h('button', { class: 'btn claro chico', onclick: () => editarRecurso(r, clase, recargar) }, '✏️'),
        h('button', { class: 'btn claro chico', title: r.visible === false ? 'Mostrar' : 'Ocultar', onclick: () => intentar(() => store.update('recursos', r.id, { visible: r.visible === false }), r.visible === false ? 'Visible para alumnos' : 'Oculto para alumnos').then(recargar) }, r.visible === false ? '👁️' : '🙈'),
        h('button', { class: 'btn peligro chico', onclick: async () => { if (await confirmar(`¿Eliminar "${r.titulo}"? (El archivo en Drive no se borra.)`)) { await intentar(() => store.del('recursos', r.id), 'Material eliminado'); registrar('Eliminó material', r.titulo, S.yo); recargar(); } } }, '🗑️'),
      ] }))) : null,
      !rs.length && !as.length ? h('p', { class: 'texto-suave' }, 'Tema vacío. Use "Subir material" o "Nueva actividad".') : null));
  }
  if (!zona.children.length) zona.append(vacio('Esta clase está vacía. Empiece creando un tema, subiendo un material o creando una actividad.'));
}

function filaActividadDocente(a, recargar) {
  const [t, c] = estadoActividad(a);
  return h('div', { class: 'item', style: { cursor: 'default', flexWrap: 'wrap' } },
    h('span', { class: 'ic-redondo', style: { '--c': 'var(--verde)' } }, '📝'),
    h('div', { class: 'cuerpo', style: { minWidth: '200px' } }, h('strong', null, a.titulo),
      h('small', null, `${a.preguntas?.length || 0} preguntas · ${a.intentos || 1} intento(s)`, a.fechaLimite ? ` · Límite ${fecha(a.fechaLimite)}` : '')),
    h('span', { class: 'etiqueta-estado ' + c }, t),
    h('div', { class: 'fila-botones' },
      h('button', { class: 'btn chico', onclick: () => navegar('/resultados/' + a.id) }, '📊 Resultados'),
      h('button', { class: 'btn claro chico', onclick: () => navegar('/editar/' + a.id) }, '✏️ Editar'),
      h('button', { class: 'btn claro chico', onclick: () => duplicarActividad(a, recargar) }, '📄 Duplicar'),
      h('button', { class: 'btn claro chico', onclick: () => intentar(async () => { await store.update('actividades', a.id, { publicada: !a.publicada }); registrar(a.publicada ? 'Ocultó actividad' : 'Publicó actividad', a.titulo, S.yo); }, a.publicada ? 'Actividad oculta' : 'Actividad publicada').then(recargar) }, a.publicada ? '🙈 Ocultar' : '📢 Publicar'),
      h('button', { class: 'btn peligro chico', onclick: () => borrarActividad(a, recargar) }, '🗑️')));
}

async function duplicarActividad(a, recargar) {
  const destino = selector(misClases().map((c) => [c, nombreClase(c)]), a.clase);
  const r = await modal({ titulo: 'Duplicar actividad', contenido: h('div', null, h('p', null, `Se creará una copia oculta de "${a.titulo}".`), campo('¿En qué clase?', destino)),
    botones: [{ texto: 'Cancelar', clase: 'claro', valor: null }, { texto: 'Duplicar', clase: 'verde', accion: () => destino.value }] });
  if (!r) return;
  await intentar(async () => {
    const { gradoId, materiaId, clase } = partesClase(r);
    const clave = await store.get('claves', a.id);
    const nuevo = store.nuevoId();
    const { id: _x, ...datos } = a;
    await store.lote([
      { op: 'set', col: 'actividades', id: nuevo, data: { ...datos, gradoId, materiaId, clase, temaId: clase === a.clase ? a.temaId : '', titulo: a.titulo + ' (copia)', publicada: false, autorId: S.uid, creado: store.AHORA } },
      { op: 'set', col: 'claves', id: nuevo, data: { gradoId, materiaId, clase, respuestas: clave?.respuestas || {} } },
    ]);
    registrar('Duplicó actividad', a.titulo, S.yo);
  }, 'Copia creada (oculta). Revísela y publíquela.');
  recargar();
}

async function borrarActividad(a, recargar) {
  let ents = [];
  try { ents = await store.list('entregas', [['clase', '==', a.clase], ['actividadId', '==', a.id]]); } catch { /* */ }
  const ok = await confirmar(h('div', null, h('p', null, `Se eliminará "${a.titulo}".`),
    ents.length ? h('p', { class: 'mensaje-error' }, `¡Atención! ${ents.length} entrega(s) de alumnos y sus notas también se borrarán. Si solo quiere que no se vea, use "Ocultar".`) : null), { si: 'Eliminar' });
  if (!ok) return;
  await intentar(async () => {
    const ops = [{ op: 'del', col: 'actividades', id: a.id }, { op: 'del', col: 'claves', id: a.id }];
    for (const e of ents) ops.push({ op: 'del', col: 'resultados', id: e.id }, { op: 'del', col: 'entregas', id: e.id });
    await store.lote(ops);
    registrar('Eliminó actividad', `${a.titulo} (${ents.length} entregas)`, S.yo);
  }, 'Actividad eliminada');
  recargar();
}

// ------------------------------------------------------------------ TEMAS
function editarTema(t, clase, listo) {
  const { gradoId, materiaId } = partesClase(clase);
  const nombre = h('input', { type: 'text', value: t?.nombre || '', placeholder: 'Ejemplo: Unidad 1 — Los números' });
  const orden = h('input', { type: 'number', value: t?.orden ?? 1, min: 0 });
  const vis = casilla('Visible para los alumnos', t ? t.visible !== false : true);
  modal({ titulo: t ? 'Editar tema' : 'Nuevo tema', contenido: h('div', null, campo('Nombre del tema o unidad', nombre), campo('Orden (1 = primero)', orden), vis),
    botones: [{ texto: 'Cancelar', clase: 'claro' }, { texto: 'Guardar', clase: 'verde', accion: async () => {
      if (!nombre.value.trim()) { aviso('Escriba el nombre del tema.', 'error'); return false; }
      const data = { gradoId, materiaId, clase, nombre: nombre.value.trim(), orden: Number(orden.value) || 0, visible: vis.querySelector('input').checked };
      if (t) await store.update('temas', t.id, data); else await store.add('temas', { ...data, autorId: S.uid });
      aviso('Tema guardado', 'ok'); listo();
    } }] });
}
async function borrarTema(t, n, listo) {
  if (n) { await modal({ titulo: 'Tema con contenido', contenido: 'Primero mueva o elimine los materiales y actividades de este tema (o simplemente ocúltelo).' }); return; }
  if (await confirmar(`¿Eliminar el tema "${t.nombre}"?`)) { await intentar(() => store.del('temas', t.id), 'Tema eliminado'); listo(); }
}

// ------------------------------------------------------------------ MATERIALES
const MAX_DRIVE = 20 * 1024 * 1024;
export async function editarRecurso(r, clase, listo) {
  const { gradoId, materiaId } = partesClase(clase);
  let temas = [];
  try { temas = ordenar(await store.list('temas', [['clase', '==', clase]])); } catch { /* */ }
  const titulo = h('input', { type: 'text', value: r?.titulo || '', placeholder: 'Ejemplo: Lectura "El quetzal"' });
  const desc = h('input', { type: 'text', value: r?.descripcion || '', placeholder: 'Indicación breve para los alumnos (opcional)' });
  const tema = selector([['', 'Sin tema'], ...temas.map((t) => [t.id, t.nombre])], r?.temaId || '');
  const tipo = selector(Object.entries(TIPOS_RECURSO).map(([k, v]) => [k, `${v.icono} ${v.nombre}`]), r?.tipo || 'pdf');
  const enlace = h('input', { type: 'url', value: (r?.url || '').startsWith('data:') ? '' : r?.url || '', placeholder: 'https://drive.google.com/… o https://youtube.com/…',
    oninput: () => { if (enlace.value) tipo.value = tipoPorEnlace(enlace.value); } });
  const archivo = h('input', { type: 'file', accept: '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*,video/mp4' });
  const vis = casilla('Visible para los alumnos', r ? r.visible !== false : true);
  const desc2 = casilla('Permitir descargar', r ? !!r.descargable : false);
  const puedeSubirDrive = servidorConfigurado();
  const estado = h('div', { class: 'mensaje-info chico' }, puedeSubirDrive
    ? 'Puede elegir un archivo (se guarda solo en Google Drive, en la carpeta del grado y materia) o pegar un enlace.'
    : 'Pegue el enlace de Google Drive (compartido como "Cualquier persona con el enlace"), YouTube u otro sitio educativo. Las imágenes pequeñas también se pueden elegir directamente.');
  modal({
    titulo: r ? 'Editar o sustituir material' : 'Subir material',
    contenido: h('div', null, estado,
      campo('Título', titulo), campo('Descripción', desc),
      h('div', { class: 'form-rejilla' }, campo('Tema o unidad', tema), campo('Tipo', tipo)),
      campo(r ? 'Sustituir por un archivo nuevo' : 'Archivo', archivo, puedeSubirDrive ? 'PDF, imágenes, Word, PowerPoint, Excel o video (máx. 20 MB).' : 'Sin Google Apps Script solo se admiten imágenes (se reducen automáticamente).'),
      campo('…o enlace', enlace), vis, desc2),
    botones: [{ texto: 'Cancelar', clase: 'claro' }, { texto: 'Guardar', clase: 'verde', accion: async (caja) => {
      if (!titulo.value.trim()) { aviso('Escriba un título.', 'error'); return false; }
      let url = enlace.value.trim(); let tipoFinal = tipo.value;
      const f = archivo.files[0];
      if (f) {
        const btn = caja.querySelector('.btn.verde'); btn.textContent = 'Subiendo…';
        if (puedeSubirDrive) {
          if (f.size > MAX_DRIVE) { aviso('El archivo pesa más de 20 MB. Súbalo a Drive manualmente y pegue el enlace.', 'error'); btn.textContent = 'Guardar'; return false; }
          const res = await llamarServidor('subirArchivo', { nombre: f.name, mime: f.type || 'application/octet-stream', base64: await leerArchivoBase64(f), grado: grado(gradoId).nombre, materia: materia(materiaId).nombre, tema: temas.find((t) => t.id === tema.value)?.nombre || 'General' });
          url = res.url; tipoFinal = tipoPorEnlace(f.name, f.type);
        } else if (/^image\//.test(f.type)) {
          url = await comprimirImagen(f, 1200, 0.78); tipoFinal = 'imagen';
          if (url.length > 900000) { aviso('La imagen sigue siendo muy grande. Use Google Drive.', 'error'); btn.textContent = 'Guardar'; return false; }
        } else { aviso('Para este tipo de archivo pegue un enlace de Google Drive.', 'error'); btn.textContent = 'Guardar'; return false; }
      } else if (!url && r?.url?.startsWith('data:')) url = r.url;
      if (!url) { aviso('Elija un archivo o pegue un enlace.', 'error'); return false; }
      if (!esUrlSegura(url) && !url.startsWith('img/')) { aviso('El enlace debe empezar con https://', 'error'); return false; }
      const data = { gradoId, materiaId, clase, temaId: tema.value, titulo: titulo.value.trim(), descripcion: desc.value.trim(), tipo: tipoFinal, url,
        visible: vis.querySelector('input').checked, descargable: desc2.querySelector('input').checked, actualizado: store.AHORA };
      if (r) await store.update('recursos', r.id, data);
      else await store.add('recursos', { ...data, orden: Date.now() / 1e10, autorId: S.uid, creado: store.AHORA });
      registrar(r ? 'Editó material' : 'Subió material', data.titulo, S.yo);
      aviso('Material guardado', 'ok'); listo();
    } }],
  });
}
