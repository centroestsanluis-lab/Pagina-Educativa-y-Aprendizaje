// =====================================================================
//  Calificación automática de CESL Digital.
//  Este mismo código se copia dentro de Google Apps Script (apps-script/Code.gs)
//  para que la nota se calcule igual en la tablet del docente y en el servidor.
//  No usa nada propio del navegador.
// =====================================================================

/** Texto sin tildes, sin mayúsculas, sin signos al final y con espacios simples. */
function normalizarRespuesta(t) {
  return String(t === null || t === undefined ? '' : t)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[¿?¡!.,;:"']/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Convierte "3,5", " 12 ", "1 000" en número. Devuelve NaN si no es número. */
function leerNumero(v) {
  if (typeof v === 'number') return v;
  const s = String(v === null || v === undefined ? '' : v).trim().replace(/\s/g, '').replace(',', '.');
  if (s === '' || !/^-?\d*\.?\d+$/.test(s)) return NaN;
  return Number(s);
}

function redondear(n) { return Math.round(n * 100) / 100; }

/** Tipos que el sistema califica solo. "abierta" siempre queda para revisión del docente. */
const TIPOS_AUTOMATICOS = ['opcion', 'vf', 'completar', 'relacionar', 'ordenar', 'corta', 'numerica'];

/**
 * Califica una entrega.
 * @param preguntas  lista pública de la actividad (sin respuestas)
 * @param claves     objeto { idPregunta: clave } guardado aparte (solo docentes)
 * @param respuestas objeto { idPregunta: respuesta del alumno }
 * @returns { puntaje, puntajeMax, detalle, pendientes, estado }
 */
function calificar(preguntas, claves, respuestas) {
  const detalle = {};
  const pendientes = [];
  let puntaje = 0; let puntajeMax = 0;
  claves = claves || {}; respuestas = respuestas || {};

  for (const p of preguntas || []) {
    const max = Number(p.puntos) > 0 ? Number(p.puntos) : 1;
    puntajeMax += max;
    const clave = claves[p.id] || {};
    const r = respuestas[p.id];
    let fraccion = 0; let correcta = false;

    switch (p.tipo) {
      case 'opcion':
        correcta = r !== undefined && r !== null && Number(r) === Number(clave.correcta);
        fraccion = correcta ? 1 : 0; break;

      case 'vf':
        correcta = (r === true || r === false) && r === clave.correcta;
        fraccion = correcta ? 1 : 0; break;

      case 'completar': {
        const huecos = clave.huecos || [];
        const dadas = Array.isArray(r) ? r : [];
        let bien = 0;
        huecos.forEach((aceptadas, i) => {
          const lista = (Array.isArray(aceptadas) ? aceptadas : [aceptadas]).map(normalizarRespuesta);
          if (lista.includes(normalizarRespuesta(dadas[i]))) bien++;
        });
        fraccion = huecos.length ? bien / huecos.length : 0;
        correcta = huecos.length > 0 && bien === huecos.length; break;
      }

      case 'relacionar': {
        const pares = clave.pares || [];
        const dadas = Array.isArray(r) ? r : [];
        let bien = 0;
        pares.forEach((der, i) => { if (dadas[i] !== undefined && dadas[i] !== null && Number(dadas[i]) === Number(der)) bien++; });
        fraccion = pares.length ? bien / pares.length : 0;
        correcta = pares.length > 0 && bien === pares.length; break;
      }

      case 'ordenar': {
        const orden = clave.orden || [];
        const dadas = Array.isArray(r) ? r.map(Number) : [];
        correcta = orden.length > 0 && dadas.length === orden.length && orden.every((v, i) => Number(v) === dadas[i]);
        fraccion = correcta ? 1 : 0; break;
      }

      case 'corta': {
        const aceptadas = (clave.aceptadas || []).map(normalizarRespuesta).filter(Boolean);
        correcta = aceptadas.length > 0 && aceptadas.includes(normalizarRespuesta(r));
        fraccion = correcta ? 1 : 0; break;
      }

      case 'numerica': {
        const n = leerNumero(r); const v = leerNumero(clave.valor);
        const tol = Math.abs(leerNumero(clave.tolerancia)) || 0;
        correcta = !isNaN(n) && !isNaN(v) && Math.abs(n - v) <= tol + 1e-9;
        fraccion = correcta ? 1 : 0; break;
      }

      default: // "abierta" u otro tipo: lo revisa el docente
        pendientes.push(p.id);
        detalle[p.id] = { puntos: 0, max: max, correcta: null, pendiente: true };
        continue;
    }
    const puntos = redondear(max * fraccion);
    puntaje += puntos;
    detalle[p.id] = { puntos: puntos, max: max, correcta: correcta };
  }

  return {
    puntaje: redondear(puntaje),
    puntajeMax: redondear(puntajeMax),
    detalle: detalle,
    pendientes: pendientes,
    estado: pendientes.length ? 'revision' : 'calificada'
  };
}

/** Aplica la revisión manual del docente: { idPregunta: puntos } */
function aplicarRevision(resultado, puntosManuales) {
  const detalle = JSON.parse(JSON.stringify(resultado.detalle || {}));
  let puntaje = 0;
  for (const pid of Object.keys(detalle)) {
    const d = detalle[pid];
    if (puntosManuales && Object.prototype.hasOwnProperty.call(puntosManuales, pid)) {
      const v = Math.max(0, Math.min(Number(puntosManuales[pid]) || 0, d.max));
      d.puntos = redondear(v); d.correcta = v >= d.max; d.pendiente = false; d.revisadoPorDocente = true;
    }
    puntaje += d.puntos;
  }
  const pendientes = Object.keys(detalle).filter((k) => detalle[k].pendiente);
  return { ...resultado, detalle, puntaje: redondear(puntaje), pendientes, estado: pendientes.length ? 'revision' : 'calificada' };
}

/** Arma el documento "resultado" a partir de la entrega, la actividad y su clave. */
function construirResultado(entrega, actividad, clave, calificadoPor, ahora) {
  const r = calificar(actividad.preguntas, (clave && clave.respuestas) || {}, entrega.respuestas);
  return {
    actividadId: entrega.actividadId, alumnoId: entrega.alumnoId, alumnoNombre: entrega.alumnoNombre || '',
    gradoId: actividad.gradoId, seccion: entrega.seccion || '', materiaId: actividad.materiaId, temaId: actividad.temaId || '',
    clase: actividad.clase, intento: entrega.intento, titulo: actividad.titulo,
    puntaje: r.puntaje, puntajeMax: r.puntajeMax, detalle: r.detalle, pendientes: r.pendientes, estado: r.estado,
    visibleAlumno: actividad.mostrarNota === true, calificado: ahora, calificadoPor: calificadoPor || 'sistema'
  };
}

export { calificar, aplicarRevision, construirResultado, normalizarRespuesta, leerNumero, TIPOS_AUTOMATICOS };
