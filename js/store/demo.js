// =====================================================================
//  Modo DEMOSTRACIÓN: guarda todo en este dispositivo (localStorage).
//  Se comporta igual que Firebase, incluidos los permisos, para que la
//  plataforma pueda probarse y practicarse sin configurar nada.
// =====================================================================
import { puedeLeer, puedeEscribir } from './permisos.js';
import { ErrorCesl, id as nuevoId } from '../ui.js';
import { datosDemo } from '../semilla.js';
import { construirResultado } from '../calificar.js';

const LLAVE = 'cesl-demo-v3';
const LLAVE_SESION = 'cesl-demo-sesion-v3';
const LLAVE_INTENTOS = 'cesl-demo-intentos';
export const AHORA = { __ahora: true };

let bd = null;
let oyentes = [];
let uidActual = null;

function guardar() { try { localStorage.setItem(LLAVE, JSON.stringify(bd)); } catch (e) { console.warn('No se pudo guardar', e); } }
function leerLS(k, defecto) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : defecto; } catch { return defecto; } }
function escribirLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } }

async function hash(texto) {
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cesl:' + texto));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0; for (const c of 'cesl:' + texto) h = (h * 31 + c.charCodeAt(0)) | 0; return 'x' + h; // respaldo sin cifrado nativo
}

const copiar = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
function convertir(v, ahora) {
  if (v === AHORA) return ahora;
  if (v instanceof Date) return v.getTime();
  if (Array.isArray(v)) return v.map((x) => convertir(x, ahora));
  if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = convertir(x, ahora); return o; }
  return v;
}

function ctx(ahora, extra = {}) {
  const yo = uidActual ? bd.datos.usuarios?.[uidActual] || null : null;
  return { uid: uidActual, yo, ahora, get: (c, i) => bd.datos[c]?.[i] || null, ...extra };
}
const denegado = () => new ErrorCesl('permission-denied');

function cumple(d, [campo, op, valor]) {
  const v = d[campo];
  switch (op) {
    case '==': return v === valor;
    case '!=': return v !== valor;
    case 'in': return valor.includes(v);
    case 'array-contains': return Array.isArray(v) && v.includes(valor);
    case '<=': return v <= valor; case '>=': return v >= valor; case '<': return v < valor; case '>': return v > valor;
    default: throw new Error('Operador no soportado: ' + op);
  }
}

function escribir(op, col, id, data, { merge = false } = {}, ahora = Date.now()) {
  bd.datos[col] ||= {};
  const antes = bd.datos[col][id] || null;
  let despues = null;
  if (op === 'set') despues = merge && antes ? { ...antes, ...convertir(data, ahora) } : convertir(data, ahora);
  if (op === 'update') { if (!antes) throw new ErrorCesl('not-found'); despues = { ...antes, ...convertir(data, ahora) }; }
  if (despues) for (const k of Object.keys(despues)) if (despues[k] && despues[k].__borrar) delete despues[k];
  const tipo = op === 'del' ? 'borrar' : antes ? 'actualizar' : 'crear';
  const c = ctx(ahora);
  if (col === 'config' && id === 'sistema') c.despuesYo = bd.datos.usuarios?.[uidActual];
  if (!puedeEscribir(tipo, col, id, antes, despues, c)) throw denegado();
  if (op === 'del') delete bd.datos[col][id]; else bd.datos[col][id] = despues;
}

export const demo = {
  modo: 'demo',
  AHORA,
  BORRAR: { __borrar: true },

  async iniciar() {
    bd = leerLS(LLAVE, null);
    if (!bd || !bd.datos) { bd = await datosDemo(hash); guardar(); }
    const s = leerLS(LLAVE_SESION, null);
    uidActual = s && bd.cuentas[s.email] && !bd.cuentas[s.email].desactivada ? bd.cuentas[s.email].uid : null;
  },
  async reiniciarDemo() { localStorage.removeItem(LLAVE); localStorage.removeItem(LLAVE_SESION); bd = null; await this.iniciar(); },

  auth: {
    uid: () => uidActual,
    alCambiar(cb) { oyentes.push(cb); setTimeout(() => cb(uidActual), 0); return () => { oyentes = oyentes.filter((o) => o !== cb); }; },
    async entrar(email, clave) {
      email = email.toLowerCase();
      // Bloqueo temporal tras 5 intentos fallidos (Firebase hace lo mismo en el servidor)
      const intentos = leerLS(LLAVE_INTENTOS, {});
      const reg = intentos[email] || { n: 0, hasta: 0 };
      if (reg.hasta > Date.now()) throw new ErrorCesl('auth/too-many-requests');
      const cuenta = bd.cuentas[email];
      if (!cuenta || cuenta.hash !== await hash(clave)) {
        reg.n += 1; if (reg.n >= 5) { reg.hasta = Date.now() + 5 * 60 * 1000; reg.n = 0; }
        intentos[email] = reg; escribirLS(LLAVE_INTENTOS, intentos);
        throw new ErrorCesl('auth/invalid-credential');
      }
      if (cuenta.desactivada) throw new ErrorCesl('auth/user-disabled');
      delete intentos[email]; escribirLS(LLAVE_INTENTOS, intentos);
      uidActual = cuenta.uid; escribirLS(LLAVE_SESION, { email });
      oyentes.forEach((o) => o(uidActual));
    },
    async salir() { uidActual = null; localStorage.removeItem(LLAVE_SESION); oyentes.forEach((o) => o(null)); },
    async cambiarClave(actual, nueva) {
      const email = Object.keys(bd.cuentas).find((e) => bd.cuentas[e].uid === uidActual);
      if (!email || bd.cuentas[email].hash !== await hash(actual)) throw new ErrorCesl('auth/invalid-credential');
      if (String(nueva).length < 6) throw new ErrorCesl('auth/weak-password');
      bd.cuentas[email].hash = await hash(nueva); guardar();
    },
    async recuperar() { return true; }, // En la demostración no se envían correos
  },

  admin: {
    /** Crea la cuenta de acceso (no el perfil). Devuelve uid. */
    async crearCuenta(email, clave) {
      email = email.toLowerCase();
      if (!ctx().yo || ctx().yo.rol !== 'admin') throw denegado();
      if (bd.cuentas[email]) throw new ErrorCesl('auth/email-already-in-use');
      if (String(clave).length < 6) throw new ErrorCesl('auth/weak-password');
      const uid = 'u' + nuevoId();
      bd.cuentas[email] = { uid, hash: await hash(clave), desactivada: false }; guardar();
      return uid;
    },
    async restablecerClave(uid, nueva) {
      if (ctx().yo?.rol !== 'admin') throw denegado();
      const email = Object.keys(bd.cuentas).find((e) => bd.cuentas[e].uid === uid);
      if (!email) throw new ErrorCesl('not-found');
      bd.cuentas[email].hash = await hash(nueva); guardar();
    },
    async estadoCuenta(uid, activa) {
      if (ctx().yo?.rol !== 'admin') throw denegado();
      const email = Object.keys(bd.cuentas).find((e) => bd.cuentas[e].uid === uid);
      if (email) { bd.cuentas[email].desactivada = !activa; guardar(); }
    },
    async borrarCuenta(uid) {
      if (ctx().yo?.rol !== 'admin') throw denegado();
      const email = Object.keys(bd.cuentas).find((e) => bd.cuentas[e].uid === uid);
      if (email) { delete bd.cuentas[email]; guardar(); }
    },
    async recuperarCuenta(email, clave) {
      if (ctx().yo?.rol !== 'admin') throw denegado();
      const c = bd.cuentas[email.toLowerCase()];
      if (!c) throw new ErrorCesl('not-found', 'No existe una cuenta de acceso con ese usuario.');
      if (bd.datos.usuarios?.[c.uid]) throw new ErrorCesl('auth/email-already-in-use');
      c.hash = await hash(clave); c.desactivada = false; guardar();
      return c.uid;
    },
    async diagnostico() { return { version: 'demostración', pasos: [{ nombre: 'Modo demostración', ok: true, detalle: 'No usa servidor' }] }; },
    servidorDisponible: () => true,
  },

  async get(col, id) {
    const d = bd.datos[col]?.[id];
    if (!d) {
      // Firestore también exige permiso para saber que algo NO existe
      if (!uidActual && col !== 'config') throw denegado();
      return null;
    }
    if (!puedeLeer(col, id, d, ctx(Date.now()))) throw denegado();
    return { id, ...copiar(d) };
  },
  async list(col, filtros = []) {
    const c = ctx(Date.now());
    // Igual que Firestore: la consulta se juzga por sus filtros, aunque no traiga resultados.
    const virtual = Object.fromEntries(filtros.filter(([, op]) => op === '==').map(([k, , v]) => [k, v]));
    if (!puedeLeer(col, '', virtual, c)) throw denegado();
    const res = [];
    for (const [id, d] of Object.entries(bd.datos[col] || {})) {
      if (!filtros.every((f) => cumple(d, f))) continue;
      // Igual que Firestore: si la consulta podría traer algo prohibido, se rechaza completa.
      if (!puedeLeer(col, id, d, c)) throw denegado();
      res.push({ id, ...copiar(d) });
    }
    return res;
  },
  async set(col, id, data, opciones) { escribir('set', col, id, data, opciones); guardar(); },
  async add(col, data) { const i = nuevoId(); escribir('set', col, i, data); guardar(); return i; },
  async update(col, id, data) { escribir('update', col, id, data); guardar(); },
  async del(col, id) { escribir('del', col, id); guardar(); },
  /** Varias escrituras juntas: si una falla, no se aplica ninguna. */
  async lote(ops) {
    const respaldo = JSON.stringify(bd.datos);
    const ahora = Date.now();
    try { for (const o of ops) escribir(o.op, o.col, o.id, o.data, o, ahora); }
    catch (e) { bd.datos = JSON.parse(respaldo); throw e; }
    guardar();
  },
  nuevoId,

  /**
   * Simula el "servidor" (Google Apps Script) que califica al instante.
   * Lee la clave con permisos de servidor: el alumno nunca la recibe.
   */
  async calificarServidor(entregaId) {
    const e = bd.datos.entregas?.[entregaId];
    if (!e || e.alumnoId !== uidActual) throw denegado();
    const act = bd.datos.actividades[e.actividadId]; const clave = bd.datos.claves[e.actividadId];
    if (!act) throw new ErrorCesl('not-found');
    bd.datos.resultados ||= {};
    bd.datos.resultados[entregaId] = construirResultado(e, act, clave, 'sistema', Date.now());
    e.estado = bd.datos.resultados[entregaId].estado; guardar();
    return true;
  },

  /** Exporta toda la base (para copias de seguridad). */
  async exportar(colecciones) {
    const salida = {};
    for (const c of colecciones) salida[c] = Object.fromEntries((await this.list(c)).map(({ id, ...d }) => [id, d]));
    return salida;
  },
};
