// Catálogo de juegos de "Aprende Jugando" y sus generadores de preguntas por nivel (1° a 6°).
// Para agregar un juego: añada un objeto a JUEGOS con { id, area, titulo, icono, generar(nivel) }.
import { PALABRAS_EMOJI, FORMAR_PALABRAS, ORACIONES, TIPOS_PALABRA, VOCABULARIO, LECTURAS, CIENCIAS, DEPARTAMENTOS, GUATEMALA } from './bancos.js';

const ent = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const elegir = (l) => l[Math.floor(Math.random() * l.length)];
export const mezclar = (l) => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmt = (n) => (Number.isInteger(n) ? n.toLocaleString('es-GT') : n.toLocaleString('es-GT', { maximumFractionDigits: 2 }));

/** Opciones numéricas cercanas a la correcta, sin repetir y sin negativos. */
function opcionesNum(c, n = 4) {
  const s = new Set([c]);
  const paso = Math.max(1, Math.round(Math.abs(c) * 0.1));
  let t = 0;
  while (s.size < n && t++ < 50) { const v = c + elegir([-1, 1]) * ent(1, 3) * (Math.random() < 0.5 ? 1 : paso); if (v >= 0) s.add(Number.isInteger(c) ? v : Math.round(v * 10) / 10); }
  return mezclar([...s].map(fmt));
}
const opc = (r, o) => mezclar([r, ...o.slice(0, 3)]);
const deBanco = (banco, nivel) => { const l = banco.filter((x) => nivel >= x.n[0] && nivel <= x.n[1]); return l.length ? l : banco; };
function preguntaBanco(banco, nivel, usadas) {
  const lista = deBanco(banco, nivel).filter((x) => !usadas.has(x.p));
  const x = elegir(lista.length ? lista : deBanco(banco, nivel));
  usadas.add(x.p);
  return { consigna: x.p, visual: x.e ? { tipo: 'emoji', valor: x.e } : null, tipo: 'opciones', opciones: opc(x.r, x.o), correcta: x.r };
}
const EMOJIS_CONTAR = ['🍎', '⭐', '🐟', '🌸', '🍌', '⚽', '🐥', '🍊'];

// ------------------------------------------------------------------ MATEMÁTICAS
function suma(n) {
  if (n === 1) { const a = ent(1, 5), b = ent(1, 4); const e = elegir(EMOJIS_CONTAR); return { consigna: `¿Cuántos hay en total? ${a} + ${b}`, visual: { tipo: 'emoji', valor: e.repeat(a) + ' ➕ ' + e.repeat(b) }, tipo: 'opciones', opciones: opcionesNum(a + b), correcta: fmt(a + b) }; }
  const rangos = { 2: [10, 50], 3: [20, 99], 4: [100, 999], 5: [1000, 9999] };
  if (n === 6) { const a = ent(10, 999) / 10, b = ent(10, 999) / 10; const r = Math.round((a + b) * 10) / 10; return { consigna: '¿Cuánto es?', visual: { tipo: 'num', valor: `${fmt(a)} + ${fmt(b)}` }, tipo: 'teclado', correcta: r }; }
  const [x, y] = rangos[n]; const a = ent(x, y), b = ent(x, y);
  return { consigna: '¿Cuánto es?', visual: { tipo: 'num', valor: `${fmt(a)} + ${fmt(b)}` }, tipo: n === 2 ? 'opciones' : 'teclado', opciones: opcionesNum(a + b), correcta: n === 2 ? fmt(a + b) : a + b };
}
function resta(n) {
  if (n === 1) { const a = ent(3, 9), b = ent(1, a - 1); const e = elegir(EMOJIS_CONTAR); return { consigna: `Tenías ${a}. Se fueron ${b}. ¿Cuántos quedan?`, visual: { tipo: 'emoji', valor: e.repeat(a) }, tipo: 'opciones', opciones: opcionesNum(a - b), correcta: fmt(a - b) }; }
  const rangos = { 2: [10, 50], 3: [20, 99], 4: [100, 999], 5: [1000, 9999] };
  if (n === 6) { const a = ent(500, 999) / 10, b = ent(10, 499) / 10; return { consigna: '¿Cuánto es?', visual: { tipo: 'num', valor: `${fmt(a)} − ${fmt(b)}` }, tipo: 'teclado', correcta: Math.round((a - b) * 10) / 10 }; }
  const [x, y] = rangos[n]; let a = ent(x, y), b = ent(x, y); if (b > a) [a, b] = [b, a];
  return { consigna: '¿Cuánto es?', visual: { tipo: 'num', valor: `${fmt(a)} − ${fmt(b)}` }, tipo: n === 2 ? 'opciones' : 'teclado', opciones: opcionesNum(a - b), correcta: n === 2 ? fmt(a - b) : a - b };
}
function multiplicacion(n) {
  if (n <= 2) { const a = n === 1 ? ent(2, 3) : elegir([2, 3, 5, 10]), b = ent(1, n === 1 ? 4 : 10); const e = elegir(EMOJIS_CONTAR);
    return { consigna: n === 1 ? `Hay ${a} grupos de ${b}. ¿Cuántos son en total?` : '¿Cuánto es?', visual: n === 1 ? { tipo: 'emoji', valor: Array(a).fill(e.repeat(b)).join('  ') } : { tipo: 'num', valor: `${a} × ${b}` }, tipo: 'opciones', opciones: opcionesNum(a * b), correcta: fmt(a * b) }; }
  const [a, b] = n === 3 ? [ent(2, 10), ent(2, 10)] : n === 4 ? [ent(11, 99), ent(2, 9)] : n === 5 ? [ent(11, 99), ent(11, 99)] : [ent(100, 999), ent(11, 99)];
  return { consigna: '¿Cuánto es?', visual: { tipo: 'num', valor: `${fmt(a)} × ${fmt(b)}` }, tipo: 'teclado', correcta: a * b };
}
function division(n) {
  if (n <= 2) { const d = ent(2, n === 1 ? 3 : 5), c = ent(1, n === 1 ? 4 : 6); const e = elegir(EMOJIS_CONTAR);
    return { consigna: `Reparte ${d * c} ${e} entre ${d} niños por igual. ¿Cuántos recibe cada uno?`, visual: { tipo: 'emoji', valor: e.repeat(d * c) }, tipo: 'opciones', opciones: opcionesNum(c), correcta: fmt(c) }; }
  const [d, c] = n === 3 ? [ent(2, 10), ent(2, 10)] : n === 4 ? [ent(2, 9), ent(11, 99)] : n === 5 ? [ent(2, 9), ent(100, 999)] : [ent(11, 45), ent(12, 250)];
  return { consigna: '¿Cuánto es?', visual: { tipo: 'num', valor: `${fmt(d * c)} ÷ ${d}` }, tipo: 'teclado', correcta: c };
}
function comparar(n) {
  let a, b, ta, tb;
  if (n <= 4) { const max = [10, 100, 1000, 10000][n - 1]; a = ent(0, max); b = Math.random() < 0.2 ? a : ent(0, max); ta = fmt(a); tb = fmt(b); }
  else if (n === 5) { a = ent(1, 99) / 10; b = Math.random() < 0.2 ? a : ent(1, 99) / 10; ta = fmt(a); tb = fmt(b); }
  else { const fr = [[1, 2], [1, 3], [1, 4], [2, 3], [3, 4], [2, 4], [2, 6], [3, 6], [1, 5], [2, 5]]; const f1 = elegir(fr), f2 = elegir(fr); a = f1[0] / f1[1]; b = f2[0] / f2[1]; ta = `${f1[0]}/${f1[1]}`; tb = `${f2[0]}/${f2[1]}`; }
  const r = Math.abs(a - b) < 1e-9 ? '=' : a > b ? '>' : '<';
  return { consigna: '¿Qué signo va en el espacio?', visual: { tipo: 'num', valor: `${ta}  ☐  ${tb}` }, tipo: 'opciones', opciones: ['<', '=', '>'], correcta: r, ayuda: '< menor que · > mayor que · = igual' };
}
function serie(n) {
  let s;
  if (n === 1) { const i = ent(0, 10), p = elegir([1, 2]); s = Array.from({ length: 5 }, (_, k) => i + k * p); }
  else if (n === 2) { const p = elegir([2, 5, 10]), i = ent(0, 5) * p; s = Array.from({ length: 5 }, (_, k) => i + k * p); }
  else if (n === 3) { const p = ent(3, 9) * elegir([1, -1]), i = p < 0 ? ent(60, 99) : ent(1, 30); s = Array.from({ length: 5 }, (_, k) => i + k * p); }
  else if (n === 4) { const p = elegir([2, 3]), i = ent(1, 5); s = Array.from({ length: 5 }, (_, k) => i * p ** k); }
  else if (n === 5) { const p = ent(11, 25), i = ent(100, 300); s = Array.from({ length: 5 }, (_, k) => i + k * p); }
  else { const a = ent(1, 5); s = Array.from({ length: 5 }, (_, k) => (a + k) ** 2); }
  const pos = n <= 2 ? 4 : ent(1, 4);
  const r = s[pos];
  return { consigna: '¿Qué número falta en la serie?', visual: { tipo: 'num', valor: s.map((v, k) => (k === pos ? '☐' : fmt(v))).join(', ') }, tipo: n <= 2 ? 'opciones' : 'teclado', opciones: opcionesNum(r), correcta: n <= 2 ? fmt(r) : r };
}
const FIGURAS = {
  'círculo': '<circle cx="50" cy="50" r="40"/>', 'cuadrado': '<rect x="12" y="12" width="76" height="76"/>', 'triángulo': '<polygon points="50,8 92,88 8,88"/>',
  'rectángulo': '<rect x="4" y="25" width="92" height="50"/>', 'rombo': '<polygon points="50,5 92,50 50,95 8,50"/>', 'óvalo': '<ellipse cx="50" cy="50" rx="45" ry="28"/>',
  'pentágono': '<polygon points="50,6 94,38 77,92 23,92 6,38"/>', 'hexágono': '<polygon points="27,8 73,8 96,50 73,92 27,92 4,50"/>',
};
const LADOS = { 'triángulo': 3, 'cuadrado': 4, 'rectángulo': 4, 'rombo': 4, 'pentágono': 5, 'hexágono': 6 };
function figura(n) {
  const color = elegir(['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA']);
  const svg = (nom) => `<svg viewBox="0 0 100 100" role="img" aria-label="figura"><g fill="${color}" stroke="#0D47A1" stroke-width="3">${FIGURAS[nom]}</g></svg>`;
  if (n >= 5 && Math.random() < 0.6) {
    if (Math.random() < 0.5) { const nom = elegir(Object.keys(LADOS)); return { consigna: `¿Cuántos lados tiene un ${nom}?`, visual: { tipo: 'svg', valor: svg(nom) }, tipo: 'teclado', correcta: LADOS[nom] }; }
    const b = ent(3, 15), a = ent(2, 10);
    return Math.random() < 0.5 ? { consigna: `Un rectángulo mide ${b} cm de largo y ${a} cm de ancho. ¿Cuál es su perímetro en cm?`, visual: { tipo: 'svg', valor: svg('rectángulo') }, tipo: 'teclado', correcta: 2 * (a + b) }
      : { consigna: `Un rectángulo mide ${b} cm de largo y ${a} cm de ancho. ¿Cuál es su área en cm²?`, visual: { tipo: 'svg', valor: svg('rectángulo') }, tipo: 'teclado', correcta: a * b };
  }
  const nombres = n <= 2 ? ['círculo', 'cuadrado', 'triángulo', 'rectángulo'] : Object.keys(FIGURAS);
  const nom = elegir(nombres);
  return { consigna: '¿Cómo se llama esta figura?', visual: { tipo: 'svg', valor: svg(nom) }, tipo: 'opciones', opciones: mezclar([nom, ...mezclar(nombres.filter((x) => x !== nom)).slice(0, 3)]), correcta: nom };
}
const NOMBRES = ['Ana', 'Luis', 'Sofía', 'Carlos', 'María', 'José', 'Andrea', 'Diego', 'Lucía', 'Pedro'];
const COSAS = [['mangos', '🥭', 'mango', 'Cuántos'], ['tortillas', '🫓', 'tortilla', 'Cuántas'], ['canicas', '🔵', 'canica', 'Cuántas'], ['lápices', '✏️', 'lápiz', 'Cuántos'], ['naranjas', '🍊', 'naranja', 'Cuántas'], ['galletas', '🍪', 'galleta', 'Cuántas'], ['cuadernos', '📒', 'cuaderno', 'Cuántos']];
function problema(n) {
  const q = elegir(NOMBRES); const [c, e, sing, cu] = elegir(COSAS);
  const tipo = ent(1, n <= 2 ? 2 : n <= 3 ? 3 : 4);
  const f = n <= 2 ? 1 : n <= 4 ? 5 : 20;
  if (tipo === 1) { const a = ent(2, 9) * f, b = ent(1, 9) * f; return { consigna: `${q} tiene ${a} ${c} y le regalan ${b} más. ¿${cu} ${c} tiene ahora?`, visual: { tipo: 'emoji', valor: e }, tipo: n <= 1 ? 'opciones' : 'teclado', opciones: opcionesNum(a + b), correcta: n <= 1 ? fmt(a + b) : a + b }; }
  if (tipo === 2) { const a = ent(5, 15) * f, b = ent(1, 4) * f; return { consigna: `${q} tenía ${a} ${c} y regaló ${b}. ¿${cu} ${c} le quedan?`, visual: { tipo: 'emoji', valor: e }, tipo: n <= 1 ? 'opciones' : 'teclado', opciones: opcionesNum(a - b), correcta: n <= 1 ? fmt(a - b) : a - b }; }
  if (tipo === 3) { const a = ent(2, n <= 3 ? 6 : 12), b = ent(2, n <= 3 ? 9 : 25); return { consigna: `Hay ${a} bolsas con ${b} ${c} cada una. ¿${cu} ${c} hay en total?`, visual: { tipo: 'emoji', valor: e }, tipo: 'teclado', correcta: a * b }; }
  const p = ent(2, 12), u = ent(2, 9); return { consigna: `Cada ${sing} cuesta Q${p}. ${q} compra ${u}. ¿Cuántos quetzales paga?`, visual: { tipo: 'emoji', valor: '💵' }, tipo: 'teclado', correcta: p * u };
}
function mental(n) {
  const ops = n <= 2 ? ['+', '−'] : n <= 4 ? ['+', '−', '×'] : ['+', '−', '×', '÷'];
  const op = elegir(ops); const lim = [10, 20, 50, 100, 200, 500][n - 1];
  let a, b, r;
  if (op === '+') { a = ent(1, lim); b = ent(1, lim); r = a + b; }
  else if (op === '−') { a = ent(1, lim); b = ent(0, a); r = a - b; }
  else if (op === '×') { a = ent(2, n <= 4 ? 10 : 12); b = ent(2, n <= 4 ? 10 : 25); r = a * b; }
  else { b = ent(2, 12); r = ent(2, 12); a = b * r; }
  return { consigna: '¡Rápido! Calcula mentalmente', visual: { tipo: 'num', valor: `${a} ${op} ${b}` }, tipo: 'teclado', correcta: r };
}

// ------------------------------------------------------------------ LENGUAJE
function letras(n, usadas) {
  const lista = PALABRAS_EMOJI.filter(([p]) => !usadas.has(p)); const [p, e] = elegir(lista.length ? lista : PALABRAS_EMOJI); usadas.add(p);
  const ini = p[0].normalize('NFD')[0].toUpperCase();
  if (n >= 3 && Math.random() < 0.5) {
    const otros = mezclar(PALABRAS_EMOJI.filter(([x]) => x[0].normalize('NFD')[0].toUpperCase() !== ini)).slice(0, 3).map(([x]) => x);
    return { consigna: `¿Qué palabra empieza con la letra "${ini}"?`, tipo: 'opciones', opciones: mezclar([p, ...otros]), correcta: p };
  }
  const abc = 'ABCDEFGHIJLMNOPRSTUVZ'.split('').filter((l) => l !== ini);
  return { consigna: n === 1 ? '¿Con qué letra empieza?' : `¿Con qué letra empieza "${p}"?`, visual: { tipo: 'emoji', valor: e }, tipo: 'opciones', opciones: mezclar([ini, ...mezclar(abc).slice(0, 3)]), correcta: ini };
}
function formar(n, usadas) {
  const lista = FORMAR_PALABRAS[n].filter((x) => !usadas.has(x)); const p = elegir(lista.length ? lista : FORMAR_PALABRAS[n]); usadas.add(p);
  const letrasP = p.split('');
  let m = mezclar(letrasP); if (m.join('') === p) m = m.reverse();
  const emoji = PALABRAS_EMOJI.find(([x]) => x === p)?.[1];
  return { consigna: 'Ordena las letras para formar la palabra', visual: emoji ? { tipo: 'emoji', valor: emoji } : null, tipo: 'ordenar', elementos: m, correcta: letrasP, juntar: '' };
}
function oracion(n, usadas) {
  const lista = ORACIONES.filter((o) => n >= o.n[0] && n <= o.n[1] && !usadas.has(o.t)); const o = elegir(lista.length ? lista : ORACIONES.filter((x) => n >= x.n[0] && n <= x.n[1]).concat(ORACIONES).slice(0, 4)); usadas.add(o.t);
  const pal = o.t.split(' ');
  let m = mezclar(pal); if (m.join(' ') === o.t) m = m.reverse();
  return { consigna: 'Ordena las palabras para formar la oración', tipo: 'ordenar', elementos: m, correcta: pal, juntar: ' ' };
}
function tipoPalabra(n, usadas) {
  const banco = TIPOS_PALABRA.filter(([, , k]) => k <= Math.max(1, n));
  const lista = banco.filter(([p]) => !usadas.has(p)); const [p, t] = elegir(lista.length ? lista : banco); usadas.add(p);
  const ops = n >= 3 ? ['sustantivo', 'verbo', 'adjetivo'] : ['sustantivo', 'verbo'];
  return { consigna: `La palabra "${p}" es un…`, tipo: 'opciones', opciones: ops, correcta: t, ayuda: n >= 3 ? 'Sustantivo: nombra cosas, personas o lugares. Verbo: es una acción. Adjetivo: dice cómo es algo.' : 'Sustantivo: nombra cosas, personas o lugares. Verbo: es una acción.' };
}
function lectura(n, _u, estado) {
  // La misma lectura para varias preguntas seguidas
  if (!estado.lectura || estado.lecturaIdx >= estado.lectura.q.length) {
    const lista = LECTURAS.filter((l) => n >= l.n[0] && n <= l.n[1] && l !== estado.lectura);
    estado.lectura = elegir(lista.length ? lista : LECTURAS); estado.lecturaIdx = 0;
  }
  const [p, r, o] = estado.lectura.q[estado.lecturaIdx++];
  return { consigna: p, visual: { tipo: 'lectura', valor: estado.lectura.t }, tipo: 'opciones', opciones: opc(r, o), correcta: r };
}

function departamento(n, usadas) {
  if (n <= 2 || Math.random() < 0.3) return preguntaBanco(GUATEMALA.departamentos, n, usadas);
  const lista = DEPARTAMENTOS.filter(([d]) => !usadas.has(d)); const [d, c] = elegir(lista.length ? lista : DEPARTAMENTOS); usadas.add(d);
  const otros = mezclar(DEPARTAMENTOS.filter(([x]) => x !== d));
  if (d === c || Math.random() < 0.5) return { consigna: `¿De qué departamento es cabecera ${c === d ? 'la ciudad de ' + c : c}?`, visual: { tipo: 'emoji', valor: '🗺️' }, tipo: 'opciones', opciones: mezclar([d, ...otros.slice(0, 3).map(([x]) => x)]), correcta: d };
  return { consigna: `¿Cuál es la cabecera del departamento de ${d}?`, visual: { tipo: 'emoji', valor: '🏙️' }, tipo: 'opciones', opciones: mezclar([c, ...otros.slice(0, 3).map(([, x]) => x)]), correcta: c };
}

const banco = (b) => (n, usadas) => preguntaBanco(b, n, usadas);

const TODAS_AREAS = [
  { id: 'mate', nombre: 'Matemáticas', icono: '🔢', color: 'var(--azul)' },
  { id: 'lenguaje', nombre: 'Comunicación y Lenguaje', icono: '📖', color: 'var(--rojo)' },
  { id: 'ciencias', nombre: 'Ciencias', icono: '🔬', color: 'var(--verde)' },
  { id: 'guate', nombre: 'Mi Guatemala', icono: '🇬🇹', color: 'var(--celeste)' },
];

const TODOS = [
  { id: 'sumas', area: 'mate', titulo: 'Sumas', icono: '➕', generar: suma },
  { id: 'restas', area: 'mate', titulo: 'Restas', icono: '➖', generar: resta },
  { id: 'multiplicaciones', area: 'mate', titulo: 'Multiplicaciones', icono: '✖️', generar: multiplicacion },
  { id: 'divisiones', area: 'mate', titulo: 'Divisiones', icono: '➗', generar: division },
  { id: 'comparar', area: 'mate', titulo: 'Comparar números', icono: '⚖️', generar: comparar },
  { id: 'series', area: 'mate', titulo: 'Series numéricas', icono: '🔢', generar: serie },
  { id: 'figuras', area: 'mate', titulo: 'Figuras geométricas', icono: '🔺', generar: figura },
  { id: 'problemas', area: 'mate', titulo: 'Problemas', icono: '🧩', generar: problema },
  { id: 'mental', area: 'mate', titulo: 'Cálculo mental', icono: '⚡', generar: mental, cronometro: true },
  { id: 'letras', area: 'lenguaje', titulo: 'Reconocer letras', icono: '🔤', generar: letras },
  { id: 'formar', area: 'lenguaje', titulo: 'Formar palabras', icono: '🧱', generar: formar },
  { id: 'lectura', area: 'lenguaje', titulo: 'Lectura comprensiva', icono: '📚', generar: lectura },
  { id: 'oraciones', area: 'lenguaje', titulo: 'Ordenar oraciones', icono: '📝', generar: oracion },
  { id: 'tipos', area: 'lenguaje', titulo: 'Sustantivos y verbos', icono: '🏷️', generar: tipoPalabra },
  { id: 'vocabulario', area: 'lenguaje', titulo: 'Vocabulario', icono: '💬', generar: banco(VOCABULARIO) },
  { id: 'cuerpo', area: 'ciencias', titulo: 'El cuerpo humano', icono: '🧍', generar: banco(CIENCIAS.cuerpo) },
  { id: 'seres', area: 'ciencias', titulo: 'Animales y plantas', icono: '🦋', generar: banco(CIENCIAS.seres) },
  { id: 'ambiente', area: 'ciencias', titulo: 'Medio ambiente', icono: '♻️', generar: banco(CIENCIAS.ambiente) },
  { id: 'solar', area: 'ciencias', titulo: 'Sistema solar', icono: '🪐', generar: banco(CIENCIAS.solar) },
  { id: 'agua', area: 'ciencias', titulo: 'Agua y naturaleza', icono: '💧', generar: banco(CIENCIAS.agua) },
  { id: 'departamentos', area: 'guate', titulo: 'Departamentos', icono: '🗺️', generar: departamento },
  { id: 'simbolos', area: 'guate', titulo: 'Símbolos patrios', icono: '🐦', generar: banco(GUATEMALA.simbolos) },
  { id: 'historia', area: 'guate', titulo: 'Historia', icono: '🏛️', generar: banco(GUATEMALA.historia) },
  { id: 'geografia', area: 'guate', titulo: 'Geografía', icono: '🌋', generar: banco(GUATEMALA.geografia) },
  { id: 'cultura', area: 'guate', titulo: 'Cultura y tradiciones', icono: '🪁', generar: banco(GUATEMALA.cultura) },
];

// Desde la versión 1.3 los juegos de Lenguaje, Ciencias y Mi Guatemala son "paquetes" editables
// (js/juegos/paquetes.js). Aquí quedan solo los de Matemáticas, que se generan solos.
export const AREAS = TODAS_AREAS.filter((a) => a.id === 'mate');
export const JUEGOS = TODOS.filter((j) => j.area === 'mate');
export const MATERIA_MATEMATICAS = 'matematicas';
