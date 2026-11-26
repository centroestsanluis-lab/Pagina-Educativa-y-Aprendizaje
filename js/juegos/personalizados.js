// =====================================================================
//  Juegos creados por la administración y los docentes (sin programar).
//  Se guardan en la colección "juegos". Dos tipos:
//   • vocabulario: una lista de palabras (palabra / traducción / dibujo)
//     con la que el sistema arma varios juegos distintos automáticamente;
//   • preguntas:   preguntas con su respuesta correcta y opciones incorrectas.
// =====================================================================
import { mezclar } from './catalogo.js';

const elegir = (l) => l[Math.floor(Math.random() * l.length)];
const enNivel = (x, n) => n >= (Number(x.n?.[0]) || 1) && n <= (Number(x.n?.[1]) || 6);
const limpio = (t) => String(t ?? '').trim();

export const MODOS = {
  a2b: { nombre: 'Traducir de la columna 1 a la 2', ejemplo: '¿Qué significa "dog"? → perro' },
  b2a: { nombre: 'Traducir de la columna 2 a la 1', ejemplo: '¿Cómo se dice "perro"? → dog' },
  emoji: { nombre: 'Adivinar la palabra por el dibujo', ejemplo: '🐶 → dog' },
  letras: { nombre: 'Ordenar las letras de la palabra', ejemplo: 'o‑d‑g → dog' },
};
export const IDIOMAS_VOZ = [['', 'Sin pronunciación'], ['en-US', 'Inglés'], ['es-ES', 'Español'], ['fr-FR', 'Francés']];

/** Elementos válidos para jugar en este nivel (si hay muy pocos, se usan todos). */
function delNivel(lista, nivel, minimo) {
  const l = lista.filter((x) => enNivel(x, nivel));
  return l.length >= minimo ? l : lista;
}

/** Cuántas preguntas tiene un juego en un nivel (para mostrarlo o no en el catálogo). */
export function disponibleEnNivel(doc, nivel) {
  return (doc.elementos || []).some((x) => enNivel(x, nivel));
}

/** Convierte un documento de la colección "juegos" en un juego que entiende el motor. */
export function construirJuego(doc) {
  const elementos = (doc.elementos || []).filter((x) => (doc.tipo === 'vocabulario' ? limpio(x.a) && limpio(x.b) : doc.tipo === 'ordenar' ? limpio(x.a) : limpio(x.p) && limpio(x.r)));
  const et1 = doc.etiquetas?.a || 'columna 1'; const et2 = doc.etiquetas?.b || 'columna 2';
  let generar;
  if (doc.tipo === 'vocabulario') {
    const modos = (doc.modos?.length ? doc.modos : ['a2b', 'b2a']).filter((m) => MODOS[m]);
    generar = (nivel, usadas) => {
      const pool = delNivel(elementos, nivel, 4);
      const libres = pool.filter((x) => !usadas.has('v:' + x.a));
      const x = elegir(libres.length ? libres : pool); usadas.add('v:' + x.a);
      const posibles = modos.filter((m) => (m !== 'emoji' || limpio(x.e)) && (m !== 'letras' || /^[^\s]{2,14}$/.test(limpio(x.a))));
      const modo = elegir(posibles.length ? posibles : ['a2b']);
      const otros = (campo) => mezclar([...new Set(elementos.map((y) => limpio(y[campo])).filter((v) => v && v.toLowerCase() !== limpio(x[campo]).toLowerCase()))]).slice(0, 3);
      const voz = doc.voz ? { texto: limpio(x.a), idioma: doc.voz } : null;
      const frase = (m, defecto) => (limpio(doc.frases?.[m]) ? limpio(doc.frases[m]).replace(/\{a\}/g, limpio(x.a)).replace(/\{b\}/g, limpio(x.b)) : defecto);
      if (modo === 'b2a') return { consigna: frase('b2a', `¿Cómo se dice "${limpio(x.b)}" en ${et1}?`), visual: x.e ? { tipo: 'emoji', valor: x.e } : null, tipo: 'opciones', opciones: mezclar([limpio(x.a), ...otros('a')]), correcta: limpio(x.a), vozRespuesta: voz };
      if (modo === 'emoji') return { consigna: `¿Qué es? Elige la palabra en ${et1}`, visual: { tipo: 'emoji', valor: x.e }, tipo: 'opciones', opciones: mezclar([limpio(x.a), ...otros('a')]), correcta: limpio(x.a), vozRespuesta: voz };
      if (modo === 'letras') {
        const letras = limpio(x.a).split('');
        let m = mezclar(letras); if (m.join('') === letras.join('')) m = m.reverse();
        return { consigna: `Ordena las letras: "${limpio(x.b)}" en ${et1}`, visual: x.e ? { tipo: 'emoji', valor: x.e } : null, tipo: 'ordenar', elementos: m, correcta: letras, juntar: '', vozRespuesta: voz };
      }
      return { consigna: frase('a2b', `¿Qué significa "${limpio(x.a)}" en ${et2}?`), visual: x.e ? { tipo: 'emoji', valor: x.e } : null, tipo: 'opciones', opciones: mezclar([limpio(x.b), ...otros('b')]), correcta: limpio(x.b), voz };
    };
  } else if (doc.tipo === 'ordenar') {
    const porLetras = doc.modoOrden === 'letras';
    generar = (nivel, usadas) => {
      const pool = delNivel(elementos, nivel, 1);
      const libres = pool.filter((x) => !usadas.has('o:' + x.a));
      const x = elegir(libres.length ? libres : pool); usadas.add('o:' + x.a);
      const partes = porLetras ? limpio(x.a).split('') : limpio(x.a).split(/\s+/);
      let m = mezclar(partes); if (m.join('|') === partes.join('|')) m = m.reverse();
      return { consigna: limpio(doc.consigna) || (porLetras ? 'Ordena las letras para formar la palabra' : 'Ordena las palabras para formar la oración'),
        visual: x.e ? { tipo: 'emoji', valor: x.e } : null, tipo: 'ordenar', elementos: m, correcta: partes, juntar: porLetras ? '' : ' ' };
    };
  } else {
    generar = (nivel, usadas) => {
      const pool = delNivel(elementos, nivel, 1);
      const k = (x) => 'p:' + x.p + (x.e || '') + (x.t || '').slice(0, 20);
      const libres = pool.filter((x) => !usadas.has(k(x)));
      const x = elegir(libres.length ? libres : pool); usadas.add(k(x));
      const malas = (x.o || []).map(limpio).filter(Boolean);
      return { consigna: limpio(x.p), visual: limpio(x.t) ? { tipo: 'lectura', valor: limpio(x.t) } : x.e ? { tipo: 'emoji', valor: x.e } : null, tipo: 'opciones', opciones: mezclar([limpio(x.r), ...malas.slice(0, 3)]), correcta: limpio(x.r) };
    };
  }
  return { id: 'c-' + doc.id, area: 'm-' + doc.materiaId, titulo: doc.titulo, icono: doc.icono || '🧩', generar, personalizado: true };
}

/** Revisa que el juego tenga lo mínimo para funcionar. Devuelve el texto del problema o null. */
export function validarJuego(doc) {
  if (!limpio(doc.titulo)) return 'Escriba el nombre del juego.';
  if (!doc.materiaId) return 'Elija la materia.';
  if (doc.tipo === 'vocabulario') {
    const ok = (doc.elementos || []).filter((x) => limpio(x.a) && limpio(x.b));
    if (ok.length < 4) return 'Escriba al menos 4 palabras completas (columna 1 y columna 2).';
    if (!doc.modos?.length) return 'Marque al menos una forma de jugar.';
    if (doc.modos.length === 1 && doc.modos[0] === 'emoji' && !ok.some((x) => limpio(x.e))) return 'Para "adivinar por el dibujo" agregue un emoji a las palabras.';
  } else if (doc.tipo === 'ordenar') {
    const ok = (doc.elementos || []).filter((x) => limpio(x.a));
    if (ok.length < 3) return 'Escriba al menos 3 palabras u oraciones para ordenar.';
    const corto = ok.find((x) => (doc.modoOrden === 'letras' ? limpio(x.a).length : limpio(x.a).split(/\s+/).length) < 2);
    if (corto) return `"${limpio(corto.a)}" es muy corta para ordenar.`;
  } else {
    const ok = (doc.elementos || []).filter((x) => limpio(x.p) && limpio(x.r));
    if (ok.length < 3) return 'Escriba al menos 3 preguntas con su respuesta correcta.';
    const sin = ok.findIndex((x) => !(x.o || []).some((o) => limpio(o)));
    if (sin >= 0) return `La pregunta ${sin + 1} necesita al menos una respuesta incorrecta.`;
  }
  for (const x of doc.elementos || []) if (Number(x.n?.[0]) > Number(x.n?.[1])) return 'En los grados, "desde" no puede ser mayor que "hasta".';
  return null;
}

// ------------------------------------------------------------------ Paquete inicial de Inglés
const v = (a, b, e, n1, n2) => ({ a, b, e: e || '', n: [n1, n2] });
export const PAQUETE_INGLES = [
  { clave: 'colores', titulo: 'Colors / Colores', icono: '🎨', modos: ['a2b', 'b2a', 'emoji', 'letras'], elementos: [
    v('red', 'rojo', '🔴', 1, 3), v('blue', 'azul', '🔵', 1, 3), v('green', 'verde', '🟢', 1, 3), v('yellow', 'amarillo', '🟡', 1, 3),
    v('orange', 'anaranjado', '🟠', 1, 4), v('purple', 'morado', '🟣', 1, 4), v('black', 'negro', '⚫', 1, 4), v('white', 'blanco', '⚪', 1, 4),
    v('brown', 'café', '🟤', 2, 5), v('pink', 'rosado', '', 2, 5), v('gray', 'gris', '', 2, 6)] },
  { clave: 'numeros', titulo: 'Numbers / Números', icono: '🔢', modos: ['a2b', 'b2a', 'emoji', 'letras'], elementos: [
    v('one', 'uno', '1️⃣', 1, 2), v('two', 'dos', '2️⃣', 1, 2), v('three', 'tres', '3️⃣', 1, 2), v('four', 'cuatro', '4️⃣', 1, 3), v('five', 'cinco', '5️⃣', 1, 3),
    v('six', 'seis', '6️⃣', 1, 3), v('seven', 'siete', '7️⃣', 1, 3), v('eight', 'ocho', '8️⃣', 1, 3), v('nine', 'nueve', '9️⃣', 1, 3), v('ten', 'diez', '🔟', 1, 3),
    v('eleven', 'once', '', 2, 4), v('twelve', 'doce', '', 2, 4), v('fifteen', 'quince', '', 3, 5), v('twenty', 'veinte', '', 3, 5),
    v('thirty', 'treinta', '', 4, 6), v('fifty', 'cincuenta', '', 4, 6), v('one hundred', 'cien', '💯', 4, 6)] },
  { clave: 'animales', titulo: 'Animals / Animales', icono: '🐾', modos: ['a2b', 'b2a', 'emoji', 'letras'], elementos: [
    v('dog', 'perro', '🐶', 1, 3), v('cat', 'gato', '🐱', 1, 3), v('bird', 'pájaro', '🐦', 1, 3), v('fish', 'pez', '🐟', 1, 3), v('cow', 'vaca', '🐮', 1, 3),
    v('pig', 'cerdo', '🐷', 1, 4), v('horse', 'caballo', '🐴', 1, 4), v('duck', 'pato', '🦆', 1, 4), v('rabbit', 'conejo', '🐰', 2, 5), v('mouse', 'ratón', '🐭', 2, 5),
    v('chicken', 'gallina', '🐔', 2, 5), v('lion', 'león', '🦁', 2, 6), v('monkey', 'mono', '🐵', 2, 6), v('frog', 'rana', '🐸', 2, 6),
    v('turtle', 'tortuga', '🐢', 3, 6), v('elephant', 'elefante', '🐘', 3, 6), v('butterfly', 'mariposa', '🦋', 3, 6), v('bee', 'abeja', '🐝', 3, 6)] },
  { clave: 'familia', titulo: 'Family / Familia', icono: '👨‍👩‍👧', modos: ['a2b', 'b2a', 'emoji', 'letras'], elementos: [
    v('mother', 'madre', '👩', 1, 4), v('father', 'padre', '👨', 1, 4), v('sister', 'hermana', '👧', 1, 4), v('brother', 'hermano', '👦', 1, 4),
    v('baby', 'bebé', '👶', 1, 4), v('grandmother', 'abuela', '👵', 2, 6), v('grandfather', 'abuelo', '👴', 2, 6), v('family', 'familia', '', 2, 6),
    v('aunt', 'tía', '', 3, 6), v('uncle', 'tío', '', 3, 6), v('cousin', 'primo', '', 4, 6)] },
  { clave: 'escuela', titulo: 'School / La escuela', icono: '🎒', modos: ['a2b', 'b2a', 'emoji', 'letras'], elementos: [
    v('pencil', 'lápiz', '✏️', 1, 4), v('book', 'libro', '📖', 1, 4), v('notebook', 'cuaderno', '📓', 1, 4), v('backpack', 'mochila', '🎒', 1, 4),
    v('ruler', 'regla', '📏', 2, 5), v('scissors', 'tijeras', '✂️', 2, 5), v('eraser', 'borrador', '', 2, 5), v('crayon', 'crayón', '🖍️', 1, 4),
    v('chair', 'silla', '🪑', 2, 6), v('desk', 'escritorio', '', 3, 6), v('teacher', 'maestro', '', 2, 6), v('computer', 'computadora', '💻', 3, 6)] },
  { clave: 'cuerpo', titulo: 'My body / Mi cuerpo', icono: '🧍', modos: ['a2b', 'b2a', 'emoji', 'letras'], elementos: [
    v('eye', 'ojo', '👁️', 1, 4), v('ear', 'oreja', '👂', 1, 4), v('nose', 'nariz', '👃', 1, 4), v('mouth', 'boca', '👄', 1, 4), v('hand', 'mano', '✋', 1, 4),
    v('foot', 'pie', '🦶', 2, 5), v('leg', 'pierna', '🦵', 2, 5), v('arm', 'brazo', '💪', 2, 5), v('head', 'cabeza', '', 2, 6), v('hair', 'cabello', '', 3, 6), v('teeth', 'dientes', '🦷', 3, 6)] },
  { clave: 'comida', titulo: 'Food / Frutas y comida', icono: '🍎', modos: ['a2b', 'b2a', 'emoji', 'letras'], elementos: [
    v('apple', 'manzana', '🍎', 1, 4), v('banana', 'banano', '🍌', 1, 4), v('orange', 'naranja', '🍊', 1, 4), v('grapes', 'uvas', '🍇', 1, 4),
    v('watermelon', 'sandía', '🍉', 2, 5), v('strawberry', 'fresa', '🍓', 2, 5), v('pineapple', 'piña', '🍍', 2, 6), v('bread', 'pan', '🍞', 1, 5),
    v('milk', 'leche', '🥛', 1, 5), v('water', 'agua', '💧', 1, 5), v('egg', 'huevo', '🥚', 2, 6), v('rice', 'arroz', '🍚', 2, 6), v('cheese', 'queso', '🧀', 3, 6)] },
  { clave: 'dias', titulo: 'Days / Días de la semana', icono: '📅', modos: ['a2b', 'b2a', 'letras'], elementos: [
    v('Monday', 'lunes', '', 2, 6), v('Tuesday', 'martes', '', 2, 6), v('Wednesday', 'miércoles', '', 2, 6), v('Thursday', 'jueves', '', 2, 6),
    v('Friday', 'viernes', '', 2, 6), v('Saturday', 'sábado', '', 2, 6), v('Sunday', 'domingo', '', 2, 6)] },
  { clave: 'saludos', titulo: 'Greetings / Saludos', icono: '👋', modos: ['a2b', 'b2a'], elementos: [
    v('Hello', 'Hola', '👋', 1, 6), v('Goodbye', 'Adiós', '', 1, 6), v('Good morning', 'Buenos días', '🌅', 1, 6), v('Good afternoon', 'Buenas tardes', '', 2, 6),
    v('Good night', 'Buenas noches', '🌙', 1, 6), v('Please', 'Por favor', '', 1, 6), v('Thank you', 'Gracias', '', 1, 6), v("You're welcome", 'De nada', '', 2, 6),
    v('How are you?', '¿Cómo estás?', '', 2, 6), v('My name is…', 'Me llamo…', '', 2, 6), v('Sorry', 'Lo siento', '', 3, 6)] },
];

