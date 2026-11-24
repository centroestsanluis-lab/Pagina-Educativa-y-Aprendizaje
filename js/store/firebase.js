// =====================================================================
//  Modo REAL: Firebase Authentication + Cloud Firestore (plan gratuito).
//  Los permisos los hace cumplir el servidor con firebase/firestore.rules.
// =====================================================================
import * as fb from '../../vendor/firebase.js';
import { ErrorCesl, id as nuevoId } from '../ui.js';
import { llamarServidor, servidorConfigurado } from '../drive.js';

export const AHORA = { __ahora: true };
let app, auth, db, appSecundaria, authSecundaria;

function aFirestore(v) {
  if (v === AHORA) return fb.serverTimestamp();
  if (v && v.__borrar) return fb.deleteField();
  if (v instanceof Date) return fb.Timestamp.fromDate(v);
  if (Array.isArray(v)) return v.map(aFirestore);
  if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = aFirestore(x); return o; }
  return v;
}
function deFirestore(v) {
  if (v instanceof fb.Timestamp) return v.toMillis();
  if (Array.isArray(v)) return v.map(deFirestore);
  if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = deFirestore(x); return o; }
  return v;
}
const ref = (col, id) => fb.doc(db, col, id);

function traducir(e) {
  if (e?.code && !String(e.code).startsWith('auth/')) e.code = String(e.code).replace('firestore/', '');
  return e;
}
async function envolver(promesa) { try { return await promesa; } catch (e) { throw traducir(e); } }

export const firebase = {
  modo: 'firebase',
  AHORA,
  BORRAR: { __borrar: true },

  async iniciar(config) {
    if (!config?.firebase?.apiKey || !config.firebase.projectId) {
      throw new ErrorCesl('config', 'Falta pegar los datos de Firebase en config.js (Manual de instalación, paso 4).');
    }
    app = fb.initializeApp(config.firebase);
    auth = fb.getAuth(app);
    db = fb.initializeFirestore(app, { ignoreUndefinedProperties: true });
    if (config.emuladores) { // solo para pruebas técnicas
      fb.connectAuthEmulator(auth, config.emuladores.auth, { disableWarnings: true });
      if (config.emuladores.firestore) fb.connectFirestoreEmulator(db, ...config.emuladores.firestore);
    }
    // La sesión se guarda en el dispositivo; el cierre por inactividad lo hace app.js
    await fb.setPersistence(auth, fb.browserLocalPersistence);
    this._config = config;
  },

  auth: {
    uid: () => auth.currentUser?.uid || null,
    alCambiar: (cb) => fb.onAuthStateChanged(auth, (u) => cb(u ? u.uid : null)),
    entrar: (email, clave) => envolver(fb.signInWithEmailAndPassword(auth, email, clave)),
    salir: () => fb.signOut(auth),
    async cambiarClave(actual, nueva) {
      const u = auth.currentUser;
      const cred = fb.EmailAuthProvider.credential(u.email, actual);
      await envolver(fb.reauthenticateWithCredential(u, cred));
      await envolver(fb.updatePassword(u, nueva));
    },
    recuperar: (email) => envolver(fb.sendPasswordResetEmail(auth, email)),
    token: () => auth.currentUser?.getIdToken(),
  },

  admin: {
    /**
     * Crea la cuenta de acceso SIN cerrar la sesión del administrador:
     * se usa una segunda conexión de Firebase solo para este paso.
     */
    async crearCuenta(email, clave) {
      if (!appSecundaria) {
        appSecundaria = fb.initializeApp(firebase._config.firebase, 'creador-de-cuentas');
        authSecundaria = fb.getAuth(appSecundaria);
        if (firebase._config.emuladores) fb.connectAuthEmulator(authSecundaria, firebase._config.emuladores.auth, { disableWarnings: true });
        await fb.setPersistence(authSecundaria, fb.browserSessionPersistence);
      }
      const cred = await envolver(fb.createUserWithEmailAndPassword(authSecundaria, email, clave));
      const uid = cred.user.uid;
      await fb.signOut(authSecundaria);
      return uid;
    },
    /** Requiere el "servidor" de Apps Script (Firebase no permite hacerlo desde el navegador). */
    async restablecerClave(uid, nueva) {
      if (!servidorConfigurado()) throw new ErrorCesl('sin-servidor', 'Para restablecer contraseñas falta conectar Google Apps Script (Manual de instalación, paso 7).');
      await llamarServidor('restablecerClave', { uid, clave: nueva });
    },
    async estadoCuenta(uid, activa) {
      // El bloqueo principal lo hacen las reglas (campo "activo"); si hay servidor, también se bloquea el inicio de sesión.
      if (servidorConfigurado()) await llamarServidor('estadoCuenta', { uid, activa });
    },
    async borrarCuenta(uid) { if (servidorConfigurado()) await llamarServidor('borrarCuenta', { uid }); },
    servidorDisponible: () => servidorConfigurado(),
  },

  async get(col, id) {
    const s = await envolver(fb.getDoc(ref(col, id)));
    return s.exists() ? { id: s.id, ...deFirestore(s.data()) } : null;
  },
  async list(col, filtros = []) {
    const q = fb.query(fb.collection(db, col), ...filtros.map(([c, op, v]) => fb.where(c, op, aFirestore(v))));
    const s = await envolver(fb.getDocs(q));
    return s.docs.map((d) => ({ id: d.id, ...deFirestore(d.data()) }));
  },
  set: (col, id, data, { merge = false } = {}) => envolver(fb.setDoc(ref(col, id), aFirestore(data), { merge })),
  async add(col, data) { const i = nuevoId(); await envolver(fb.setDoc(ref(col, i), aFirestore(data))); return i; },
  update: (col, id, data) => envolver(fb.updateDoc(ref(col, id), aFirestore(data))),
  del: (col, id) => envolver(fb.deleteDoc(ref(col, id))),
  async lote(ops) {
    // Firestore admite hasta 500 operaciones por lote
    for (let i = 0; i < ops.length; i += 450) {
      const b = fb.writeBatch(db);
      for (const o of ops.slice(i, i + 450)) {
        if (o.op === 'set') b.set(ref(o.col, o.id), aFirestore(o.data), { merge: !!o.merge });
        else if (o.op === 'update') b.update(ref(o.col, o.id), aFirestore(o.data));
        else if (o.op === 'del') b.delete(ref(o.col, o.id));
      }
      await envolver(b.commit());
    }
  },
  nuevoId,
  /** Pide al servidor de Apps Script que califique al instante. Devuelve false si no hay servidor. */
  async calificarServidor(entregaId) {
    if (!servidorConfigurado()) return false;
    await llamarServidor('calificar', { entregaId });
    return true;
  },
  async exportar(colecciones) {
    const salida = {};
    for (const c of colecciones) salida[c] = Object.fromEntries((await this.list(c)).map(({ id, ...d }) => [id, d]));
    return salida;
  },
};
