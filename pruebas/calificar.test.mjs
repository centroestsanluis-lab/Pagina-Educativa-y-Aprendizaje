// Pruebas de la calificación automática:  node pruebas/calificar.test.mjs
import { calificar, aplicarRevision, construirResultado, normalizarRespuesta, leerNumero } from '../js/calificar.js';
let ok = 0, mal = 0;
const igual = (a, b, nombre) => { const s = JSON.stringify(a) === JSON.stringify(b); s ? ok++ : mal++; console.log(`${s ? '✔' : '✖'} ${nombre}${s ? '' : `  → obtuvo ${JSON.stringify(a)}, esperaba ${JSON.stringify(b)}`}`); };

const P = [
  { id: 'a', tipo: 'opcion', puntos: 2, opciones: ['x', 'y', 'z'] },
  { id: 'b', tipo: 'vf', puntos: 1 },
  { id: 'c', tipo: 'completar', puntos: 2, texto: '___ y ___' },
  { id: 'd', tipo: 'relacionar', puntos: 3, izquierda: ['1', '2', '3'], derecha: ['c', 'a', 'b'] },
  { id: 'e', tipo: 'ordenar', puntos: 2, elementos: ['tres', 'uno', 'dos'] },
  { id: 'f', tipo: 'corta', puntos: 1 },
  { id: 'g', tipo: 'numerica', puntos: 1 },
  { id: 'h', tipo: 'abierta', puntos: 2 },
];
const C = { a: { correcta: 1 }, b: { correcta: false }, c: { huecos: [['sol'], ['luna', 'Luna llena']] }, d: { pares: [1, 2, 0] },
  e: { orden: [1, 2, 0] }, f: { aceptadas: ['Ciudad de Guatemala', 'Guatemala'] }, g: { valor: 3.5, tolerancia: 0.1 }, h: {} };

let r = calificar(P, C, { a: 1, b: false, c: ['Sol', 'LUNA'], d: [1, 2, 0], e: [1, 2, 0], f: 'ciudad de guatemala.', g: '3,45', h: 'texto' });
igual([r.puntaje, r.puntajeMax, r.estado, r.pendientes], [12, 14, 'revision', ['h']], 'todo correcto + abierta pendiente');
r = calificar(P, C, {});
igual([r.puntaje, r.estado], [0, 'revision'], 'sin respuestas = 0 puntos');
r = calificar(P, C, { c: ['sol', 'mar'], d: [1, 0, 0] });
igual([r.detalle.c.puntos, r.detalle.d.puntos], [1, 2], 'puntos parciales en completar y relacionar');
r = calificar(P, C, { a: '1', b: 'false', e: [1, 0, 2] });
igual([r.detalle.a.correcta, r.detalle.b.correcta, r.detalle.e.correcta], [true, false, false], 'tipos: índice como texto vale, "false" texto no vale, orden incorrecto');
r = calificar(P, C, { g: '3.7' }); igual(r.detalle.g.correcta, false, 'numérico fuera del margen');
r = calificar(P, C, { g: 'tres' }); igual(r.detalle.g.correcta, false, 'numérico con letras');
r = calificar([{ id: 'x', tipo: 'corta' }], { x: { aceptadas: ['árbol'] } }, { x: ' ARBOL ' }); igual(r.puntaje, 1, 'sin tildes ni mayúsculas, puntos por defecto 1');
r = calificar(P.filter((p) => p.tipo !== 'abierta'), C, {}); igual(r.estado, 'calificada', 'sin abiertas queda calificada');
const base = calificar(P, C, { a: 1, h: 'algo' });
const rev = aplicarRevision(base, { h: 1.5 });
igual([rev.puntaje, rev.estado, rev.detalle.h.revisadoPorDocente], [3.5, 'calificada', true], 'revisión manual del docente');
igual(aplicarRevision(base, { h: 99 }).detalle.h.puntos, 2, 'la revisión no supera el máximo');
igual(normalizarRespuesta('¡Él  Pingüino!'), 'el pinguino', 'normalizar texto');
igual([leerNumero('1 000'), leerNumero('2,5'), isNaN(leerNumero(''))], [1000, 2.5, true], 'leer números');
const res = construirResultado({ actividadId: 'A', alumnoId: 'U', alumnoNombre: 'Ana', intento: 1, seccion: 'A', respuestas: { a: 1 } },
  { gradoId: 'g1', materiaId: 'm', clase: 'g1__m', temaId: 't', titulo: 'T', mostrarNota: false, preguntas: [P[0]] }, { respuestas: { a: { correcta: 1 } } }, 'sistema', 5);
igual([res.puntaje, res.visibleAlumno, res.clase, res.calificado], [2, false, 'g1__m', 5], 'construir resultado');
console.log(`\n${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
