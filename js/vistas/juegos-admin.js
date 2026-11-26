// "Juegos de aprendizaje": la administración y los docentes crean y actualizan
// juegos de Aprende Jugando sin programar.
import { h, vaciar, aviso, modal, confirmar, campo, selector, casilla, cargando, vacio, fecha, normalizar, mensajeError, id as nuevoId } from '../ui.js';
import { store, registrar } from '../store/index.js';
import { ID_SEP } from '../store/permisos.js';
import { S, navegar, materia, recargarCatalogos } from '../app.js';
import { encabezado, miga, intentar } from './comun.js';
import { MODOS, IDIOMAS_VOZ, validarJuego } from '../juegos/personalizados.js';
import { PAQUETES, documentosPaquete, estadoPaquete } from '../juegos/paquetes.js';
import { JUEGOS as JUEGOS_MATE, MATERIA_MATEMATICAS } from '../juegos/catalogo.js';

const BASE = '/mis-juegos';
const ICONOS = ['🧩', '🔤', '🗣️', '🎨', '🔢', '🐾', '🍎', '🎒', '🧍', '📅', '👋', '🌎', '🔬', '🎵', '⚽', '💻', '🇬🇹', '📖', '⭐', '🏆'];
const GRADOS = [1, 2, 3, 4, 5, 6].map((n) => [n, `${n}°`]);

/** Materias en las que el usuario puede crear juegos. */
export function materiasEditables() {
  if (S.yo.rol === 'admin') return S.materias;
  const ids = new Set((S.yo.clases || []).map((c) => c.split(ID_SEP)[1]));
  return S.materias.filter((m) => ids.has(m.id));
}
const puedeEditar = (j) => S.yo.rol === 'admin' || materiasEditables().some((m) => m.id === j.materiaId);
function errorPermiso(e) {
  if (e?.code === 'permission-denied' && S.yo.rol === 'docente') return 'No tiene permiso en esa materia. Si acaba de recibir la materia, pida a la administración que abra su panel una vez y vuelva a entrar.';
  return mensajeError(e);
}

export async function renderJuegosAdmin(cont, [, accion, id]) {
  if (accion === 'nuevo') return editor(cont, null, ['preguntas', 'ordenar'].includes(id) ? id : 'vocabulario');
  if (accion === 'editar') return editor(cont, id);
  return lista(cont);
}

const TIPO_T = { vocabulario: ['Vocabulario', 'palabras'], preguntas: ['Preguntas', 'preguntas'], ordenar: ['Ordenar', 'elementos'] };
let filtroMateria = ''; let filtroDe = null; // el filtro se recuerda solo para la misma persona

async function lista(cont) {
  if (filtroDe !== S.uid) { filtroMateria = ''; filtroDe = S.uid; }
  const editables = materiasEditables();
  cont.append(encabezado('🧩 Juegos de aprendizaje',
    editables.length ? h('button', { class: 'btn verde', onclick: () => navegar(BASE + '/nuevo/vocabulario') }, '➕ Vocabulario') : null,
    editables.length ? h('button', { class: 'btn', onclick: () => navegar(BASE + '/nuevo/preguntas') }, '➕ Preguntas') : null,
    editables.length ? h('button', { class: 'btn naranja', onclick: () => navegar(BASE + '/nuevo/ordenar') }, '➕ Ordenar') : null),
  h('details', { class: 'mensaje-info' }, h('summary', { style: { cursor: 'pointer', fontWeight: 900 } }, '¿Cómo funciona? (toque para ver)'),
    h('p', { style: { marginTop: '8px' } }, h('b', null, 'Vocabulario: '), 'una lista de parejas (palabra y traducción, órgano y función, departamento y cabecera…) con un dibujo opcional; la plataforma arma varios juegos con ella.'),
    h('p', null, h('b', null, 'Preguntas: '), 'cada pregunta con su respuesta correcta y opciones incorrectas; puede llevar un texto para leer.'),
    h('p', null, h('b', null, 'Ordenar: '), 'palabras cuyas letras hay que ordenar, u oraciones cuyas palabras hay que ordenar.'),
    h('p', { style: { margin: 0 } }, h('b', null, 'Matemáticas '), 'tiene además 9 juegos automáticos que inventan preguntas nuevas cada vez.')));
  const zona = h('div'); cont.append(zona); cargando(zona);
  let juegos;
  try { juegos = await store.list('juegos'); } catch (e) { vaciar(zona).append(vacio(errorPermiso(e))); return; }
  vaciar(zona);
  const recargar = () => { vaciar(cont); lista(cont); };

  // ---- Paquetes por materia ----
  zona.append(h('section', { class: 'tarjeta' }, h('h2', null, '📦 Paquetes de juegos'),
    h('p', { class: 'texto-suave chico' }, 'Juegos listos para usar. Si alguno se borra, el botón del paquete lo recupera con su contenido original. Los que ya están instalados no se duplican.'),
    h('div', { class: 'rejilla' }, PAQUETES.map((p) => {
      const est = estadoPaquete(p, juegos);
      const m = S.materias.find((x) => x.id === p.materiaId);
      const completo = est.faltan.length === 0;
      const permitido = S.yo.rol === 'admin' || (m && editables.some((x) => x.id === m.id));
      return h('div', { class: 'tarjeta plana', style: { marginBottom: 0 } },
        h('h3', null, `${p.icono} ${p.nombre}`),
        h('p', { class: 'chico' }, `${est.instalados} de ${est.total} juegos instalados`),
        h('div', { class: 'progreso', style: { marginBottom: '10px' } }, h('div', { style: { width: (est.instalados / est.total) * 100 + '%' } })),
        h('button', { class: 'btn chico ' + (completo ? 'claro' : 'verde'), disabled: completo || !permitido,
          title: completo ? 'Todos los juegos del paquete están instalados' : !permitido ? 'Solo la administración o docentes de esta materia' : '',
          onclick: () => instalarPaquete(p, recargar) },
          completo ? '✔ Todo instalado' : est.instalados ? `♻️ Recuperar ${est.faltan.length} juego(s)` : '📦 Instalar'));
    }))));

  // ---- Filtro por materia ----
  const grupos = {};
  for (const j of juegos) (grupos[j.materiaId] ||= []).push(j);
  const materiasConJuegos = [MATERIA_MATEMATICAS, ...S.materias.map((m) => m.id).filter((id) => id !== MATERIA_MATEMATICAS && grupos[id]), ...Object.keys(grupos).filter((id) => !S.materias.some((m) => m.id === id))];
  if (filtroMateria && !materiasConJuegos.includes(filtroMateria)) filtroMateria = '';
  zona.append(h('div', { class: 'fila-botones', style: { margin: '6px 0 14px' } },
    h('button', { class: 'btn chico ' + (filtroMateria ? 'claro' : ''), onclick: () => { filtroMateria = ''; recargar(); } }, 'Todas'),
    materiasConJuegos.map((id) => { const m = materia(id); return h('button', { class: 'btn chico ' + (filtroMateria === id ? '' : 'claro'), onclick: () => { filtroMateria = id; recargar(); } }, `${m.icono || '🧩'} ${m.nombre}`); })));

  for (const mid of materiasConJuegos) {
    if (filtroMateria && filtroMateria !== mid) continue;
    const m = materia(mid);
    const js = (grupos[mid] || []).sort((a, b) => String(a.titulo).localeCompare(b.titulo));
    const seccion = h('section', { class: 'tarjeta' }, h('h2', null, `${m.icono || ''} ${m.nombre}`));
    if (mid === MATERIA_MATEMATICAS) {
      seccion.append(h('p', { class: 'texto-suave chico' }, '⚙️ Juegos automáticos: inventan operaciones y problemas nuevos cada vez, para los 6 grados, por eso no se editan. Puede agregar juegos propios de Matemáticas con los botones de arriba.'),
        h('div', { class: 'lista', style: { marginBottom: js.length ? '12px' : 0 } }, JUEGOS_MATE.map((j) => h('div', { class: 'item', style: { cursor: 'default' } },
          h('span', { class: 'ic-redondo', style: { '--c': m.color || 'var(--azul)' } }, j.icono),
          h('div', { class: 'cuerpo' }, h('strong', null, j.titulo), h('small', null, 'Automático · grados 1° a 6° · combinaciones infinitas')),
          h('div', { class: 'fila-botones' }, h('button', { class: 'btn chico', onclick: () => navegar(`/juego/${j.id}/3`) }, '▶️ Probar'))))));
    }
    if (js.length) seccion.append(h('div', { class: 'lista' }, js.map((j) => filaJuego(j, m, recargar))));
    zona.append(seccion);
  }
  if (!juegos.length) zona.append(vacio('Todavía no hay juegos de la escuela. Instale un paquete o cree uno nuevo.'));
}

function filaJuego(j, m, recargar) {
  const niveles = (j.elementos || []).flatMap((x) => [Number(x.n?.[0]) || 1, Number(x.n?.[1]) || 6]);
  const rango = niveles.length ? `${Math.min(...niveles)}° a ${Math.max(...niveles)}°` : '—';
  const nivelPrueba = niveles.length ? Math.min(...niveles) : 1;
  const [tipoT, unidad] = TIPO_T[j.tipo] || TIPO_T.preguntas;
  return h('div', { class: 'item' + (j.visible === false ? ' inactivo' : ''), style: { cursor: 'default', flexWrap: 'wrap' } },
    h('span', { class: 'ic-redondo', style: { '--c': m.color } }, j.icono || '🧩'),
    h('div', { class: 'cuerpo', style: { minWidth: '200px' } }, h('strong', null, j.titulo),
      h('small', null, `${tipoT} · ${(j.elementos || []).length} ${unidad} · grados ${rango}`, j.paquete ? ' · 📦 paquete' : '',
        j.actualizado ? ` · actualizado ${fecha(j.actualizado)}` : '', j.visible === false ? ' · (oculto)' : '')),
    h('div', { class: 'fila-botones' },
      h('button', { class: 'btn chico', onclick: () => navegar(`/juego/c-${j.id}/${nivelPrueba}`) }, '▶️ Probar'),
      puedeEditar(j) ? [
        h('button', { class: 'btn claro chico', onclick: () => navegar(`${BASE}/editar/${j.id}`) }, '✏️ Editar'),
        h('button', { class: 'btn claro chico', onclick: () => intentar(() => store.update('juegos', j.id, { visible: j.visible === false, actualizado: store.AHORA }), j.visible === false ? 'Visible para alumnos' : 'Oculto para alumnos').then(recargar) }, j.visible === false ? '👁️ Mostrar' : '🙈 Ocultar'),
        h('button', { class: 'btn peligro chico', onclick: async () => { if (await confirmar(`¿Eliminar el juego "${j.titulo}"?${j.paquete ? ' Podrá recuperarlo con el botón de su paquete.' : ''}`)) { try { await store.del('juegos', j.id); registrar('Eliminó juego', j.titulo, S.yo); aviso('Juego eliminado', 'ok'); } catch (e) { aviso(errorPermiso(e), 'error'); } recargar(); } } }, '🗑️'),
      ] : null));
}

// ------------------------------------------------------------------ Paquetes
/** Instala (o recupera) los juegos que falten de un paquete. */
async function instalarPaquete(p, listo) {
  let m = S.materias.find((x) => x.id === p.materiaId);
  if (!m && !p.crearMateria) {
    if (S.yo.rol !== 'admin') { await modal({ titulo: 'Falta la materia', contenido: `Pida a la administración que instale el paquete ${p.nombre}.` }); return; }
    const sel = selector(S.materias.map((x) => [x.id, x.nombre]), S.materias[0]?.id);
    const elegida = await modal({ titulo: `¿En qué materia van los juegos de ${p.nombre}?`, contenido: h('div', null, h('p', null, `No se encontró la materia original de este paquete. Elija dónde ponerlos:`), campo('Materia', sel)),
      botones: [{ texto: 'Cancelar', clase: 'claro', valor: null }, { texto: 'Continuar', clase: 'verde', accion: () => sel.value }] });
    if (!elegida) return; m = materia(elegida);
  }
  let juegos;
  try { juegos = await store.list('juegos'); } catch (e) { aviso(errorPermiso(e), 'error'); return; }
  const est = estadoPaquete(p, juegos);
  if (!est.faltan.length) { aviso('Todos los juegos de este paquete ya están instalados.'); return; }
  const ok = await confirmar(h('div', null,
    h('p', null, est.instalados ? `Se recuperarán ${est.faltan.length} juego(s): ` : `Se instalarán ${est.faltan.length} juegos: `, est.faltan.map((j) => j.titulo).join(', '), '.'),
    !m ? h('p', { class: 'mensaje-info' }, `También se creará la materia "${p.crearMateria.nombre}" para todos los grados.`) : null,
    h('p', { class: 'chico texto-suave' }, 'Los juegos que ya existen no se tocan.')), { si: est.instalados ? 'Recuperar' : 'Instalar', clase: 'verde', titulo: `Paquete ${p.nombre}` });
  if (!ok) return;
  try {
    const n = await instalarFaltantes(p, juegos, m);
    aviso(`${n} juego(s) de ${p.nombre} listos ✔`, 'ok');
    listo();
  } catch (e) { aviso(errorPermiso(e), 'error'); }
}

async function instalarFaltantes(p, juegos, m) {
  if (!m) {
    await store.set('materias', p.materiaId, { ...p.crearMateria, grados: S.grados.map((g) => g.id), visible: true, orden: S.materias.length + 1 });
    await recargarCatalogos(); m = materia(p.materiaId);
    registrar('Creó materia', p.crearMateria.nombre, S.yo);
  }
  const faltan = new Set(estadoPaquete(p, juegos).faltan.map((j) => j.clave));
  const nuevos = documentosPaquete(p, m.id, S.uid).filter((d) => faltan.has(d.clave));
  await store.lote(nuevos.map((d) => ({ op: 'set', col: 'juegos', id: nuevoId(), data: { ...d, creado: store.AHORA, actualizado: store.AHORA } })));
  registrar('Instaló paquete de juegos', `${p.nombre}: ${nuevos.length}`, S.yo);
  return nuevos.length;
}

/**
 * Al actualizar a la versión 1.3, los juegos de Lenguaje, Ciencias y Mi Guatemala pasan a ser paquetes.
 * La primera vez que la administración abre su panel se instalan solos (una sola vez por paquete),
 * para que los alumnos no pierdan esos juegos.
 */
export async function instalarPaquetesIniciales() {
  if (S.yo.rol !== 'admin') return;
  try {
    const reg = (await store.get('config', 'paquetes')) || { instalados: {} };
    const pendientes = PAQUETES.filter((p) => p.id !== 'ingles' && !reg.instalados?.[p.id]);
    if (!pendientes.length) return;
    const juegos = await store.list('juegos');
    for (const p of pendientes) {
      const m = S.materias.find((x) => x.id === p.materiaId);
      if (m) await instalarFaltantes(p, juegos, m);
      reg.instalados = { ...(reg.instalados || {}), [p.id]: !!m };
    }
    await store.set('config', 'paquetes', reg);
  } catch (e) { console.warn('No se pudieron instalar los paquetes iniciales', e); }
}

// ------------------------------------------------------------------ Editor
async function editor(cont, idJuego, tipoNuevo) {
  cargando(cont);
  let j = null;
  if (idJuego) { try { j = await store.get('juegos', idJuego); } catch (e) { vaciar(cont).append(vacio(errorPermiso(e))); return; } }
  vaciar(cont);
  if (idJuego && !j) { cont.append(vacio('Este juego ya no existe.')); return; }
  if (j && !puedeEditar(j)) { cont.append(vacio('Solo puede editar juegos de las materias que imparte.')); return; }
  const editables = materiasEditables();
  if (!editables.length) { cont.append(vacio('No tiene materias asignadas.')); return; }
  const tipo = j?.tipo || tipoNuevo;
  const vocab = tipo === 'vocabulario';
  const ord = tipo === 'ordenar';
  const NOMBRE_T = { vocabulario: 'juego de vocabulario', preguntas: 'juego de preguntas', ordenar: 'juego de ordenar' }[tipo];
  const d = JSON.parse(JSON.stringify(j || {
    titulo: '', materiaId: editables[0].id, icono: vocab ? '🔤' : '🧩', visible: true, tipo,
    etiquetas: { a: 'inglés', b: 'español' }, voz: vocab ? 'en-US' : '', modos: vocab ? ['a2b', 'b2a', 'emoji', 'letras'] : [],
    modoOrden: 'palabras', consigna: '', frases: {},
    elementos: ord ? [{ a: '', e: '', n: [1, 6] }, { a: '', e: '', n: [1, 6] }, { a: '', e: '', n: [1, 6] }] : vocab ? [{ a: '', b: '', e: '', n: [1, 6] }, { a: '', b: '', e: '', n: [1, 6] }, { a: '', b: '', e: '', n: [1, 6] }, { a: '', b: '', e: '', n: [1, 6] }]
      : [{ p: '', r: '', o: ['', '', ''], e: '', n: [1, 6] }],
  }));
  let sucio = false; const marcar = () => { sucio = true; };

  cont.append(miga([['Juegos de aprendizaje', BASE], [j ? j.titulo : 'Nuevo ' + NOMBRE_T]]),
    h('h1', null, j ? `✏️ ${j.titulo}` : '➕ Nuevo ' + NOMBRE_T));

  // ---- Datos generales ----
  const iconoInp = h('input', { type: 'text', value: d.icono, maxLength: 4, style: { width: '90px', fontSize: '1.5rem', textAlign: 'center' }, oninput: (e) => { d.icono = e.target.value; marcar(); } });
  cont.append(h('section', { class: 'tarjeta' }, h('h2', null, '1. Datos del juego'),
    h('div', { class: 'form-rejilla' },
      campo('Nombre del juego', h('input', { type: 'text', value: d.titulo, placeholder: vocab ? 'Ejemplo: Animals / Animales' : ord ? 'Ejemplo: Ordena las oraciones' : 'Ejemplo: Valores y convivencia', oninput: (e) => { d.titulo = e.target.value; marcar(); } })),
      campo('Materia', selector(editables.map((m) => [m.id, `${m.icono || ''} ${m.nombre}`]), d.materiaId, { onchange: (e) => { d.materiaId = e.target.value; marcar(); } }))),
    h('div', { class: 'etiqueta' }, 'Ícono'),
    h('div', { class: 'fila-botones', style: { marginBottom: '12px' } }, iconoInp, ICONOS.map((ic) => h('button', { type: 'button', class: 'btn claro chico', onclick: () => { d.icono = ic; iconoInp.value = ic; marcar(); } }, ic))),
    casilla('Visible para los alumnos', d.visible !== false, { onchange: (e) => { d.visible = e.target.checked; marcar(); } }),
    ord ? h('div', { class: 'form-rejilla', style: { marginTop: '10px' } },
      campo('¿Qué se ordena?', selector([['palabras', 'Las palabras de una oración'], ['letras', 'Las letras de una palabra']], d.modoOrden, { onchange: (e) => { d.modoOrden = e.target.value; marcar(); pintar(); } })),
      campo('Instrucción para el alumno (opcional)', h('input', { type: 'text', value: d.consigna || '', placeholder: 'Ordena las palabras para formar la oración', oninput: (e) => { d.consigna = e.target.value; marcar(); } }))) : null,
    vocab ? [
      h('details', { style: { margin: '10px 0' }, open: !!(d.frases?.a2b || d.frases?.b2a) }, h('summary', { style: { cursor: 'pointer', fontWeight: 800, color: 'var(--azul)' } }, 'Preguntas personalizadas (opcional, útil fuera de idiomas)'),
        h('p', { class: 'chico texto-suave' }, 'Use {a} para la columna 1 y {b} para la columna 2. Ejemplo: "¿Cuál es la cabecera de {a}?"'),
        h('div', { class: 'form-rejilla' },
          campo('Pregunta de columna 1 → 2', h('input', { type: 'text', value: d.frases?.a2b || '', placeholder: '¿Qué significa "{a}"?', oninput: (e) => { d.frases = { ...(d.frases || {}), a2b: e.target.value }; marcar(); } })),
          campo('Pregunta de columna 2 → 1', h('input', { type: 'text', value: d.frases?.b2a || '', placeholder: '¿Cómo se dice "{b}"?', oninput: (e) => { d.frases = { ...(d.frases || {}), b2a: e.target.value }; marcar(); } })))),
      h('div', { class: 'form-rejilla', style: { marginTop: '10px' } },
        campo('Nombre de la columna 1 (palabra)', h('input', { type: 'text', value: d.etiquetas.a, oninput: (e) => { d.etiquetas.a = e.target.value; marcar(); } }), 'Ejemplo: inglés'),
        campo('Nombre de la columna 2 (traducción)', h('input', { type: 'text', value: d.etiquetas.b, oninput: (e) => { d.etiquetas.b = e.target.value; marcar(); } }), 'Ejemplo: español'),
        campo('Pronunciación de la columna 1', selector(IDIOMAS_VOZ, d.voz || '', { onchange: (e) => { d.voz = e.target.value; marcar(); } }), 'La tablet lee la palabra en voz alta (botón 🔊).')),
      h('div', { class: 'etiqueta' }, 'Formas de jugar (el sistema las mezcla)'),
      Object.entries(MODOS).map(([k, m]) => casilla(`${m.nombre} — ${m.ejemplo}`, d.modos.includes(k), { onchange: (e) => { d.modos = e.target.checked ? [...new Set([...d.modos, k])] : d.modos.filter((x) => x !== k); marcar(); } })),
    ] : null));

  // ---- Contenido ----
  const zona = h('div'); const contador = h('span', { class: 'texto-suave' });
  const completo = (x) => (vocab ? x.a?.trim() && x.b?.trim() : ord ? x.a?.trim() : x.p?.trim() && x.r?.trim());
  const actualizarContador = () => { const n = d.elementos.filter(completo).length; contador.textContent = `${n} ${vocab ? 'palabras completas' : ord ? 'elementos' : 'preguntas completas'}`; };
  const selGrado = (x, i) => selector(GRADOS, x.n?.[i] ?? (i ? 6 : 1), { style: { width: '78px', minHeight: '44px', padding: '4px 8px' }, 'aria-label': i ? 'Hasta grado' : 'Desde grado', onchange: (e) => { x.n = x.n || [1, 6]; x.n[i] = Number(e.target.value); marcar(); } });
  const inp = (x, k, ph, extra = {}) => h('input', { type: 'text', value: x[k] || '', placeholder: ph, style: { minHeight: '44px' }, oninput: (e) => { x[k] = e.target.value; marcar(); actualizarContador(); }, ...extra });
  const pintar = () => {
    vaciar(zona);
    if (ord) {
      zona.append(h('div', { class: 'tabla-envoltura' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, d.modoOrden === 'letras' ? 'Palabra (bien escrita)' : 'Oración (en orden correcto)'), h('th', null, 'Dibujo (emoji)'), h('th', null, 'Desde'), h('th', null, 'Hasta'), h('th', null, ''))),
        h('tbody', null, d.elementos.map((x, i) => h('tr', null, h('td', null, i + 1),
          h('td', { style: { minWidth: '260px' } }, inp(x, 'a', d.modoOrden === 'letras' ? 'mariposa' : 'El perro corre en el parque')),
          h('td', null, inp(x, 'e', '🐶', { style: { width: '90px', minHeight: '44px', fontSize: '1.3rem', textAlign: 'center' } })),
          h('td', null, selGrado(x, 0)), h('td', null, selGrado(x, 1)),
          h('td', null, h('button', { type: 'button', class: 'btn claro chico', 'aria-label': 'Quitar', onclick: () => { d.elementos.splice(i, 1); marcar(); pintar(); } }, '✖'))))))));
    } else if (vocab) {
      zona.append(h('div', { class: 'tabla-envoltura' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, d.etiquetas.a || 'Columna 1'), h('th', null, d.etiquetas.b || 'Columna 2'), h('th', null, 'Dibujo (emoji)'), h('th', null, 'Desde'), h('th', null, 'Hasta'), h('th', null, ''))),
        h('tbody', null, d.elementos.map((x, i) => h('tr', null, h('td', null, i + 1),
          h('td', null, inp(x, 'a', 'dog')), h('td', null, inp(x, 'b', 'perro')), h('td', null, inp(x, 'e', '🐶', { style: { width: '90px', minHeight: '44px', fontSize: '1.3rem', textAlign: 'center' } })),
          h('td', null, selGrado(x, 0)), h('td', null, selGrado(x, 1)),
          h('td', null, h('button', { type: 'button', class: 'btn claro chico', 'aria-label': 'Quitar', onclick: () => { d.elementos.splice(i, 1); marcar(); pintar(); } }, '✖'))))))));
    } else {
      zona.append(d.elementos.map((x, i) => h('div', { class: 'bloque-pregunta' },
        h('div', { class: 'cabecera' }, h('span', { class: 'tipo' }, `Pregunta ${i + 1}`), 'Grados', selGrado(x, 0), 'a', selGrado(x, 1),
          h('button', { type: 'button', class: 'btn peligro chico', onclick: () => { d.elementos.splice(i, 1); marcar(); pintar(); } }, '🗑️')),
        h('div', { class: 'form-rejilla' }, campo('Pregunta', inp(x, 'p', '¿Cuál es…?')), campo('Dibujo (emoji, opcional)', inp(x, 'e', '🌎'))),
        h('details', { open: !!x.t }, h('summary', { style: { cursor: 'pointer', fontWeight: 800, color: 'var(--azul)', minHeight: '36px' } }, 'Texto para leer antes de responder (opcional)'),
          h('textarea', { oninput: (e) => { x.t = e.target.value; marcar(); }, placeholder: 'Una lectura corta; el alumno la ve arriba de la pregunta.' }, x.t || '')),
        h('div', { class: 'form-rejilla' }, campo('✔ Respuesta correcta', inp(x, 'r', '')),
          [0, 1, 2].map((k) => campo(`✖ Incorrecta ${k + 1}${k ? ' (opcional)' : ''}`, h('input', { type: 'text', value: x.o?.[k] || '', style: { minHeight: '44px' }, oninput: (e) => { x.o = x.o || []; x.o[k] = e.target.value; marcar(); } })))))));
    }
    actualizarContador();
  };
  const nuevoElemento = () => (vocab ? { a: '', b: '', e: '', n: [1, 6] } : ord ? { a: '', e: '', n: [1, 6] } : { p: '', r: '', o: ['', '', ''], e: '', t: '', n: [1, 6] });
  cont.append(h('section', { class: 'tarjeta' },
    h('div', { class: 'encabezado' }, h('h2', null, vocab ? '2. Lista de palabras' : ord ? '2. Palabras u oraciones' : '2. Preguntas'), contador),
    h('p', { class: 'texto-suave chico' }, ord ? 'Mínimo 3. Escríbalas en el orden CORRECTO: el sistema las desordena para el alumno.' : vocab ? 'Mínimo 4 palabras. "Desde / Hasta" indican los grados para los que es cada palabra. Emojis: en el teclado de la tablet toque 😊.' : 'Mínimo 3 preguntas. Para verdadero o falso escriba "Verdadero" como correcta y "Falso" como incorrecta (o al revés).'),
    zona,
    h('div', { class: 'fila-botones', style: { marginTop: '12px' } },
      h('button', { type: 'button', class: 'btn claro', onclick: () => { d.elementos.push(nuevoElemento()); marcar(); pintar(); } }, vocab || ord ? '➕ Agregar' : '➕ Agregar pregunta'),
      h('button', { type: 'button', class: 'btn claro', onclick: pegarLista }, '📋 Pegar lista desde Excel / Sheets'))));
  pintar();

  async function pegarLista() {
    const t = h('textarea', { style: { minHeight: '200px' }, placeholder: ord ? 'El gato come pescado\t\t1\t2\nLa luna brilla de noche\t🌙\t1\t3' : vocab ? 'dog\tperro\t🐶\t1\t3\ncat\tgato\t🐱\t1\t3' : '¿Cuál es el ave nacional?\tel quetzal\tel loro\tla paloma\t\t🐦\t1\t6' });
    const reemplazar = casilla('Reemplazar la lista actual (si no se marca, se agregan al final)', false);
    const r = await modal({ titulo: 'Pegar lista', ancho: true, contenido: h('div', null,
      h('p', null, 'Copie las columnas desde Excel o Google Sheets y péguelas aquí. Una fila por ', vocab ? 'palabra' : 'pregunta', '. Columnas en este orden:'),
      h('p', null, h('b', null, ord ? 'Palabra u oración · Emoji (opcional) · Desde grado · Hasta grado' : vocab ? `${d.etiquetas.a || 'Palabra'} · ${d.etiquetas.b || 'Traducción'} · Emoji (opcional) · Desde grado · Hasta grado` : 'Pregunta · Correcta · Incorrecta 1 · Incorrecta 2 · Incorrecta 3 · Emoji · Desde · Hasta')),
      h('p', { class: 'chico texto-suave' }, 'También se aceptan columnas separadas por punto y coma (;). Las columnas vacías al final se pueden omitir.'),
      t, reemplazar),
    botones: [{ texto: 'Cancelar', clase: 'claro', valor: null }, { texto: 'Agregar', clase: 'verde', accion: () => t.value }] });
    if (!r) return;
    const filas = r.split(/\r?\n/).map((l) => l.split(l.includes('\t') ? '\t' : ';').map((c) => c.trim())).filter((f) => f[0]);
    const grado = (v, def) => { const n = parseInt(String(v || '').replace(/[^0-9]/g, ''), 10); return n >= 1 && n <= 6 ? n : def; };
    const nuevos = filas.map((f) => ord ? { a: f[0], e: f[1] || '', n: [grado(f[2], 1), grado(f[3], 6)] } : vocab ? { a: f[0], b: f[1] || '', e: f[2] || '', n: [grado(f[3], 1), grado(f[4], 6)] }
      : { p: f[0], r: f[1] || '', o: [f[2] || '', f[3] || '', f[4] || ''], e: f[5] || '', n: [grado(f[6], 1), grado(f[7], 6)] });
    if (reemplazar.querySelector('input').checked) d.elementos = nuevos;
    else d.elementos = d.elementos.filter((x) => (vocab || ord ? x.a || x.b : x.p || x.r)).concat(nuevos);
    marcar(); pintar(); aviso(`${nuevos.length} fila(s) agregadas`, 'ok');
  }

  const guardar = async (probar) => {
    const n2 = (x) => [Number(x.n?.[0]) || 1, Number(x.n?.[1]) || 6];
    const limpio = { ...d, elementos: d.elementos.filter((x) => (vocab || ord ? x.a?.trim() || x.b?.trim() : x.p?.trim() || x.r?.trim())).map((x) => (
      ord ? { a: x.a.trim(), e: (x.e || '').trim(), n: n2(x) }
      : vocab ? { a: x.a.trim(), b: (x.b || '').trim(), e: (x.e || '').trim(), n: n2(x) }
      : { p: x.p.trim(), r: (x.r || '').trim(), o: (x.o || []).map((o) => (o || '').trim()).filter(Boolean), e: (x.e || '').trim(), t: (x.t || '').trim(), n: n2(x) })) };
    limpio.titulo = limpio.titulo.trim();
    const problema = validarJuego(limpio);
    if (problema) { aviso(problema, 'error'); return; }
    if (JSON.stringify(limpio).length > 800000) { aviso('El juego es demasiado grande. Divídalo en dos juegos.', 'error'); return; }
    const { id: _x, ...datos } = limpio;
    try {
      const idFinal = j?.id || nuevoId();
      await store.set('juegos', idFinal, { ...datos, autorId: j?.autorId || S.uid, autorNombre: j?.autorNombre || S.yo.nombre, creado: j?.creado ? new Date(j.creado) : store.AHORA, actualizado: store.AHORA });
      registrar(j ? 'Editó juego' : 'Creó juego', limpio.titulo, S.yo);
      sucio = false; aviso('Juego guardado ✔', 'ok');
      const min = Math.min(...limpio.elementos.map((x) => x.n[0]));
      navegar(probar ? `/juego/c-${idFinal}/${min}` : BASE);
    } catch (e) { aviso(errorPermiso(e), 'error'); }
  };
  cont.append(h('div', { class: 'fila-botones' },
    h('button', { class: 'btn verde grande', onclick: () => guardar(false) }, '💾 Guardar juego'),
    h('button', { class: 'btn claro', onclick: () => guardar(true) }, '▶️ Guardar y probar'),
    h('button', { class: 'btn claro', onclick: async () => { if (!sucio || await confirmar('Hay cambios sin guardar. ¿Salir de todas formas?', { si: 'Salir sin guardar' })) navegar(BASE); } }, 'Cancelar')));
}
