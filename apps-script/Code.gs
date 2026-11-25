/* =====================================================================
 *  CESL DIGITAL — "Servidor" en Google Apps Script (gratuito)
 *
 *  Hace lo que el navegador no puede hacer por seguridad:
 *   1. Subir archivos a Google Drive, organizados por grado / materia / tema.
 *   2. Restablecer contraseñas de alumnos sin correo, y bloquear cuentas.
 *   3. Calificar al instante (el alumno nunca recibe las respuestas correctas).
 *   4. Calificar cada 5 minutos lo que quede pendiente.
 *   5. Guardar una copia de seguridad diaria en Google Drive.
 *
 *  INSTALACIÓN: siga el "Manual de instalación", paso 6.
 *  Solo hay que llenar las DOS líneas de abajo.
 * ===================================================================== */

var CONFIG = {
  PROYECTO: 'PEGUE-AQUI-EL-projectId',      // ejemplo: cesl-digital-12345
  API_KEY: 'PEGUE-AQUI-LA-apiKey'           // ejemplo: AIzaSy...
};

var VERSION = 'CESL Apps Script 1.2';
var CARPETA_RAIZ = 'CESL Digital';
var COLECCIONES = ['config', 'grados', 'materias', 'usuarios', 'temas', 'recursos', 'actividades', 'claves', 'entregas', 'resultados', 'bitacora', 'practica', 'juegos'];

// ------------------------------------------------------------------ Entrada web
function doPost(e) {
  try {
    var datos = JSON.parse(e.postData.contents);
    var accion = datos.accion;
    if (accion === 'estado') return responder({ ok: true, version: VERSION, proyecto: CONFIG.PROYECTO });
    if (accion === 'diagnostico') return responder(diagnostico(datos.token));
    var quien = verificarToken(datos.token);           // ¿quién llama? (token de Firebase)
    var perfil = leerDoc('usuarios/' + quien);
    if (!perfil) throw error('permission-denied', 'El servidor no encontró su perfil en la base de datos del proyecto "' + CONFIG.PROYECTO + '". Revise que PROYECTO en Code.gs sea exactamente el ID del proyecto de Firebase (Configuración → Probar conexión).');
    if (perfil.activo !== true) throw error('permission-denied', 'Su cuenta está desactivada.');
    switch (accion) {
      case 'calificar': return responder(calificarEntrega(datos.entregaId, quien, perfil));
      case 'subirArchivo': exigir(perfil.rol === 'admin' || perfil.rol === 'docente'); return responder(subirArchivo(datos));
      case 'restablecerClave': exigir(perfil.rol === 'admin'); return responder(restablecerClave(datos.uid, datos.clave));
      case 'estadoCuenta': exigir(perfil.rol === 'admin'); return responder(estadoCuenta(datos.uid, datos.activa));
      case 'borrarCuenta': exigir(perfil.rol === 'admin'); return responder(borrarCuenta(datos.uid));
      case 'recuperarCuenta': exigir(perfil.rol === 'admin'); return responder(recuperarCuenta(datos.email, datos.clave));
      case 'respaldar': exigir(perfil.rol === 'admin'); return responder(respaldar());
      default: throw error('accion', 'Acción desconocida.');
    }
  } catch (err) {
    console.error(err);
    return responder({ ok: false, codigo: err.codigo || 'servidor', error: err.mensaje || String(err.message || err) });
  }
}
function doGet() { return responder({ ok: true, version: VERSION, mensaje: 'El servidor de CESL Digital está funcionando.' }); }

function responder(obj) {
  if (obj.ok === undefined) obj.ok = true;
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function error(codigo, mensaje) { var e = new Error(mensaje); e.codigo = codigo; e.mensaje = mensaje; return e; }
function exigir(cond) { if (!cond) throw error('permission-denied', 'No tiene permiso para esta acción.'); }

/** Comprueba con Google que el token de inicio de sesión es auténtico y vigente. Devuelve el uid. */
function verificarToken(token) {
  if (!token) throw error('permission-denied', 'Debe iniciar sesión.');
  var r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + CONFIG.API_KEY, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: token }), muteHttpExceptions: true
  });
  var j = JSON.parse(r.getContentText());
  if (r.getResponseCode() !== 200 || !j.users || !j.users.length) {
    var motivo = (j.error && j.error.message) || '';
    if (/API_KEY|API key/i.test(motivo)) throw error('servidor', 'El API_KEY escrito en Code.gs no es válido. Cópielo de nuevo desde Firebase.');
    throw error('permission-denied', 'Sesión no válida (' + (motivo || 'sin detalle') + '). Cierre sesión y vuelva a entrar. Si sigue, revise API_KEY y PROYECTO en Code.gs.');
  }
  if (j.users[0].disabled) throw error('auth/user-disabled', 'Cuenta desactivada.');
  return j.users[0].localId;
}

// ------------------------------------------------------------------ Firestore (con permisos del propietario)
function urlDoc(ruta) { return 'https://firestore.googleapis.com/v1/projects/' + CONFIG.PROYECTO + '/databases/(default)/documents/' + ruta; }
function cabeceras() { return { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Goog-User-Project': CONFIG.PROYECTO }; }
function pedir(url, opciones) {
  opciones = opciones || {};
  opciones.headers = cabeceras(); opciones.muteHttpExceptions = true;
  if (opciones.payload && typeof opciones.payload !== 'string') { opciones.payload = JSON.stringify(opciones.payload); opciones.contentType = 'application/json'; }
  var r = UrlFetchApp.fetch(url, opciones);
  var c = r.getResponseCode();
  if (c === 404) return null;
  if (c >= 300) throw error('servidor', 'Error ' + c + ': ' + r.getContentText().slice(0, 300));
  var t = r.getContentText();
  return t ? JSON.parse(t) : {};
}
function aFs(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(aFs) } };
  var f = {}; Object.keys(v).forEach(function (k) { if (v[k] !== undefined) f[k] = aFs(v[k]); });
  return { mapValue: { fields: f } };
}
function deFs(v) {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return new Date(v.timestampValue).getTime();
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(deFs);
  if ('mapValue' in v) return campos(v.mapValue.fields || {});
  if ('referenceValue' in v) return v.referenceValue;
  return null;
}
function campos(f) { var o = {}; Object.keys(f || {}).forEach(function (k) { o[k] = deFs(f[k]); }); return o; }
function leerDoc(ruta) { var d = pedir(urlDoc(ruta)); return d ? campos(d.fields) : null; }
function escribirDoc(ruta, obj) { var f = aFs(obj).mapValue.fields; return pedir(urlDoc(ruta), { method: 'patch', payload: { fields: f } }); }
function actualizarCampos(ruta, obj) {
  var q = Object.keys(obj).map(function (k) { return 'updateMask.fieldPaths=' + encodeURIComponent(k); }).join('&');
  return pedir(urlDoc(ruta) + '?' + q, { method: 'patch', payload: { fields: aFs(obj).mapValue.fields } });
}
function consultar(coleccion, campo, valor) {
  var r = pedir('https://firestore.googleapis.com/v1/projects/' + CONFIG.PROYECTO + '/databases/(default)/documents:runQuery', {
    method: 'post', payload: { structuredQuery: { from: [{ collectionId: coleccion }], where: { fieldFilter: { field: { fieldPath: campo }, op: 'EQUAL', value: aFs(valor) } }, limit: 200 } }
  }) || [];
  return r.filter(function (x) { return x.document; }).map(function (x) { var n = x.document.name.split('/'); var o = campos(x.document.fields); o.id = n[n.length - 1]; return o; });
}
function listarColeccion(col) {
  var salida = {}; var token = '';
  do {
    var r = pedir(urlDoc(col) + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : '')) || {};
    (r.documents || []).forEach(function (d) { var n = d.name.split('/'); salida[n[n.length - 1]] = campos(d.fields); });
    token = r.nextPageToken || '';
  } while (token);
  return salida;
}

// ------------------------------------------------------------------ Calificación
function calificarEntrega(entregaId, quien, perfil) {
  var e = leerDoc('entregas/' + entregaId);
  if (!e) throw error('not-found', 'No se encontró la entrega.');
  var autorizado = e.alumnoId === quien || perfil.rol === 'admin' || (perfil.rol === 'docente' && (perfil.clases || []).indexOf(e.clase) >= 0);
  exigir(autorizado);
  return { ok: true, estado: guardarResultado(entregaId, e, 'sistema') };
}
function guardarResultado(entregaId, e, por) {
  var act = leerDoc('actividades/' + e.actividadId);
  if (!act) throw error('not-found', 'La actividad ya no existe.');
  var clave = leerDoc('claves/' + e.actividadId);
  var r = construirResultado(e, act, clave, por, new Date());
  escribirDoc('resultados/' + entregaId, r);
  actualizarCampos('entregas/' + entregaId, { estado: r.estado });
  return r.estado;
}
/** Se ejecuta cada 5 minutos: califica cualquier entrega que haya quedado pendiente. */
function calificarPendientes() {
  var lista = consultar('entregas', 'estado', 'pendiente');
  lista.forEach(function (e) { try { guardarResultado(e.id, e, 'sistema'); } catch (err) { console.error('Entrega ' + e.id + ': ' + err); } });
  return lista.length;
}

// ------------------------------------------------------------------ Cuentas
function urlCuentas(accion) { return 'https://identitytoolkit.googleapis.com/v1/projects/' + CONFIG.PROYECTO + '/accounts' + accion; }
function restablecerClave(uid, clave) {
  if (!uid || !clave || String(clave).length < 6) throw error('auth/weak-password', 'La contraseña debe tener al menos 6 caracteres.');
  pedir(urlCuentas(':update'), { method: 'post', payload: { localId: uid, password: String(clave) } });
  return { ok: true };
}
function estadoCuenta(uid, activa) { pedir(urlCuentas(':update'), { method: 'post', payload: { localId: uid, disableUser: !activa } }); return { ok: true }; }
function borrarCuenta(uid) { pedir(urlCuentas(':delete'), { method: 'post', payload: { localId: uid } }); return { ok: true }; }
/** Reutiliza una cuenta de acceso que quedó sin perfil (por ejemplo, de un usuario eliminado). */
function recuperarCuenta(email, clave) {
  if (!email || !clave || String(clave).length < 6) throw error('auth/weak-password', 'La contraseña debe tener al menos 6 caracteres.');
  var r = pedir(urlCuentas(':lookup'), { method: 'post', payload: { email: [String(email).toLowerCase()] } }) || {};
  if (!r.users || !r.users.length) throw error('not-found', 'No existe una cuenta de acceso con ese usuario.');
  var uid = r.users[0].localId;
  var perfil = leerDoc('usuarios/' + uid);
  if (perfil) throw error('auth/email-already-in-use', 'Ese usuario ya pertenece a ' + perfil.nombre + '. Elija otro usuario.');
  pedir(urlCuentas(':update'), { method: 'post', payload: { localId: uid, password: String(clave), disableUser: false } });
  return { ok: true, uid: uid };
}

/** Revisa paso a paso que el servidor esté bien configurado (botón "Probar conexión"). */
function diagnostico(token) {
  var pasos = [];
  function paso(nombre, fn, ayuda) {
    try { var d = fn(); pasos.push({ nombre: nombre, ok: true, detalle: d || '' }); return true; }
    catch (e) { pasos.push({ nombre: nombre, ok: false, detalle: (e.mensaje || String(e.message || e)) + (ayuda ? ' → ' + ayuda : '') }); return false; }
  }
  var uid = null;
  var listo = paso('Datos en Code.gs', function () {
    if (CONFIG.PROYECTO.indexOf('PEGUE') === 0 || CONFIG.API_KEY.indexOf('PEGUE') === 0) throw new Error('Faltan PROYECTO o API_KEY');
    return 'Proyecto: ' + CONFIG.PROYECTO;
  }, 'Escriba el ID del proyecto y el apiKey al inicio de Code.gs y vuelva a implementar (Nueva versión).');
  if (listo) paso('Verificar la sesión (API_KEY)', function () { uid = verificarToken(token); return 'Correcto'; }, 'Revise que API_KEY sea igual al apiKey de config.js.');
  if (listo) paso('Leer la base de datos (PROYECTO)', function () {
    var d = leerDoc('config/institucion');
    if (!d) throw new Error('No se encontró la configuración institucional en el proyecto "' + CONFIG.PROYECTO + '"');
    return d.nombrePlataforma || 'Correcto';
  }, 'Revise que PROYECTO sea exactamente el ID del proyecto (Firebase → Configuración del proyecto).');
  if (uid) paso('Encontrar su perfil', function () { var p = leerDoc('usuarios/' + uid); if (!p) throw new Error('No se encontró'); return p.nombre + ' (' + p.rol + ')'; }, 'Revise PROYECTO en Code.gs.');
  if (uid) paso('Administrar cuentas (restablecer, desactivar, borrar)', function () {
    var r = pedir(urlCuentas(':lookup'), { method: 'post', payload: { localId: [uid] } });
    if (!r || !r.users) throw new Error('Sin respuesta');
    return 'Correcto';
  }, 'Use la misma cuenta de Google dueña del proyecto de Firebase. Si dice "API no habilitada": Apps Script → Configuración → Proyecto de Google Cloud → Cambiar proyecto → número del proyecto de Firebase.');
  paso('Google Drive', function () { return 'Carpeta "' + carpetaRaiz().getName() + '"'; }, 'Ejecute la función instalar y acepte los permisos.');
  return { ok: true, version: VERSION, pasos: pasos };
}

// ------------------------------------------------------------------ Google Drive
function carpeta(padre, nombre) {
  var it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}
function carpetaRaiz() { return carpeta(DriveApp.getRootFolder(), CARPETA_RAIZ); }
function limpiarNombre(t) { return String(t || 'General').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80); }
function subirArchivo(d) {
  if (!d.base64 || !d.nombre) throw error('archivo', 'No se recibió el archivo.');
  var bytes = Utilities.base64Decode(d.base64);
  if (bytes.length > 20 * 1024 * 1024) throw error('archivo', 'El archivo pesa más de 20 MB.');
  var destino = carpeta(carpeta(carpeta(carpeta(carpetaRaiz(), 'Materiales'), limpiarNombre(d.grado)), limpiarNombre(d.materia)), limpiarNombre(d.tema));
  var archivo = destino.createFile(Utilities.newBlob(bytes, d.mime || 'application/octet-stream', limpiarNombre(d.nombre)));
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: 'https://drive.google.com/file/d/' + archivo.getId() + '/view', id: archivo.getId() };
}

// ------------------------------------------------------------------ Copias de seguridad
function respaldar() {
  var datos = {};
  COLECCIONES.forEach(function (c) { datos[c] = listarColeccion(c); });
  var copia = { app: 'CESL Digital', version: 1, fecha: new Date().toISOString(), modo: 'firebase', datos: datos };
  var dir = carpeta(carpetaRaiz(), 'Respaldos');
  var nombre = 'cesl-respaldo-' + Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd-HHmm') + '.json';
  dir.createFile(nombre, JSON.stringify(copia), 'application/json');
  // conservar solo las 30 copias más recientes
  var archivos = []; var it = dir.getFiles();
  while (it.hasNext()) archivos.push(it.next());
  archivos.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  archivos.slice(30).forEach(function (f) { f.setTrashed(true); });
  return { ok: true, archivo: nombre };
}
function respaldoDiario() { respaldar(); }

// ------------------------------------------------------------------ Instalación (ejecutar UNA vez desde el editor)
function instalar() {
  if (CONFIG.PROYECTO.indexOf('PEGUE') === 0 || CONFIG.API_KEY.indexOf('PEGUE') === 0) throw new Error('Primero llene PROYECTO y API_KEY al inicio del archivo.');
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('calificarPendientes').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('respaldoDiario').timeBased().everyDays(1).atHour(22).create();
  carpeta(carpetaRaiz(), 'Materiales'); carpeta(carpetaRaiz(), 'Respaldos');
  var prueba = leerDoc('config/institucion');
  Logger.log(prueba ? '✔ Conexión con Firestore correcta: ' + prueba.nombrePlataforma : '⚠ Conectado, pero aún no existe la configuración institucional (haga primero la configuración inicial en la app).');
  Logger.log('✔ Tareas automáticas creadas: calificación cada 5 minutos y copia diaria a las 22:00.');
}

// =====================================================================
//  Calificación automática — copia EXACTA de js/calificar.js (no editar aquí)
// =====================================================================
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

