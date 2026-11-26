// =====================================================================
//  Paquetes de juegos listos para instalar (uno por materia).
//  Al instalarlos se convierten en juegos normales de la colección "juegos":
//  la escuela los puede editar, ocultar, borrar… y recuperar con el botón
//  del paquete si algún día se borran.
//  Matemáticas no es un paquete: sus juegos se generan solos (infinitas combinaciones).
// =====================================================================
import { PALABRAS_EMOJI, FORMAR_PALABRAS, ORACIONES, TIPOS_PALABRA, VOCABULARIO, LECTURAS, CIENCIAS, DEPARTAMENTOS, GUATEMALA } from './bancos.js';
import { PAQUETE_INGLES } from './personalizados.js';

const sinTilde = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const preguntas = (banco) => banco.map((x) => ({ p: x.p, r: x.r, o: x.o.slice(0, 3), e: x.e || '', n: x.n.slice() }));

// --- Comunicación y Lenguaje ---
const ABC = 'ABCDEFGHIJLMNOPRSTUVZ';
const letras = PALABRAS_EMOJI.map(([pal, emoji], i) => {
  const ini = sinTilde(pal[0]).toUpperCase();
  const otras = ABC.split('').filter((l) => l !== ini);
  return { p: '¿Con qué letra empieza esta palabra?', r: ini, o: [otras[i % otras.length], otras[(i * 7 + 3) % otras.length], otras[(i * 11 + 5) % otras.length]].filter((v, k, a) => a.indexOf(v) === k), e: emoji, n: [1, 2] };
});
const emojiDe = (pal) => PALABRAS_EMOJI.find(([x]) => x === pal)?.[1] || '';
const formar = Object.entries(FORMAR_PALABRAS).flatMap(([nivel, lista]) => lista.map((pal) => ({ a: pal, e: emojiDe(pal), n: [Number(nivel), Number(nivel)] })));
const lectura = LECTURAS.flatMap((l) => l.q.map(([p, r, o]) => ({ p, r, o: o.slice(0, 3), t: l.t, e: '', n: l.n.slice() })));
const oraciones = ORACIONES.map((o) => ({ a: o.t, e: '', n: o.n.slice() }));
const TIPOS = ['sustantivo', 'verbo', 'adjetivo'];
const tipos = TIPOS_PALABRA.map(([pal, tipo, k]) => ({ p: `La palabra "${pal}" es un…`, r: tipo, o: TIPOS.filter((t) => t !== tipo && (k >= 3 || t !== 'adjetivo')), e: '', n: [k, 6] }));

export const PAQUETES = [
  {
    id: 'ingles', nombre: 'Inglés', icono: '🔤', materiaId: 'ingles',
    crearMateria: { nombre: 'Inglés', icono: '🔤', color: 'var(--morado)' },
    juegos: PAQUETE_INGLES.map(({ clave, ...j }) => ({ clave, ...j, tipo: 'vocabulario', etiquetas: { a: 'inglés', b: 'español' }, voz: 'en-US' })),
  },
  {
    id: 'lenguaje', nombre: 'Comunicación y Lenguaje', icono: '📖', materiaId: 'comunicacion',
    juegos: [
      { clave: 'letras', titulo: 'Reconocer letras', icono: '🔤', tipo: 'preguntas', elementos: letras },
      { clave: 'formar', titulo: 'Formar palabras', icono: '🧱', tipo: 'ordenar', modoOrden: 'letras', elementos: formar },
      { clave: 'lectura', titulo: 'Lectura comprensiva', icono: '📚', tipo: 'preguntas', elementos: lectura },
      { clave: 'oraciones', titulo: 'Ordenar oraciones', icono: '📝', tipo: 'ordenar', modoOrden: 'palabras', elementos: oraciones },
      { clave: 'tipos', titulo: 'Sustantivos, verbos y adjetivos', icono: '🏷️', tipo: 'preguntas', elementos: tipos },
      { clave: 'vocabulario', titulo: 'Vocabulario', icono: '💬', tipo: 'preguntas', elementos: preguntas(VOCABULARIO) },
    ],
  },
  {
    id: 'ciencias', nombre: 'Ciencias', icono: '🔬', materiaId: 'ciencias-naturales',
    juegos: [
      { clave: 'cuerpo', titulo: 'El cuerpo humano', icono: '🧍', tipo: 'preguntas', elementos: preguntas(CIENCIAS.cuerpo) },
      { clave: 'seres', titulo: 'Animales y plantas', icono: '🦋', tipo: 'preguntas', elementos: preguntas(CIENCIAS.seres) },
      { clave: 'ambiente', titulo: 'Medio ambiente', icono: '♻️', tipo: 'preguntas', elementos: preguntas(CIENCIAS.ambiente) },
      { clave: 'solar', titulo: 'Sistema solar', icono: '🪐', tipo: 'preguntas', elementos: preguntas(CIENCIAS.solar) },
      { clave: 'agua', titulo: 'Agua y naturaleza', icono: '💧', tipo: 'preguntas', elementos: preguntas(CIENCIAS.agua) },
    ],
  },
  {
    id: 'guatemala', nombre: 'Mi Guatemala', icono: '🇬🇹', materiaId: 'mi-guatemala',
    juegos: [
      { clave: 'departamentos', titulo: 'Departamentos y cabeceras', icono: '🗺️', tipo: 'vocabulario', modos: ['a2b', 'b2a'], etiquetas: { a: 'departamento', b: 'cabecera' },
        frases: { a2b: '¿Cuál es la cabecera del departamento de {a}?', b2a: '¿De qué departamento es cabecera {b}?' },
        elementos: DEPARTAMENTOS.map(([d, c]) => ({ a: d, b: c, e: '', n: [3, 6] })) },
      { clave: 'simbolos', titulo: 'Símbolos patrios', icono: '🐦', tipo: 'preguntas', elementos: preguntas(GUATEMALA.simbolos) },
      { clave: 'historia', titulo: 'Historia', icono: '🏛️', tipo: 'preguntas', elementos: preguntas(GUATEMALA.historia) },
      { clave: 'geografia', titulo: 'Geografía', icono: '🌋', tipo: 'preguntas', elementos: preguntas([...GUATEMALA.departamentos, ...GUATEMALA.geografia]) },
      { clave: 'cultura', titulo: 'Cultura y tradiciones', icono: '🪁', tipo: 'preguntas', elementos: preguntas(GUATEMALA.cultura) },
    ],
  },
];

/** Documentos listos para guardar en la colección "juegos". */
export function documentosPaquete(paquete, materiaId, autorId) {
  return paquete.juegos.map((j) => ({ ...JSON.parse(JSON.stringify(j)), paquete: paquete.id, materiaId, visible: true, autorId }));
}

/** Qué juegos del paquete ya están instalados (por su clave; los de versiones anteriores, por su nombre). */
export function estadoPaquete(paquete, juegos) {
  const norm = (t) => sinTilde(String(t || '')).toLowerCase().trim();
  const faltan = paquete.juegos.filter((j) => !juegos.some((x) => (x.paquete === paquete.id && x.clave === j.clave) || norm(x.titulo) === norm(j.titulo)));
  return { total: paquete.juegos.length, instalados: paquete.juegos.length - faltan.length, faltan };
}
