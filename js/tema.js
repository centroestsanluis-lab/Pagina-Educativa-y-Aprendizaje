// Aplica la identidad institucional (colores, imágenes, textos) guardada por el administrador.
import { INSTITUCION_BASE } from './semilla.js';
import { urlImagen } from './drive.js';

export let inst = { ...INSTITUCION_BASE };

export function aplicarTema(datos) {
  inst = { ...INSTITUCION_BASE, ...(datos || {}) };
  inst.colores = { ...INSTITUCION_BASE.colores, ...(datos?.colores || {}) };
  inst.titulos = { ...INSTITUCION_BASE.titulos, ...(datos?.titulos || {}) };
  inst.iconos = { ...INSTITUCION_BASE.iconos, ...(datos?.iconos || {}) };
  const r = document.documentElement.style;
  for (const [k, v] of Object.entries(inst.colores)) if (/^#[0-9a-f]{3,8}$/i.test(v)) r.setProperty('--' + k, v);
  r.setProperty('--fondo-img', inst.fondo ? `url("${urlImagen(inst.fondo).replace(/"/g, '')}")` : 'none');
  document.title = inst.nombrePlataforma || 'CESL Digital';
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = inst.colores.marino;
  return inst;
}
export const logo = () => urlImagen(inst.logo) || 'img/logo.webp';
export const mascota = () => urlImagen(inst.mascota) || 'img/lu.webp';
export const mascotaChica = () => urlImagen(inst.mascota) || 'img/lu-sm.webp';
export function mensajeLU() {
  const m = inst.mensajesLU?.length ? inst.mensajesLU : INSTITUCION_BASE.mensajesLU;
  return m[Math.floor(Math.random() * m.length)];
}
/** Nombre de la plataforma separado para pintarlo en dos colores: "CESL" + "Digital". */
export function partesMarca() {
  const n = inst.nombrePlataforma || 'CESL Digital';
  const i = n.lastIndexOf(' ');
  return i > 0 ? [n.slice(0, i), n.slice(i + 1)] : [n, ''];
}
