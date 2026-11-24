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

var VERSION = 'CESL Apps Script 1.0';
var CARPETA_RAIZ = 'CESL Digital';
var COLECCIONES = ['config', 'grados', 'materias', 'usuarios', 'temas', 'recursos', 'actividades', 'claves', 'entregas', 'resultados', 'bitacora', 'practica'];

// ------------------------------------------------------------------ Entrada web
function doPost(e) {
  try {
    var datos = JSON.parse(e.postData.contents);
    var accion = datos.accion;
    if (accion === 'estado') return responder({ ok: true, version: VERSION, proyecto: CONFIG.PROYECTO });
    var quien = verificarToken(datos.token);           // ¿quién llama? (token de Firebase)
    var perfil = leerDoc('usuarios/' + quien);
    if (!perfil || perfil.activo !== true) throw error('permission-denied', 'Cuenta no activa.');
    switch (accion) {
      case 'calificar': return responder(calificarEntrega(datos.entregaId, quien, perfil));
      case 'subirArchivo': exigir(perfil.rol === 'admin' || perfil.rol === 'docente'); return responder(subirArchivo(datos));
      case 'restablecerClave': exigir(perfil.rol === 'admin'); return responder(restablecerClave(datos.uid, datos.clave));
      case 'estadoCuenta': exigir(perfil.rol === 'admin'); return responder(estadoCuenta(datos.uid, datos.activa));
      case 'borrarCuenta': exigir(perfil.rol === 'admin'); return responder(borrarCuenta(datos.uid));
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
  if (r.getResponseCode() !== 200 || !j.users || !j.users.length) throw error('permission-denied', 'Sesión no válida. Vuelva a iniciar sesión.');
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
//@@CALIFICAR@@
