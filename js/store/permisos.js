// =====================================================================
//  Permisos de CESL Digital — copia fiel de firebase/firestore.rules.
//  En modo "firebase" quien decide es el SERVIDOR (las reglas de Firestore).
//  En modo "demo" se usa este archivo para comportarse igual.
//  Si cambia una regla, cambie las dos.
// =====================================================================

export const ID_SEP = '__';
export const idEntrega = (actividadId, uid, intento) => `${actividadId}${ID_SEP}${uid}${ID_SEP}${intento}`;
export const claseDe = (gradoId, materiaId) => `${gradoId}${ID_SEP}${materiaId}`;

const activo = (yo) => !!yo && yo.activo === true;
const esAdmin = (yo) => activo(yo) && yo.rol === 'admin';
const esDocente = (yo) => activo(yo) && yo.rol === 'docente';
const esAlumno = (yo) => activo(yo) && yo.rol === 'alumno';
const tieneClase = (yo, d) => esDocente(yo) && !!d && Array.isArray(yo.clases) && yo.clases.includes(d.clase);
const claseCoherente = (d) => !!d && d.clase === claseDe(d.gradoId, d.materiaId);
const soloCambian = (antes, despues, campos) => {
  const llaves = new Set([...Object.keys(antes || {}), ...Object.keys(despues || {})]);
  for (const k of llaves) if (!campos.includes(k) && JSON.stringify(antes?.[k]) !== JSON.stringify(despues?.[k])) return false;
  return true;
};

/**
 * ¿Puede leer este documento?
 * ctx = { uid, yo (perfil del usuario o null), get(col,id) síncrono, ahora }
 */
export function puedeLeer(col, id, d, ctx) {
  const { uid, yo } = ctx;
  if (!uid) return col === 'config';
  switch (col) {
    case 'config': return true;
    case 'grados': case 'materias': return activo(yo);
    case 'usuarios':
      return id === uid || esAdmin(yo) ||
        (esDocente(yo) && d.rol === 'alumno' && (yo.grados || []).includes(d.gradoId));
    case 'temas': case 'recursos':
      return esAdmin(yo) || tieneClase(yo, d) || (esAlumno(yo) && d.gradoId === yo.gradoId && d.visible === true);
    case 'actividades':
      return esAdmin(yo) || tieneClase(yo, d) || (esAlumno(yo) && d.gradoId === yo.gradoId && d.publicada === true);
    case 'claves': {
      if (esAdmin(yo) || tieneClase(yo, d)) return true;
      if (!esAlumno(yo)) return false;
      const act = ctx.get('actividades', id);
      return !!act && act.gradoId === yo.gradoId && act.publicada === true && act.mostrarRespuestas === true &&
        !!ctx.get('entregas', idEntrega(id, uid, act.intentos));
    }
    case 'entregas': return d.alumnoId === uid || esAdmin(yo) || tieneClase(yo, d);
    case 'resultados': return esAdmin(yo) || tieneClase(yo, d) || (d.alumnoId === uid && d.visibleAlumno === true);
    case 'bitacora': return esAdmin(yo);
    case 'practica': return id === uid || esAdmin(yo);
    case 'juegos': return activo(yo);
    default: return false;
  }
}

/** ¿Puede crear / modificar / borrar? op: 'crear' | 'actualizar' | 'borrar' */
export function puedeEscribir(op, col, id, antes, despues, ctx) {
  const { uid, yo } = ctx;
  if (!uid) return false;
  switch (col) {
    case 'config':
      if (id === 'sistema' && op === 'crear' && !antes) return ctx.despuesYo?.rol === 'admin'; // configuración inicial
      return esAdmin(yo) && id !== 'sistema';
    case 'grados': case 'materias': return esAdmin(yo);
    case 'usuarios':
      if (esAdmin(yo)) return !(op === 'borrar' && id === uid);
      if (op === 'crear' && id === uid && !ctx.get('config', 'sistema') && despues?.rol === 'admin' && despues?.activo === true) return true;
      // El propio usuario solo puede marcar que ya cambió su contraseña.
      return op === 'actualizar' && id === uid && activo(antes) && soloCambian(antes, despues, ['debeCambiarPassword', 'ultimoAcceso']) &&
        despues.debeCambiarPassword !== true;
    case 'temas': case 'recursos': case 'actividades': case 'claves':
      if (esAdmin(yo)) return op === 'borrar' || claseCoherente(despues);
      if (op === 'crear') return tieneClase(yo, despues) && claseCoherente(despues);
      if (op === 'actualizar') return tieneClase(yo, antes) && tieneClase(yo, despues) && claseCoherente(despues);
      return tieneClase(yo, antes);
    case 'entregas': {
      if (op === 'crear') {
        if (!esAlumno(yo) || !despues) return false;
        const partes = id.split(ID_SEP);
        if (partes.length !== 3 || partes[1] !== uid) return false;
        const act = ctx.get('actividades', partes[0]);
        const n = Number(partes[2]);
        const permitidos = ['actividadId', 'alumnoId', 'alumnoNombre', 'gradoId', 'seccion', 'materiaId', 'temaId', 'clase', 'intento', 'respuestas', 'enviada', 'estado'];
        return !!act && act.publicada === true && act.gradoId === yo.gradoId &&
          despues.actividadId === partes[0] && despues.alumnoId === uid && despues.gradoId === yo.gradoId &&
          despues.clase === act.clase && despues.intento === n && Number.isInteger(n) && n >= 1 && n <= act.intentos &&
          despues.estado === 'pendiente' && despues.enviada === ctx.ahora &&
          (!act.fechaLimite || ctx.ahora <= act.fechaLimite) &&
          Object.keys(despues).every((k) => permitidos.includes(k));
      }
      if (op === 'actualizar') return (esAdmin(yo) || tieneClase(yo, antes)) && soloCambian(antes, despues, ['estado']);
      return esAdmin(yo) || tieneClase(yo, antes);
    }
    case 'resultados':
      if (esAdmin(yo)) return true;
      if (op === 'borrar') return tieneClase(yo, antes);
      return tieneClase(yo, despues) && (op === 'crear' || tieneClase(yo, antes));
    case 'bitacora':
      return op === 'crear' && (esAdmin(yo) || esDocente(yo)) && despues?.actorId === uid && despues?.fecha === ctx.ahora;
    case 'practica':
      return id === uid && esAlumno(yo) && op !== 'borrar';
    case 'juegos': {
      // Administración: todo. Docentes: solo juegos de materias que imparten.
      if (esAdmin(yo)) return true;
      const suya = (d) => esDocente(yo) && !!d && (yo.materias || []).includes(d.materiaId);
      if (op === 'crear') return suya(despues);
      if (op === 'actualizar') return suya(antes) && suya(despues);
      return suya(antes);
    }
    default: return false;
  }
}
