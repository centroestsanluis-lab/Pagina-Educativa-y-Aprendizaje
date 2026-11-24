// Google Drive, YouTube y conexión con Google Apps Script.
import { ErrorCesl } from './ui.js';

const cfg = () => window.CESL_CONFIG || {};
export const servidorConfigurado = () => cfg().modo === 'firebase' && /^https:\/\/script\.google\.com\//.test(cfg().appsScriptUrl || '');

let obtenerToken = null;
export function registrarToken(fn) { obtenerToken = fn; }

/**
 * Llama al "servidor" de Apps Script. Se envía como text/plain para que el
 * navegador no exija permisos extra (CORS) y Apps Script lo acepte.
 */
export async function llamarServidor(accion, datos = {}) {
  if (!servidorConfigurado()) throw new ErrorCesl('sin-servidor', 'El servidor de Google Apps Script no está conectado.');
  const token = obtenerToken ? await obtenerToken() : null;
  let r;
  try {
    r = await fetch(cfg().appsScriptUrl, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ accion, token, ...datos }),
    });
  } catch { throw new ErrorCesl('auth/network-request-failed'); }
  let j;
  try { j = await r.json(); } catch { throw new ErrorCesl('servidor', 'El servidor de Apps Script no respondió correctamente. Revise que esté publicado para "Cualquier usuario".'); }
  if (!j.ok) throw new ErrorCesl(j.codigo || 'servidor', j.error || 'Error en el servidor.');
  return j;
}

/** Extrae el identificador de archivo de cualquier enlace de Google Drive / Docs. */
export function idDrive(url) {
  const s = String(url || '');
  const m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/) || s.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  return m ? m[1] : null;
}
export function idYoutube(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
/** Dirección para mostrar el material DENTRO de la plataforma (sin navegar a otros sitios). */
export function urlVista(recurso) {
  const u = recurso.url || '';
  if (u.startsWith('data:')) return u;
  const yt = idYoutube(u);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1`;
  const d = idDrive(u);
  if (d) {
    if (/docs\.google\.com\/(document|presentation|spreadsheets)/.test(u)) {
      const tipo = u.match(/docs\.google\.com\/(document|presentation|spreadsheets)/)[1];
      return `https://docs.google.com/${tipo}/d/${d}/preview`;
    }
    if (recurso.tipo === 'imagen') return `https://drive.google.com/thumbnail?id=${d}&sz=w1600`;
    return `https://drive.google.com/file/d/${d}/preview`;
  }
  return u;
}
export function urlImagen(u) {
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('img/')) return u;
  const d = idDrive(u);
  return d ? `https://drive.google.com/thumbnail?id=${d}&sz=w1200` : u;
}
export function urlDescarga(u) { const d = idDrive(u); return d && !/docs\.google\.com/.test(u) ? `https://drive.google.com/uc?export=download&id=${d}` : u; }
export function esUrlSegura(u) { return /^https:\/\//.test(u || '') || /^data:(image|application\/pdf)/.test(u || ''); }

/** Adivina el tipo de material por el enlace o el archivo. */
export function tipoPorEnlace(u, mime = '') {
  if (idYoutube(u) || /^video\//.test(mime)) return 'video';
  if (/^image\//.test(mime) || /\.(png|jpe?g|webp|gif)$/i.test(u)) return 'imagen';
  if (/pdf/.test(mime) || /\.pdf$/i.test(u)) return 'pdf';
  if (/presentation|powerpoint/.test(mime + u)) return 'presentacion';
  if (/document|word|spreadsheet|excel/.test(mime + u)) return 'documento';
  if (idDrive(u)) return 'documento';
  return 'enlace';
}
export const TIPOS_RECURSO = {
  pdf: { nombre: 'PDF', icono: '📕', color: 'var(--rojo)' },
  imagen: { nombre: 'Imagen', icono: '🖼️', color: 'var(--celeste)' },
  documento: { nombre: 'Documento', icono: '📄', color: 'var(--azul)' },
  presentacion: { nombre: 'Presentación', icono: '📊', color: 'var(--naranja)' },
  video: { nombre: 'Video', icono: '🎬', color: 'var(--morado)' },
  enlace: { nombre: 'Enlace educativo', icono: '🔗', color: 'var(--verde)' },
};
