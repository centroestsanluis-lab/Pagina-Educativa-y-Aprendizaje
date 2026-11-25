// "Juegos de aprendizaje": la administración y los docentes crean y actualizan
// juegos de Aprende Jugando sin programar.
import { h, vaciar, aviso, modal, confirmar, campo, selector, casilla, cargando, vacio, fecha, normalizar, mensajeError, id as nuevoId } from '../ui.js';
import { store, registrar } from '../store/index.js';
import { ID_SEP } from '../store/permisos.js';
import { S, navegar, materia, recargarCatalogos } from '../app.js';
import { encabezado, miga, intentar } from './comun.js';
import { MODOS, IDIOMAS_VOZ, validarJuego, documentosPaqueteIngles, PAQUETE_INGLES } from '../juegos/personalizados.js';

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
  if (accion === 'nuevo') return editor(cont, null, id === 'preguntas' ? 'preguntas' : 'vocabulario');
  if (accion === 'editar') return editor(cont, id);
  return lista(cont);
}

async function lista(cont) {
  const editables = materiasEditables();
  cont.append(encabezado('🧩 Juegos de aprendizaje',
    editables.length ? h('button', { class: 'btn verde', onclick: () => navegar(BASE + '/nuevo/vocabulario') }, '➕ Juego de vocabulario') : null,
    editables.length ? h('button', { class: 'btn', onclick: () => navegar(BASE + '/nuevo/preguntas') }, '➕ Juego de preguntas') : null,
    h('button', { class: 'btn claro', onclick: () => cargarPaqueteIngles(() => { vaciar(cont); lista(cont); }) }, '📦 Paquete de Inglés')),
  h('div', { class: 'mensaje-info' },
    h('b', null, '¿Cómo funciona? '), 'Usted escribe el contenido una vez y la plataforma arma los juegos solos. ',
    h('b', null, 'Vocabulario: '), 'una lista de palabras con su traducción y un dibujo (emoji); con ella se crean 4 juegos distintos: traducir de ida, de vuelta, adivinar por el dibujo y ordenar letras. ',
    h('b', null, 'Preguntas: '), 'preguntas con su respuesta correcta y opciones incorrectas. ',
    'Cada palabra o pregunta indica para qué grados es. Los juegos aparecen en "Aprende Jugando" dentro de la sección de su materia.'),
  !editables.length ? h('p', { class: 'texto-suave' }, 'Usted todavía no tiene materias asignadas; puede probar los juegos, pero no crearlos.') : null);
  const zona = h('div'); cont.append(zona); cargando(zona);
  let juegos;
  try { juegos = await store.list('juegos'); } catch (e) { vaciar(zona).append(vacio(errorPermiso(e))); return; }
  vaciar(zona);
  if (!juegos.length) { zona.append(vacio('Todavía no hay juegos creados por la escuela. Empiece con "📦 Paquete de Inglés" o cree uno nuevo.')); return; }
  const recargar = () => { vaciar(cont); lista(cont); };
  const grupos = {};
  for (const j of juegos) (grupos[j.materiaId] ||= []).push(j);
  for (const [mid, js] of Object.entries(grupos)) {
    const m = materia(mid);
    zona.append(h('section', { class: 'tarjeta' }, h('h2', null, `${m.icono || ''} ${m.nombre}`),
      h('div', { class: 'lista' }, js.sort((a, b) => String(a.titulo).localeCompare(b.titulo)).map((j) => {
        const niveles = (j.elementos || []).flatMap((x) => [Number(x.n?.[0]) || 1, Number(x.n?.[1]) || 6]);
        const rango = niveles.length ? `${Math.min(...niveles)}° a ${Math.max(...niveles)}°` : '—';
        const nivelPrueba = niveles.length ? Math.min(...niveles) : 1;
        return h('div', { class: 'item' + (j.visible === false ? ' inactivo' : ''), style: { cursor: 'default', flexWrap: 'wrap' } },
          h('span', { class: 'ic-redondo', style: { '--c': m.color } }, j.icono || '🧩'),
          h('div', { class: 'cuerpo', style: { minWidth: '200px' } }, h('strong', null, j.titulo),
            h('small', null, `${j.tipo === 'vocabulario' ? 'Vocabulario' : 'Preguntas'} · ${(j.elementos || []).length} ${j.tipo === 'vocabulario' ? 'palabras' : 'preguntas'} · grados ${rango}`,
              j.actualizado ? ` · actualizado ${fecha(j.actualizado)}` : '', j.visible === false ? ' · (oculto)' : '')),
          h('div', { class: 'fila-botones' },
            h('button', { class: 'btn chico', onclick: () => navegar(`/juego/c-${j.id}/${nivelPrueba}`) }, '▶️ Probar'),
            puedeEditar(j) ? [
              h('button', { class: 'btn claro chico', onclick: () => navegar(`${BASE}/editar/${j.id}`) }, '✏️ Editar'),
              h('button', { class: 'btn claro chico', onclick: () => intentar(() => store.update('juegos', j.id, { visible: j.visible === false, actualizado: store.AHORA }), j.visible === false ? 'Visible para alumnos' : 'Oculto para alumnos').then(recargar) }, j.visible === false ? '👁️ Mostrar' : '🙈 Ocultar'),
              h('button', { class: 'btn peligro chico', onclick: async () => { if (await confirmar(`¿Eliminar el juego "${j.titulo}"? El progreso de los alumnos en este juego deja de mostrarse.`)) { try { await store.del('juegos', j.id); registrar('Eliminó juego', j.titulo, S.yo); aviso('Juego eliminado', 'ok'); } catch (e) { aviso(errorPermiso(e), 'error'); } recargar(); } } }, '🗑️'),
            ] : null));
      }))));
  }
}

// ------------------------------------------------------------------ Paquete de Inglés
async function cargarPaqueteIngles(listo) {
  let m = S.materias.find((x) => x.id === 'ingles' || normalizar(x.nombre) === 'ingles');
  if (!m && S.yo.rol !== 'admin') { await modal({ titulo: 'Falta la materia Inglés', contenido: 'Pida a la administración que cree la materia "Inglés" y se la asigne.' }); return; }
  if (m && !materiasEditables().some((x) => x.id === m.id)) { await modal({ titulo: 'Sin permiso', contenido: 'Solo la administración o los docentes de Inglés pueden cargar este paquete.' }); return; }
  const ok = await confirmar(h('div', null,
    h('p', null, `Se crearán ${PAQUETE_INGLES.length} juegos de vocabulario en inglés con pronunciación: `, PAQUETE_INGLES.map((p) => p.titulo).join(', '), '.'),
    !m ? h('p', { class: 'mensaje-info' }, 'También se creará la materia "Inglés" para todos los grados (puede cambiarlo en Materias).') : null,
    h('p', { class: 'chico texto-suave' }, 'Los juegos que ya existan con el mismo nombre no se duplican. Después puede editarlos, agregar palabras u ocultarlos.')), { si: 'Cargar paquete', clase: 'verde', titulo: 'Paquete inicial de Inglés' });
  if (!ok) return;
  try {
    if (!m) {
      await store.set('materias', 'ingles', { nombre: 'Inglés', icono: '🔤', color: 'var(--morado)', grados: S.grados.map((g) => g.id), visible: true, orden: S.materias.length + 1 });
      await recargarCatalogos(); m = materia('ingles');
      registrar('Creó materia', 'Inglés', S.yo);
    }
    const existentes = new Set((await store.list('juegos', [['materiaId', '==', m.id]])).map((j) => normalizar(j.titulo)));
    const nuevos = documentosPaqueteIngles(m.id, S.uid).filter((d) => !existentes.has(normalizar(d.titulo)));
    await store.lote(nuevos.map((d) => ({ op: 'set', col: 'juegos', id: nuevoId(), data: { ...d, creado: store.AHORA, actualizado: store.AHORA } })));
    registrar('Cargó paquete de Inglés', `${nuevos.length} juegos`, S.yo);
    aviso(nuevos.length ? `${nuevos.length} juegos de Inglés listos ✔` : 'Los juegos de Inglés ya estaban cargados', 'ok');
    listo();
  } catch (e) { aviso(errorPermiso(e), 'error'); }
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
  const d = JSON.parse(JSON.stringify(j || {
    titulo: '', materiaId: editables[0].id, icono: vocab ? '🔤' : '🧩', visible: true, tipo,
    etiquetas: { a: 'inglés', b: 'español' }, voz: vocab ? 'en-US' : '', modos: vocab ? ['a2b', 'b2a', 'emoji', 'letras'] : [],
    elementos: vocab ? [{ a: '', b: '', e: '', n: [1, 6] }, { a: '', b: '', e: '', n: [1, 6] }, { a: '', b: '', e: '', n: [1, 6] }, { a: '', b: '', e: '', n: [1, 6] }]
      : [{ p: '', r: '', o: ['', '', ''], e: '', n: [1, 6] }],
  }));
  let sucio = false; const marcar = () => { sucio = true; };

  cont.append(miga([['Juegos de aprendizaje', BASE], [j ? j.titulo : vocab ? 'Nuevo juego de vocabulario' : 'Nuevo juego de preguntas']]),
    h('h1', null, j ? `✏️ ${j.titulo}` : vocab ? '➕ Nuevo juego de vocabulario' : '➕ Nuevo juego de preguntas'));

  // ---- Datos generales ----
  const iconoInp = h('input', { type: 'text', value: d.icono, maxLength: 4, style: { width: '90px', fontSize: '1.5rem', textAlign: 'center' }, oninput: (e) => { d.icono = e.target.value; marcar(); } });
  cont.append(h('section', { class: 'tarjeta' }, h('h2', null, '1. Datos del juego'),
    h('div', { class: 'form-rejilla' },
      campo('Nombre del juego', h('input', { type: 'text', value: d.titulo, placeholder: vocab ? 'Ejemplo: Animals / Animales' : 'Ejemplo: Valores y convivencia', oninput: (e) => { d.titulo = e.target.value; marcar(); } })),
      campo('Materia', selector(editables.map((m) => [m.id, `${m.icono || ''} ${m.nombre}`]), d.materiaId, { onchange: (e) => { d.materiaId = e.target.value; marcar(); } }))),
    h('div', { class: 'etiqueta' }, 'Ícono'),
    h('div', { class: 'fila-botones', style: { marginBottom: '12px' } }, iconoInp, ICONOS.map((ic) => h('button', { type: 'button', class: 'btn claro chico', onclick: () => { d.icono = ic; iconoInp.value = ic; marcar(); } }, ic))),
    casilla('Visible para los alumnos', d.visible !== false, { onchange: (e) => { d.visible = e.target.checked; marcar(); } }),
    vocab ? [
      h('div', { class: 'form-rejilla', style: { marginTop: '10px' } },
        campo('Nombre de la columna 1 (palabra)', h('input', { type: 'text', value: d.etiquetas.a, oninput: (e) => { d.etiquetas.a = e.target.value; marcar(); } }), 'Ejemplo: inglés'),
        campo('Nombre de la columna 2 (traducción)', h('input', { type: 'text', value: d.etiquetas.b, oninput: (e) => { d.etiquetas.b = e.target.value; marcar(); } }), 'Ejemplo: español'),
        campo('Pronunciación de la columna 1', selector(IDIOMAS_VOZ, d.voz || '', { onchange: (e) => { d.voz = e.target.value; marcar(); } }), 'La tablet lee la palabra en voz alta (botón 🔊).')),
      h('div', { class: 'etiqueta' }, 'Formas de jugar (el sistema las mezcla)'),
      Object.entries(MODOS).map(([k, m]) => casilla(`${m.nombre} — ${m.ejemplo}`, d.modos.includes(k), { onchange: (e) => { d.modos = e.target.checked ? [...new Set([...d.modos, k])] : d.modos.filter((x) => x !== k); marcar(); } })),
    ] : null));

  // ---- Contenido ----
  const zona = h('div'); const contador = h('span', { class: 'texto-suave' });
  const actualizarContador = () => { const n = d.elementos.filter((x) => (vocab ? x.a?.trim() && x.b?.trim() : x.p?.trim() && x.r?.trim())).length; contador.textContent = `${n} ${vocab ? 'palabras completas' : 'preguntas completas'}`; };
  const selGrado = (x, i) => selector(GRADOS, x.n?.[i] ?? (i ? 6 : 1), { style: { width: '78px', minHeight: '44px', padding: '4px 8px' }, 'aria-label': i ? 'Hasta grado' : 'Desde grado', onchange: (e) => { x.n = x.n || [1, 6]; x.n[i] = Number(e.target.value); marcar(); } });
  const inp = (x, k, ph, extra = {}) => h('input', { type: 'text', value: x[k] || '', placeholder: ph, style: { minHeight: '44px' }, oninput: (e) => { x[k] = e.target.value; marcar(); actualizarContador(); }, ...extra });
  const pintar = () => {
    vaciar(zona);
    if (vocab) {
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
        h('div', { class: 'form-rejilla' }, campo('✔ Respuesta correcta', inp(x, 'r', '')),
          [0, 1, 2].map((k) => campo(`✖ Incorrecta ${k + 1}${k ? ' (opcional)' : ''}`, h('input', { type: 'text', value: x.o?.[k] || '', style: { minHeight: '44px' }, oninput: (e) => { x.o = x.o || []; x.o[k] = e.target.value; marcar(); } })))))));
    }
    actualizarContador();
  };
  const nuevoElemento = () => (vocab ? { a: '', b: '', e: '', n: [1, 6] } : { p: '', r: '', o: ['', '', ''], e: '', n: [1, 6] });
  cont.append(h('section', { class: 'tarjeta' },
    h('div', { class: 'encabezado' }, h('h2', null, vocab ? '2. Lista de palabras' : '2. Preguntas'), contador),
    h('p', { class: 'texto-suave chico' }, vocab ? 'Mínimo 4 palabras. "Desde / Hasta" indican los grados para los que es cada palabra. Emojis: en el teclado de la tablet toque 😊.' : 'Mínimo 3 preguntas. Para verdadero o falso escriba "Verdadero" como correcta y "Falso" como incorrecta (o al revés).'),
    zona,
    h('div', { class: 'fila-botones', style: { marginTop: '12px' } },
      h('button', { type: 'button', class: 'btn claro', onclick: () => { d.elementos.push(nuevoElemento()); marcar(); pintar(); } }, vocab ? '➕ Agregar palabra' : '➕ Agregar pregunta'),
      h('button', { type: 'button', class: 'btn claro', onclick: pegarLista }, '📋 Pegar lista desde Excel / Sheets'))));
  pintar();

  async function pegarLista() {
    const t = h('textarea', { style: { minHeight: '200px' }, placeholder: vocab ? 'dog\tperro\t🐶\t1\t3\ncat\tgato\t🐱\t1\t3' : '¿Cuál es el ave nacional?\tel quetzal\tel loro\tla paloma\t\t🐦\t1\t6' });
    const reemplazar = casilla('Reemplazar la lista actual (si no se marca, se agregan al final)', false);
    const r = await modal({ titulo: 'Pegar lista', ancho: true, contenido: h('div', null,
      h('p', null, 'Copie las columnas desde Excel o Google Sheets y péguelas aquí. Una fila por ', vocab ? 'palabra' : 'pregunta', '. Columnas en este orden:'),
      h('p', null, h('b', null, vocab ? `${d.etiquetas.a || 'Palabra'} · ${d.etiquetas.b || 'Traducción'} · Emoji (opcional) · Desde grado · Hasta grado` : 'Pregunta · Correcta · Incorrecta 1 · Incorrecta 2 · Incorrecta 3 · Emoji · Desde · Hasta')),
      h('p', { class: 'chico texto-suave' }, 'También se aceptan columnas separadas por punto y coma (;). Las columnas vacías al final se pueden omitir.'),
      t, reemplazar),
    botones: [{ texto: 'Cancelar', clase: 'claro', valor: null }, { texto: 'Agregar', clase: 'verde', accion: () => t.value }] });
    if (!r) return;
    const filas = r.split(/\r?\n/).map((l) => l.split(l.includes('\t') ? '\t' : ';').map((c) => c.trim())).filter((f) => f[0]);
    const grado = (v, def) => { const n = parseInt(String(v || '').replace(/[^0-9]/g, ''), 10); return n >= 1 && n <= 6 ? n : def; };
    const nuevos = filas.map((f) => vocab ? { a: f[0], b: f[1] || '', e: f[2] || '', n: [grado(f[3], 1), grado(f[4], 6)] }
      : { p: f[0], r: f[1] || '', o: [f[2] || '', f[3] || '', f[4] || ''], e: f[5] || '', n: [grado(f[6], 1), grado(f[7], 6)] });
    if (reemplazar.querySelector('input').checked) d.elementos = nuevos;
    else d.elementos = d.elementos.filter((x) => (vocab ? x.a || x.b : x.p || x.r)).concat(nuevos);
    marcar(); pintar(); aviso(`${nuevos.length} fila(s) agregadas`, 'ok');
  }

  const guardar = async (probar) => {
    const limpio = { ...d, elementos: d.elementos.filter((x) => (vocab ? x.a?.trim() || x.b?.trim() : x.p?.trim() || x.r?.trim())).map((x) => (vocab
      ? { a: x.a.trim(), b: (x.b || '').trim(), e: (x.e || '').trim(), n: [Number(x.n?.[0]) || 1, Number(x.n?.[1]) || 6] }
      : { p: x.p.trim(), r: (x.r || '').trim(), o: (x.o || []).map((o) => (o || '').trim()).filter(Boolean), e: (x.e || '').trim(), n: [Number(x.n?.[0]) || 1, Number(x.n?.[1]) || 6] })) };
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
