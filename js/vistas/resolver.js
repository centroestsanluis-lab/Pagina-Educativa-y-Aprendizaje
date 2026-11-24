// El alumno resuelve una actividad; también sirve para la vista previa del docente.
import { h, vaciar, aviso, confirmar, fecha, nota100, vacio, mensajeError, cargando } from '../ui.js';
import { store } from '../store/index.js';
import { idEntrega } from '../store/permisos.js';
import { mascota, mensajeLU } from '../tema.js';
import { S, navegar, materia } from '../app.js';
import { miga } from './comun.js';
import { urlImagen } from '../drive.js';

export const TIPOS = {
  opcion: { nombre: 'Selección múltiple', icono: '🔘' },
  vf: { nombre: 'Verdadero o falso', icono: '✅' },
  completar: { nombre: 'Completar espacios', icono: '✏️' },
  relacionar: { nombre: 'Relacionar columnas', icono: '🔗' },
  ordenar: { nombre: 'Ordenar elementos', icono: '🔢' },
  corta: { nombre: 'Respuesta corta', icono: '💬' },
  numerica: { nombre: 'Ejercicio numérico', icono: '🧮' },
  abierta: { nombre: 'Respuesta abierta (la revisa el docente)', icono: '📝' },
};
const LETRAS = 'ABCDEFGH';

/**
 * Dibuja una pregunta. valor = respuesta actual; cambiar(v) guarda la respuesta.
 * revision = { detalle, clave } para mostrar si estuvo bien y la respuesta correcta.
 */
export function pregunta(p, num, valor, cambiar, revision) {
  const bloqueado = !!revision;
  const caja = h('div', { class: 'pregunta', 'data-pregunta': p.id },
    h('span', { class: 'num-preg' }, `Pregunta ${num}`), ' ',
    h('span', { class: 'texto-suave chico' }, `${p.puntos || 1} punto(s)`),
    h('div', { class: 'enunciado' }, p.enunciado || ''),
    p.imagen ? h('img', { class: 'apoyo', src: urlImagen(p.imagen), alt: '' }) : null);
  const redibujar = () => { const nueva = pregunta(p, num, valor, cambiar, revision); caja.replaceWith(nueva); };
  const fijar = (v) => { valor = v; cambiar(v); redibujar(); };

  switch (p.tipo) {
    case 'opcion':
      caja.append(h('div', { class: 'opciones' }, (p.opciones || []).map((o, i) => {
        let cls = 'opcion' + (valor === i ? ' sel' : '');
        if (revision?.clave) { if (i === revision.clave.correcta) cls += ' bien'; else if (valor === i) cls += ' mal'; }
        return h('button', { type: 'button', class: cls, disabled: bloqueado, 'aria-pressed': String(valor === i), onclick: () => fijar(i) },
          h('span', { class: 'letra' }, LETRAS[i]), o);
      })));
      break;
    case 'vf':
      caja.append(h('div', { class: 'opciones' }, [[true, '✔ Verdadero'], [false, '✖ Falso']].map(([v, t]) => {
        let cls = 'opcion' + (valor === v ? ' sel' : '');
        if (revision?.clave) { if (v === revision.clave.correcta) cls += ' bien'; else if (valor === v) cls += ' mal'; }
        return h('button', { type: 'button', class: cls, disabled: bloqueado, 'aria-pressed': String(valor === v), onclick: () => fijar(v), style: { justifyContent: 'center' } }, t);
      })));
      break;
    case 'completar': {
      const trozos = String(p.texto || '').split('___');
      const vals = Array.isArray(valor) ? valor.slice() : [];
      caja.append(h('div', { style: { fontSize: '1.2rem', lineHeight: '2.4' } }, trozos.map((t, i) => [
        t,
        i < trozos.length - 1 ? h('input', { type: 'text', class: 'hueco', value: vals[i] || '', disabled: bloqueado, autocapitalize: 'none', 'aria-label': `Espacio ${i + 1}`,
          oninput: (e) => { vals[i] = e.target.value; valor = vals.slice(); cambiar(valor); } }) : null,
      ])));
      if (revision?.clave) caja.append(h('div', { class: 'retro bien' }, 'Respuestas: ', (revision.clave.huecos || []).map((x) => (Array.isArray(x) ? x[0] : x)).join(' · ')));
      break;
    }
    case 'relacionar': {
      const vals = Array.isArray(valor) ? valor.slice() : [];
      caja.append(h('p', { class: 'texto-suave' }, 'Elige la pareja de cada elemento.'),
        (p.izquierda || []).map((iz, i) => h('div', { class: 'relacion' },
          h('div', { class: 'izq' }, iz), h('span', null, '➜'),
          h('select', { disabled: bloqueado, 'aria-label': `Pareja de ${iz}`, onchange: (e) => { vals[i] = e.target.value === '' ? null : Number(e.target.value); valor = vals.slice(); cambiar(valor); } },
            h('option', { value: '' }, 'Elegir…'),
            (p.derecha || []).map((de, j) => h('option', { value: j, selected: vals[i] === j }, de))))));
      if (revision?.clave) caja.append(h('div', { class: 'retro bien' }, 'Parejas correctas: ', (p.izquierda || []).map((iz, i) => `${iz} ➜ ${p.derecha[revision.clave.pares[i]]}`).join(' · ')));
      break;
    }
    case 'ordenar': {
      const orden = Array.isArray(valor) ? valor.slice() : [];
      const libres = (p.elementos || []).map((e, i) => i).filter((i) => !orden.includes(i));
      caja.append(h('p', { class: 'texto-suave' }, 'Toca los elementos en el orden correcto. Toca uno colocado para quitarlo.'),
        h('div', { class: 'fichas', 'aria-label': 'Tu orden' }, orden.length ? orden.map((i, k) => h('button', { type: 'button', class: 'ficha colocada', disabled: bloqueado,
          onclick: () => fijar(orden.filter((_, x) => x !== k)) }, `${k + 1}. ${p.elementos[i]}`)) : h('span', { class: 'texto-suave' }, 'Aquí aparecerá tu orden')),
        h('div', { class: 'fichas', style: { marginTop: '10px', borderStyle: 'solid' } }, libres.map((i) => h('button', { type: 'button', class: 'ficha', disabled: bloqueado,
          onclick: () => fijar([...orden, i]) }, p.elementos[i]))));
      if (revision?.clave) caja.append(h('div', { class: 'retro bien' }, 'Orden correcto: ', (revision.clave.orden || []).map((i) => p.elementos[i]).join(' → ')));
      break;
    }
    case 'corta':
      caja.append(h('input', { type: 'text', value: valor || '', disabled: bloqueado, placeholder: 'Escribe tu respuesta', oninput: (e) => { valor = e.target.value; cambiar(valor); } }));
      if (revision?.clave?.aceptadas) caja.append(h('div', { class: 'retro bien' }, 'Respuesta esperada: ', revision.clave.aceptadas[0]));
      break;
    case 'numerica':
      caja.append(h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', maxWidth: '360px' } },
        h('input', { type: 'text', inputmode: 'decimal', value: valor ?? '', disabled: bloqueado, placeholder: 'Tu número', style: { fontSize: '1.4rem', fontWeight: 900 },
          oninput: (e) => { valor = e.target.value; cambiar(valor); } }), p.unidad ? h('b', null, p.unidad) : null));
      if (revision?.clave && revision.clave.valor !== undefined) caja.append(h('div', { class: 'retro bien' }, 'Respuesta correcta: ', String(revision.clave.valor), p.unidad ? ' ' + p.unidad : ''));
      break;
    case 'abierta':
      caja.append(h('textarea', { disabled: bloqueado, placeholder: 'Escribe aquí tu respuesta', oninput: (e) => { valor = e.target.value; cambiar(valor); } }, valor || ''));
      break;
    default: caja.append(h('p', null, 'Tipo de pregunta desconocido.'));
  }
  if (revision?.detalle) {
    const d = revision.detalle;
    if (d.pendiente) caja.append(h('div', { class: 'retro', style: { background: '#E3F2FD', color: 'var(--marino)' } }, '⏳ Tu maestra o maestro revisará esta respuesta.'));
    else caja.append(h('div', { class: 'retro ' + (d.correcta ? 'bien' : 'mal') }, d.correcta ? `✔ ¡Correcto! (${d.puntos}/${d.max})` : `✖ ${d.puntos}/${d.max} puntos`));
  }
  if (revision?.clave?.explicacion) caja.append(h('div', { class: 'retro', style: { background: '#FFFDE7' } }, '💡 ', revision.clave.explicacion));
  return caja;
}

export function respondida(p, v) {
  if (v === undefined || v === null || v === '') return false;
  if (p.tipo === 'completar') return Array.isArray(v) && v.some((x) => String(x || '').trim());
  if (p.tipo === 'relacionar') return Array.isArray(v) && v.some((x) => x !== null && x !== undefined);
  if (p.tipo === 'ordenar') return Array.isArray(v) && v.length > 0;
  return true;
}

// ---------------------------------------------------------------------
export async function renderResolver(cont, actividadId, alTerminar) {
  cargando(cont);
  let act, entregas, resultados;
  try {
    [act, entregas, resultados] = await Promise.all([
      store.get('actividades', actividadId),
      store.list('entregas', [['alumnoId', '==', S.uid], ['actividadId', '==', actividadId]]),
      store.list('resultados', [['alumnoId', '==', S.uid], ['visibleAlumno', '==', true], ['actividadId', '==', actividadId]]),
    ]);
  } catch (e) { vaciar(cont).append(vacio(mensajeError(e))); return; }
  vaciar(cont);
  if (!act) { cont.append(vacio('Esta actividad ya no está disponible.')); return; }
  const m = materia(act.materiaId);
  cont.append(miga([['Mis tareas', '/tareas'], [m.nombre, '/materia/' + m.id], [act.titulo]]));
  const usados = entregas.length;
  const intentos = act.intentos || 1;
  const cerrada = act.fechaLimite && act.fechaLimite < Date.now();
  const puede = !cerrada && usados < intentos && (!act.fechaPublicacion || act.fechaPublicacion <= Date.now());

  const ultimoRes = resultados.sort((a, b) => b.intento - a.intento)[0];
  const portada = h('div', { class: 'tarjeta' },
    h('h1', null, act.titulo),
    h('p', { class: 'texto-suave' }, `${m.icono || ''} ${m.nombre}`, act.fechaLimite ? ` · Fecha límite: ${fecha(act.fechaLimite)}` : '', ` · Intentos: ${usados} de ${intentos}`),
    act.imagen ? h('img', { src: urlImagen(act.imagen), alt: '', style: { maxHeight: '240px', borderRadius: '16px', display: 'block', margin: '0 auto 12px' } }) : null,
    act.instrucciones ? h('div', { class: 'mensaje-info', style: { fontSize: '1.1rem' } }, '📌 ', act.instrucciones) : null,
    ultimoRes ? h('p', null, h('b', null, 'Tu última nota: '), `${nota100(ultimoRes.puntaje, ultimoRes.puntajeMax)} (${ultimoRes.puntaje}/${ultimoRes.puntajeMax} puntos)`, ultimoRes.estado === 'revision' ? ' — falta revisión del docente' : '') : null,
    h('div', { class: 'fila-botones' },
      puede ? h('button', { class: 'btn verde grande', onclick: () => resolver(cont, act, usados + 1, alTerminar) }, usados ? '🔁 Intentar de nuevo' : '▶ Empezar') : null,
      usados ? h('button', { class: 'btn claro', onclick: () => verRevision(cont, act, entregas.sort((a, b) => b.intento - a.intento)[0], ultimoRes) }, '👀 Ver mis respuestas') : null),
    !puede ? h('p', { class: 'texto-suave', style: { marginTop: '10px' } }, cerrada ? 'La fecha de entrega ya pasó.' : usados >= intentos ? 'Ya usaste todos tus intentos.' : 'Aún no está disponible.') : null);
  cont.append(portada);
}

function resolver(cont, act, intento, alTerminar) {
  vaciar(cont);
  const resp = {};
  const total = act.preguntas.length;
  const barraProg = h('div', null);
  const actualizar = () => { const n = act.preguntas.filter((p) => respondida(p, resp[p.id])).length; barraProg.style.width = (n / total) * 100 + '%'; };
  const boton = h('button', { class: 'btn verde grande', onclick: async () => {
    const faltan = act.preguntas.filter((p) => !respondida(p, resp[p.id])).length;
    if (faltan && !(await confirmar(`Te faltan ${faltan} pregunta(s) por responder. ¿Quieres entregar de todas formas?`, { si: 'Sí, entregar', clase: 'verde', titulo: '¿Entregar?' }))) return;
    if (!faltan && !(await confirmar('¿Ya revisaste tus respuestas? Al entregar ya no podrás cambiarlas.', { si: 'Entregar', clase: 'verde', titulo: '¿Entregar?' }))) return;
    boton.disabled = true; boton.textContent = 'Enviando…';
    try { await entregar(cont, act, intento, resp); alTerminar?.(); } catch (e) { aviso(mensajeError(e), 'error'); boton.disabled = false; boton.textContent = '📨 Entregar'; }
  } }, '📨 Entregar');
  cont.append(
    h('div', { class: 'tarjeta', style: { position: 'sticky', top: '66px', zIndex: 5 } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '8px' } },
        h('b', null, act.titulo), h('span', { class: 'texto-suave chico' }, `Intento ${intento} de ${act.intentos || 1}`)),
      h('div', { class: 'progreso' }, barraProg)),
    act.preguntas.map((p, i) => pregunta(p, i + 1, undefined, (v) => { resp[p.id] = v; actualizar(); })),
    h('div', { class: 'fila-botones', style: { justifyContent: 'center', margin: '20px 0' } },
      h('button', { class: 'btn claro', onclick: async () => { if (await confirmar('Si sales ahora se perderán tus respuestas.', { si: 'Salir', titulo: '¿Salir sin entregar?' })) navegar('/tareas'); } }, 'Salir'),
      boton));
  actualizar();
}

async function entregar(cont, act, intento, resp) {
  const id = idEntrega(act.id, S.uid, intento);
  const limpias = {};
  for (const p of act.preguntas) if (resp[p.id] !== undefined) limpias[p.id] = resp[p.id];
  await store.set('entregas', id, {
    actividadId: act.id, alumnoId: S.uid, alumnoNombre: S.yo.nombre, gradoId: S.yo.gradoId, seccion: S.yo.seccion || '',
    materiaId: act.materiaId, temaId: act.temaId || '', clase: act.clase, intento, respuestas: limpias, enviada: store.AHORA, estado: 'pendiente',
  });
  let calificada = false;
  try { calificada = await store.calificarServidor(id); } catch (e) { console.warn('Calificación inmediata no disponible:', e); }
  let res = null;
  if (calificada && act.mostrarNota) { try { res = await store.get('resultados', id); } catch { res = null; } }
  vaciar(cont);
  const n = res ? nota100(res.puntaje, res.puntajeMax) : null;
  cont.append(h('div', { class: 'tarjeta celebracion' },
    h('img', { src: mascota(), alt: 'LU' }),
    h('h1', null, '¡Entregado! 🎉'),
    res ? [h('div', { class: 'nota' }, n), h('div', { class: 'estrellas' }, n >= 90 ? '⭐⭐⭐' : n >= 70 ? '⭐⭐' : n >= 50 ? '⭐' : '💪'),
      h('p', null, `Obtuviste ${res.puntaje} de ${res.puntajeMax} puntos.`),
      res.estado === 'revision' ? h('p', { class: 'mensaje-info' }, 'Algunas respuestas las revisará tu maestra o maestro; tu nota puede subir.') : null]
      : h('p', { style: { fontSize: '1.2rem' } }, 'Tu maestra o maestro revisará tu trabajo. ¡Pronto verás tu nota!'),
    h('div', { class: 'burbuja', style: { display: 'inline-block', margin: '10px 0 20px' } }, mensajeLU()),
    h('div', { class: 'fila-botones', style: { justifyContent: 'center' } },
      h('button', { class: 'btn', onclick: () => navegar('/tareas') }, '📝 Volver a mis tareas'),
      res && act.mostrarRespuestas ? h('button', { class: 'btn claro', onclick: () => verRevision(cont, act, { respuestas: limpias, intento }, res) }, '👀 Ver correcciones') : null)));
}

async function verRevision(cont, act, entrega, res) {
  let clave = null;
  if (act.mostrarRespuestas && res) { try { clave = (await store.get('claves', act.id))?.respuestas || null; } catch { clave = null; } }
  vaciar(cont);
  cont.append(miga([['Mis tareas', '/tareas'], [act.titulo, '/actividad/' + act.id], ['Mis respuestas']]),
    h('div', { class: 'tarjeta' }, h('h1', null, 'Mis respuestas'),
      res ? h('p', null, h('b', null, 'Nota: '), `${nota100(res.puntaje, res.puntajeMax)} (${res.puntaje}/${res.puntajeMax})`) : h('p', { class: 'texto-suave' }, 'Tu nota aparecerá cuando tu maestra o maestro la publique.'),
      !clave && res ? h('p', { class: 'texto-suave chico' }, act.mostrarRespuestas ? 'Las respuestas correctas se muestran cuando terminas todos tus intentos.' : '') : null),
    act.preguntas.map((p, i) => pregunta(p, i + 1, entrega.respuestas?.[p.id], () => {}, { detalle: res?.detalle?.[p.id], clave: clave?.[p.id] })),
    h('div', { class: 'fila-botones', style: { justifyContent: 'center' } }, h('button', { class: 'btn', onclick: () => navegar('/tareas') }, 'Volver')));
}
