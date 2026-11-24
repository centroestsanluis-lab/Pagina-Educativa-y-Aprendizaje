// Punto único de acceso a los datos. Elige el modo según config.js.
import { registrarToken } from '../drive.js';

export let store = null;

export async function iniciarStore() {
  const config = window.CESL_CONFIG || { modo: 'demo' };
  if (config.modo === 'firebase') {
    const { firebase } = await import('./firebase.js');
    await firebase.iniciar(config);
    registrarToken(() => firebase.auth.token());
    store = firebase;
  } else {
    const { demo } = await import('./demo.js');
    await demo.iniciar();
    store = demo;
  }
  return store;
}

/** Convierte "ana.lopez" en el correo interno; deja igual los correos reales. */
export function correoDeUsuario(usuario) {
  const u = String(usuario || '').trim().toLowerCase();
  if (u.includes('@')) return u;
  const dom = window.CESL_CONFIG?.dominioUsuarios || 'alumnos.cesl.local';
  return `${u}@${dom}`;
}
export function esCorreoReal(email) {
  const dom = window.CESL_CONFIG?.dominioUsuarios || 'alumnos.cesl.local';
  return !!email && email.includes('@') && !email.endsWith('@' + dom);
}

/** Registra un cambio importante en la bitácora (no detiene el trabajo si falla). */
export async function registrar(accion, detalle = '', yo) {
  try {
    await store.add('bitacora', { actorId: store.auth.uid(), actorNombre: yo?.nombre || '', rol: yo?.rol || '', accion, detalle: String(detalle).slice(0, 500), fecha: store.AHORA });
  } catch (e) { console.warn('Bitácora:', e); }
}
