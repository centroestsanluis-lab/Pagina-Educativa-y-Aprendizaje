// Creador de actividades: pensado para docentes sin conocimientos técnicos.
import { h, vaciar, aviso, modal, confirmar, campo, selector, casilla, comprimirImagen, aInputFecha, deInputFecha, barajar, id as nuevoId, cargando, vacio, mensajeError } from '../ui.js';
import { store, registrar } from '../store/index.js';
import { S, navegar, grado, materia } from '../app.js';
import { miga, ordenar } from './comun.js';
import { TIPOS, pregunta as dibujarPregunta } from './resolver.js';
import { partesClase, misClases } from './docente.js';
import { urlImagen } from '../drive.js';

// ---- Conversión entre lo guardado (pública + clave) y el modelo del editor ----
function aModelo(p, clave = {}) {
  const base = { id: p.id, tipo: p.tipo, enunciado: p.enunciado || '', imagen: p.imagen || '', puntos: p.puntos || 1, explicacion: clave.explicacion || '' };
  switch (p.tipo) {
    case 'opcion': return { ...base, opciones: p.opciones?.length ? p.opciones.slice() : ['', ''], correcta: clave.correcta ?? null };
    case 'vf': return { ...base, correcta: clave.correcta ?? null };
    case 'completar': {
      let i = 0; const huecos = clave.huecos || [];
      return { ...base, textoMarcado: String(p.texto || '').replace(/___/g, () => `[${(huecos[i++] || ['']).join('|')}]`) };
    }
    case 'relacionar': return { ...base, pares: (p.izquierda || []).map((iz, k) => [iz, p.derecha?.[clave.pares?.[k]] ?? '']) };
    case 'ordenar': return { ...base, lineas: (clave.orden || []).map((k) => p.elementos[k]).join('\n') };
    case 'corta': return { ...base, aceptadas: (clave.aceptadas || []).join('\n') };
    case 'numerica': return { ...base, valor: clave.valor ?? '', tolerancia: clave.tolerancia ?? 0, unidad: p.unidad || '' };
    default: return base;
  }
}
const nuevaPregunta = (tipo) => aModelo({ id: 'p' + nuevoId(), tipo, puntos: 1, opciones: tipo === 'opcion' ? ['', '', '', ''] : undefined, izquierda: tipo === 'relacionar' ? ['', '', ''] : undefined, derecha: ['', '', ''] }, tipo === 'relacionar' ? { pares: [0, 1, 2] } : {});

/** Devuelve [publica, clave] o lanza un mensaje claro si falta algo. */
function separar(m, n) {
  const pub = { id: m.id, tipo: m.tipo, enunciado: m.enunciado.trim(), puntos: Math.max(0.5, Number(m.puntos) || 1) };
  if (m.imagen) pub.imagen = m.imagen;
  const clave = {}; if (m.explicacion?.trim()) clave.explicacion = m.explicacion.trim();
  const falla = (t) => { throw new Error(`Pregunta ${n}: ${t}`); };
  if (!pub.enunciado && m.tipo !== 'completar') falla('escriba el enunciado.');
  switch (m.tipo) {
    case 'opcion': {
      const ops = m.opciones.map((o) => o.trim());
      const llenas = ops.map((o, i) => [o, i]).filter(([o]) => o);
      if (llenas.length < 2) falla('escriba al menos dos opciones.');
      if (m.correcta === null || !ops[m.correcta]) falla('marque cuál es la opción correcta (círculo verde).');
      pub.opciones = llenas.map(([o]) => o); clave.correcta = llenas.findIndex(([, i]) => i === m.correcta); break;
    }
    case 'vf': if (m.correcta !== true && m.correcta !== false) falla('indique si es verdadero o falso.'); clave.correcta = m.correcta; break;
    case 'completar': {
      const huecos = []; const texto = m.textoMarcado.replace(/\[([^\]]*)\]/g, (_, x) => { huecos.push(x.split('|').map((s) => s.trim()).filter(Boolean)); return '___'; });
      if (!huecos.length || huecos.some((x) => !x.length)) falla('marque entre corchetes [ ] las palabras que el alumno debe escribir.');
      pub.texto = texto; if (!pub.enunciado) pub.enunciado = 'Completa los espacios:'; clave.huecos = huecos; break;
    }
    case 'relacionar': {
      const pares = m.pares.map(([a, b]) => [a.trim(), b.trim()]).filter(([a, b]) => a || b);
      if (pares.length < 2 || pares.some(([a, b]) => !a || !b)) falla('escriba al menos dos parejas completas.');
      pub.izquierda = pares.map(([a]) => a);
      let orden = barajar(pares.map((_, i) => i));
      if (orden.every((v, i) => v === i)) orden = orden.slice(1).concat(orden[0]);
      pub.derecha = orden.map((i) => pares[i][1]);
      clave.pares = pares.map((_, i) => orden.indexOf(i)); break;
    }
    case 'ordenar': {
      const els = m.lineas.split('\n').map((s) => s.trim()).filter(Boolean);
      if (els.length < 2) falla('escriba al menos dos elementos, uno por línea.');
      let orden = barajar(els.map((_, i) => i));
      if (orden.every((v, i) => v === i)) orden = orden.slice(1).concat(orden[0]);
      pub.elementos = orden.map((i) => els[i]);
      clave.orden = els.map((_, i) => orden.indexOf(i)); break;
    }
    case 'corta': {
      const ac = m.aceptadas.split('\n').map((s) => s.trim()).filter(Boolean);
      if (!ac.length) falla('escriba al menos una respuesta aceptada.');
      clave.aceptadas = ac; break;
    }
    case 'numerica': {
      const v = Number(String(m.valor).replace(',', '.'));
      if (String(m.valor).trim() === '' || isNaN(v)) falla('escriba la respuesta correcta como número.');
      clave.valor = v; clave.tolerancia = Math.abs(Number(String(m.tolerancia).replace(',', '.')) || 0);
      if (m.unidad?.trim()) pub.unidad = m.unidad.trim(); break;
    }
    case 'abierta': break;
    default: falla('tipo desconocido.');
  }
  return [pub, clave];
}

// ------------------------------------------------------------------
export async function renderEditor(cont, actividadId, claseNueva) {
  cargando(cont);
  let act = null; let clave = null;
  try {
    if (actividadId) {
      act = await store.get('actividades', actividadId);
      if (!act) { vaciar(cont).append(vacio('La actividad no existe.')); return; }
      clave = await store.get('claves', actividadId);
    }
  } catch (e) { vaciar(cont).append(vacio(mensajeError(e))); return; }
  const clase = act?.clase || claseNueva;
  if (!misClases().includes(clase)) { vaciar(cont).append(vacio('No tiene asignada esta clase.')); return; }
  const { gradoId, materiaId } = partesClase(clase);
  let temas = [];
  try { temas = ordenar(await store.list('temas', [['clase', '==', clase]])); } catch { /* */ }
  let entregasPrevias = 0;
  if (act) { try { entregasPrevias = (await store.list('entregas', [['clase', '==', clase], ['actividadId', '==', act.id]])).length; } catch { /* */ } }

  const modelo = {
    titulo: act?.titulo || '', instrucciones: act?.instrucciones || '', temaId: act?.temaId || '', imagen: act?.imagen || '',
    fechaPublicacion: act?.fechaPublicacion || Date.now(), fechaLimite: act?.fechaLimite || null, intentos: act?.intentos || 1,
    mostrarNota: act ? act.mostrarNota !== false : true, mostrarRespuestas: act ? !!act.mostrarRespuestas : true, publicada: act ? !!act.publicada : false,
    preguntas: (act?.preguntas || []).map((p) => aModelo(p, clave?.respuestas?.[p.id] || {})),
  };
  let sucio = false;
  const marcar = () => { sucio = true; };

  vaciar(cont);
  const g = grado(gradoId); const m = materia(materiaId);
  const volver = '/clase/' + encodeURIComponent(clase);
  cont.append(miga([[S.yo.rol === 'admin' ? 'Contenidos' : 'Mis clases', S.yo.rol === 'admin' ? '/contenidos' : '/'], [`${m.nombre} · ${g.nombre}`, volver], [act ? 'Editar actividad' : 'Nueva actividad']]));
  if (entregasPrevias) cont.append(h('div', { class: 'mensaje-info' }, `⚠️ ${entregasPrevias} alumno(s) ya entregaron esta actividad. Si cambia respuestas correctas, luego use "Recalificar" en Resultados.`));

  // ---- Datos generales ----
  const inp = (k, attrs = {}) => h('input', { type: 'text', value: modelo[k] ?? '', oninput: (e) => { modelo[k] = e.target.value; marcar(); }, ...attrs });
  const fPub = h('input', { type: 'datetime-local', value: aInputFecha(modelo.fechaPublicacion), onchange: (e) => { modelo.fechaPublicacion = deInputFecha(e.target.value) || Date.now(); marcar(); } });
  const fLim = h('input', { type: 'datetime-local', value: aInputFecha(modelo.fechaLimite), onchange: (e) => { modelo.fechaLimite = deInputFecha(e.target.value); marcar(); } });
  const chk = (k, texto) => casilla(texto, modelo[k], { onchange: (e) => { modelo[k] = e.target.checked; marcar(); } });
  const vistaImg = h('div');
  const pintarImg = () => vaciar(vistaImg).append(modelo.imagen ? h('div', { class: 'fila-botones' }, h('img', { src: urlImagen(modelo.imagen), alt: '', style: { maxHeight: '90px', borderRadius: '10px' } }),
    h('button', { class: 'btn peligro chico', type: 'button', onclick: () => { modelo.imagen = ''; marcar(); pintarImg(); } }, 'Quitar imagen')) : null);
  pintarImg();
  cont.append(h('section', { class: 'tarjeta' },
    h('h2', null, '1. Datos de la actividad'),
    campo('Título', inp('titulo', { placeholder: 'Ejemplo: Repaso de fracciones' })),
    campo('Instrucciones para el alumno', h('textarea', { oninput: (e) => { modelo.instrucciones = e.target.value; marcar(); } }, modelo.instrucciones)),
    h('div', { class: 'form-rejilla' },
      campo('Tema o unidad', selector([['', 'Sin tema'], ...temas.map((t) => [t.id, t.nombre])], modelo.temaId, { onchange: (e) => { modelo.temaId = e.target.value; marcar(); } })),
      campo('Intentos permitidos', selector([1, 2, 3, 4, 5, 10].map((n) => [n, n === 1 ? '1 intento' : `${n} intentos`]), modelo.intentos, { onchange: (e) => { modelo.intentos = Number(e.target.value); marcar(); } })),
      campo('Disponible desde', fPub), campo('Fecha límite (opcional)', fLim, 'Déjelo vacío si no tiene fecha límite.')),
    campo('Imagen de portada (opcional)', h('input', { type: 'file', accept: 'image/*', onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { modelo.imagen = await comprimirImagen(f, 800, 0.75); marcar(); pintarImg(); } catch (err) { aviso(mensajeError(err), 'error'); }
    } }), 'Se reduce automáticamente para que cargue rápido en las tablets.'),
    vistaImg));

  // ---- Preguntas ----
  const lista = h('div');
  const totalPts = h('b');
  const pintarPreguntas = () => {
    vaciar(lista);
    modelo.preguntas.forEach((p, i) => lista.append(bloquePregunta(p, i)));
    if (!modelo.preguntas.length) lista.append(h('p', { class: 'texto-suave' }, 'Aún no hay preguntas. Elija abajo el tipo de pregunta que quiere agregar.'));
    totalPts.textContent = modelo.preguntas.reduce((s, p) => s + (Number(p.puntos) || 0), 0);
  };
  const mover = (i, d) => { const j = i + d; if (j < 0 || j >= modelo.preguntas.length) return; [modelo.preguntas[i], modelo.preguntas[j]] = [modelo.preguntas[j], modelo.preguntas[i]]; marcar(); pintarPreguntas(); };

  function bloquePregunta(p, i) {
    const t = TIPOS[p.tipo];
    const cambiar = (k) => (e) => { p[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; marcar(); if (k === 'puntos') totalPts.textContent = modelo.preguntas.reduce((s, x) => s + (Number(x.puntos) || 0), 0); };
    const cuerpo = h('div');
    const pintarImgP = h('div');
    const refrescarImgP = () => vaciar(pintarImgP).append(p.imagen ? h('div', { class: 'fila-botones' }, h('img', { src: urlImagen(p.imagen), alt: '', style: { maxHeight: '70px', borderRadius: '8px' } }),
      h('button', { type: 'button', class: 'btn peligro chico', onclick: () => { p.imagen = ''; marcar(); refrescarImgP(); } }, 'Quitar')) : null);
    refrescarImgP();
    cuerpo.append(
      p.tipo === 'completar' ? null : campo('Pregunta o enunciado', h('textarea', { rows: 2, oninput: cambiar('enunciado'), style: { minHeight: '64px' } }, p.enunciado)),
      especifico(p));
    return h('div', { class: 'bloque-pregunta' },
      h('div', { class: 'cabecera' }, h('span', { class: 'num-preg', style: { background: 'var(--marino)', color: '#fff', borderRadius: '999px', padding: '2px 12px' } }, i + 1),
        h('span', { class: 'tipo' }, `${t.icono} ${t.nombre}`),
        h('label', { class: 'chico', style: { display: 'flex', alignItems: 'center', gap: '6px' } }, 'Puntos', h('input', { type: 'number', min: 0.5, step: 0.5, value: p.puntos, style: { width: '90px', minHeight: '42px' }, oninput: cambiar('puntos') })),
        h('button', { type: 'button', class: 'btn claro chico', title: 'Subir', onclick: () => mover(i, -1) }, '⬆️'),
        h('button', { type: 'button', class: 'btn claro chico', title: 'Bajar', onclick: () => mover(i, 1) }, '⬇️'),
        h('button', { type: 'button', class: 'btn claro chico', title: 'Duplicar', onclick: () => { modelo.preguntas.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(p)), id: 'p' + nuevoId() }); marcar(); pintarPreguntas(); } }, '📄'),
        h('button', { type: 'button', class: 'btn peligro chico', title: 'Eliminar', onclick: async () => { if (await confirmar('¿Eliminar esta pregunta?')) { modelo.preguntas.splice(i, 1); marcar(); pintarPreguntas(); } } }, '🗑️')),
      cuerpo,
      h('details', null, h('summary', { style: { cursor: 'pointer', fontWeight: 800, color: 'var(--azul)', minHeight: '40px' } }, 'Opciones extra: imagen y retroalimentación'),
        campo('Imagen de apoyo', h('input', { type: 'file', accept: 'image/*', onchange: async (e) => { const f = e.target.files[0]; if (!f) return; p.imagen = await comprimirImagen(f, 700, 0.72); marcar(); refrescarImgP(); } })),
        pintarImgP,
        campo('Retroalimentación (se muestra al revisar)', h('input', { type: 'text', value: p.explicacion || '', placeholder: 'Ejemplo: Recuerda que 3 × 4 es sumar 3 cuatro veces.', oninput: cambiar('explicacion') }))));
  }

  function especifico(p) {
    const c = h('div');
    const redibujar = () => { const nuevo = especifico(p); c.replaceWith(nuevo); };
    switch (p.tipo) {
      case 'opcion':
        c.append(h('p', { class: 'chico texto-suave' }, 'Escriba las opciones y toque el círculo de la respuesta correcta.'),
          p.opciones.map((o, k) => h('div', { class: 'fila-opcion' },
            h('input', { type: 'radio', name: 'c' + p.id, checked: p.correcta === k, 'aria-label': 'Correcta', onchange: () => { p.correcta = k; marcar(); } }),
            h('input', { type: 'text', value: o, placeholder: `Opción ${'ABCDEF'[k]}`, oninput: (e) => { p.opciones[k] = e.target.value; marcar(); } }),
            p.opciones.length > 2 ? h('button', { type: 'button', class: 'btn claro chico', onclick: () => { p.opciones.splice(k, 1); if (p.correcta === k) p.correcta = null; else if (p.correcta > k) p.correcta--; marcar(); redibujar(); } }, '✖') : null)),
          p.opciones.length < 6 ? h('button', { type: 'button', class: 'btn claro chico', onclick: () => { p.opciones.push(''); marcar(); redibujar(); } }, '➕ Agregar opción') : null);
        break;
      case 'vf':
        c.append(h('div', { class: 'fila-botones' }, [[true, '✔ Verdadero'], [false, '✖ Falso']].map(([v, t]) =>
          h('label', { class: 'casilla' }, h('input', { type: 'radio', name: 'vf' + p.id, checked: p.correcta === v, onchange: () => { p.correcta = v; marcar(); } }), 'La respuesta es: ', t))));
        break;
      case 'completar':
        c.append(campo('Instrucción (opcional)', h('input', { type: 'text', value: p.enunciado, placeholder: 'Completa los espacios:', oninput: (e) => { p.enunciado = e.target.value; marcar(); } })),
          campo('Texto con espacios', h('textarea', { oninput: (e) => { p.textoMarcado = e.target.value; marcar(); }, placeholder: 'El [sol] sale por el [este|oriente].' }, p.textoMarcado || ''),
            'Ponga entre corchetes [ ] lo que el alumno debe escribir. Si acepta varias respuestas, sepárelas con | . No importan mayúsculas ni tildes.'));
        break;
      case 'relacionar':
        c.append(h('p', { class: 'chico texto-suave' }, 'Escriba cada pareja correcta. El sistema mezclará la columna derecha para el alumno.'),
          p.pares.map((par, k) => h('div', { class: 'fila-opcion' },
            h('input', { type: 'text', value: par[0], placeholder: 'Columna A', oninput: (e) => { par[0] = e.target.value; marcar(); } }), h('b', null, '↔'),
            h('input', { type: 'text', value: par[1], placeholder: 'Columna B', oninput: (e) => { par[1] = e.target.value; marcar(); } }),
            p.pares.length > 2 ? h('button', { type: 'button', class: 'btn claro chico', onclick: () => { p.pares.splice(k, 1); marcar(); redibujar(); } }, '✖') : null)),
          p.pares.length < 10 ? h('button', { type: 'button', class: 'btn claro chico', onclick: () => { p.pares.push(['', '']); marcar(); redibujar(); } }, '➕ Agregar pareja') : null);
        break;
      case 'ordenar':
        c.append(campo('Elementos en el ORDEN CORRECTO (uno por línea)', h('textarea', { oninput: (e) => { p.lineas = e.target.value; marcar(); }, placeholder: 'Primero\nSegundo\nTercero' }, p.lineas || ''), 'El sistema los mezclará para el alumno.'));
        break;
      case 'corta':
        c.append(campo('Respuestas aceptadas (una por línea)', h('textarea', { oninput: (e) => { p.aceptadas = e.target.value; marcar(); }, placeholder: 'Guatemala\nCiudad de Guatemala' }, p.aceptadas || ''), 'No importan mayúsculas, tildes ni puntos. Si la respuesta no coincide, se cuenta como incorrecta.'));
        break;
      case 'numerica':
        c.append(h('div', { class: 'form-rejilla' },
          campo('Respuesta correcta (número)', h('input', { type: 'text', inputmode: 'decimal', value: p.valor, oninput: (e) => { p.valor = e.target.value; marcar(); } })),
          campo('Margen permitido', h('input', { type: 'text', inputmode: 'decimal', value: p.tolerancia, oninput: (e) => { p.tolerancia = e.target.value; marcar(); } }), 'Normalmente 0. Ejemplo: 0.1 acepta 3.4 a 3.6 si la respuesta es 3.5'),
          campo('Unidad (opcional)', h('input', { type: 'text', value: p.unidad, placeholder: 'cm, quetzales, manzanas…', oninput: (e) => { p.unidad = e.target.value; marcar(); } }))));
        break;
      case 'abierta':
        c.append(h('div', { class: 'mensaje-info chico' }, 'Esta pregunta no se califica sola: quedará "pendiente de revisión" y usted le pondrá los puntos en Resultados.'));
        break;
    }
    return c;
  }

  cont.append(h('section', { class: 'tarjeta' },
    h('div', { class: 'encabezado' }, h('h2', null, '2. Preguntas'), h('span', null, 'Puntos totales: ', totalPts)),
    lista,
    h('h3', { style: { marginTop: '16px' } }, 'Agregar pregunta:'),
    h('div', { class: 'tipos-pregunta' }, Object.entries(TIPOS).map(([k, t]) => h('button', { type: 'button', onclick: () => { modelo.preguntas.push(nuevaPregunta(k)); marcar(); pintarPreguntas(); lista.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, h('span', null, t.icono), t.nombre)))));
  pintarPreguntas();

  cont.append(h('section', { class: 'tarjeta' },
    h('h2', null, '3. Opciones de calificación y publicación'),
    chk('mostrarNota', 'Mostrar la nota al alumno en cuanto termine'),
    chk('mostrarRespuestas', 'Mostrar las respuestas correctas al alumno cuando termine todos sus intentos'),
    chk('publicada', 'Publicar (los alumnos podrán verla desde la fecha "Disponible desde")'),
    h('div', { class: 'fila-botones', style: { marginTop: '16px' } },
      h('button', { class: 'btn verde grande', onclick: guardar }, '💾 Guardar actividad'),
      h('button', { class: 'btn claro', onclick: vistaPrevia }, '👀 Vista previa'),
      h('button', { class: 'btn claro', onclick: async () => { if (!sucio || await confirmar('Hay cambios sin guardar. ¿Salir de todas formas?', { si: 'Salir sin guardar' })) navegar(volver); } }, 'Cancelar'))));

  function preparar() {
    if (!modelo.titulo.trim()) throw new Error('Escriba el título de la actividad.');
    if (!modelo.preguntas.length) throw new Error('Agregue al menos una pregunta.');
    if (modelo.fechaLimite && modelo.fechaLimite <= modelo.fechaPublicacion) throw new Error('La fecha límite debe ser después de la fecha de inicio.');
    const pubs = []; const claves = {};
    modelo.preguntas.forEach((p, i) => { const [pub, c] = separar(p, i + 1); pubs.push(pub); claves[p.id] = c; });
    return { pubs, claves };
  }

  function vistaPrevia() {
    let r; try { r = preparar(); } catch (e) { aviso(e.message, 'error'); return; }
    modal({ titulo: 'Vista previa (así lo verá el alumno)', ancho: true,
      contenido: h('div', { style: { background: 'var(--fondo)', padding: '10px', borderRadius: '16px' } },
        modelo.instrucciones ? h('div', { class: 'mensaje-info' }, '📌 ', modelo.instrucciones) : null,
        r.pubs.map((p, i) => dibujarPregunta(p, i + 1, undefined, () => {}))) });
  }

  async function guardar(e) {
    const btn = e.currentTarget;
    let r; try { r = preparar(); } catch (err) { aviso(err.message, 'error'); return; }
    if (JSON.stringify(r.pubs).length + (modelo.imagen?.length || 0) > 900000) { aviso('La actividad tiene demasiadas imágenes. Quite alguna o use imágenes más pequeñas.', 'error'); return; }
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      const id = act?.id || store.nuevoId();
      const datos = {
        gradoId, materiaId, clase, temaId: modelo.temaId, titulo: modelo.titulo.trim(), instrucciones: modelo.instrucciones.trim(), imagen: modelo.imagen,
        preguntas: r.pubs, puntajeTotal: r.pubs.reduce((s, p) => s + p.puntos, 0),
        publicada: modelo.publicada, fechaPublicacion: new Date(modelo.fechaPublicacion), fechaLimite: modelo.fechaLimite ? new Date(modelo.fechaLimite) : null,
        intentos: modelo.intentos, mostrarNota: modelo.mostrarNota, mostrarRespuestas: modelo.mostrarRespuestas, actualizado: store.AHORA,
      };
      const ops = [
        { op: 'set', col: 'actividades', id, data: act ? { ...datos, autorId: act.autorId || S.uid, creado: act.creado ? new Date(act.creado) : store.AHORA } : { ...datos, autorId: S.uid, creado: store.AHORA } },
        { op: 'set', col: 'claves', id, data: { gradoId, materiaId, clase, respuestas: r.claves } },
      ];
      // Si cambió "mostrar nota", actualizar lo que ven los alumnos en sus resultados
      if (act && (act.mostrarNota !== false) !== modelo.mostrarNota) {
        const res = await store.list('resultados', [['clase', '==', clase], ['actividadId', '==', id]]);
        for (const x of res) ops.push({ op: 'update', col: 'resultados', id: x.id, data: { visibleAlumno: modelo.mostrarNota } });
      }
      await store.lote(ops);
      registrar(act ? 'Editó actividad' : 'Creó actividad', datos.titulo, S.yo);
      sucio = false;
      aviso(modelo.publicada ? 'Actividad guardada y publicada ✔' : 'Actividad guardada (oculta) ✔', 'ok');
      navegar(volver);
    } catch (err) { aviso(mensajeError(err), 'error'); btn.disabled = false; btn.textContent = '💾 Guardar actividad'; }
  }
}
