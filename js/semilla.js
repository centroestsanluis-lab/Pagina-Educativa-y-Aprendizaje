// Datos iniciales: configuración institucional, grados y materias.
// En modo demostración también crea usuarios y actividades de ejemplo.
import { claseDe } from './store/permisos.js';

export const COLORES_BASE = {
  rojo: '#E53935', azul: '#1E88E5', verde: '#43A047', amarillo: '#FDD835',
  naranja: '#FB8C00', morado: '#8E24AA', celeste: '#29B6F6', marino: '#0D47A1',
};

export const INSTITUCION_BASE = {
  nombrePlataforma: 'CESL Digital',
  institucion: 'Centro de Estudios San Luis',
  pais: 'Guatemala',
  lema: 'Aprender hoy, transformar el mañana.',
  bienvenida: '¡Hola! Soy LU. Bienvenido a CESL Digital. Aquí cada pregunta es el comienzo de una nueva aventura de aprendizaje.',
  preguntaAlumno: '¿Qué quieres aprender hoy?',
  valores: 'Respeto, honestidad, solidaridad y responsabilidad.',
  mision: 'Formar estudiantes íntegros y competentes.',
  vision: 'Ser una institución líder en educación y valores.',
  direccion: '', telefono: '', correo: '',
  colores: { ...COLORES_BASE },
  logo: '', mascota: '', fondo: '',
  banner: { activo: false, texto: '', color: '#FB8C00' },
  titulos: { tareas: 'Mis tareas', biblioteca: 'Biblioteca', juegos: 'Aprende Jugando', logros: 'Mis logros' },
  iconos: { tareas: '📝', biblioteca: '📚', juegos: '🎮', logros: '🏆' },
  mensajesLU: ['¡Excelente trabajo!', '¡Sigue así, tú puedes!', '¡Cada día aprendes más!', '¡Eres un campeón!'],
};

export const GRADOS_BASE = [
  ['g1', 'Primero primaria', 'var(--azul)'], ['g2', 'Segundo primaria', 'var(--verde)'], ['g3', 'Tercero primaria', 'var(--naranja)'],
  ['g4', 'Cuarto primaria', 'var(--rojo)'], ['g5', 'Quinto primaria', 'var(--amarillo)'], ['g6', 'Sexto primaria', 'var(--marino)'],
].map(([id, nombre, color], i) => ({ id, nombre, corto: `${i + 1}°`, orden: i + 1, color, secciones: ['A'], activo: true }));

const TODOS = GRADOS_BASE.map((g) => g.id);
export const MATERIAS_BASE = [
  ['comunicacion', 'Comunicación y Lenguaje', '📖', 'var(--rojo)', TODOS],
  ['matematicas', 'Matemáticas', '🔢', 'var(--azul)', TODOS],
  ['ciencias-naturales', 'Ciencias Naturales', '🔬', 'var(--verde)', ['g4', 'g5', 'g6']],
  ['ciencias-sociales', 'Ciencias Sociales', '🌎', 'var(--naranja)', ['g4', 'g5', 'g6']],
  ['medio-social-natural', 'Medio Social y Natural', '🌱', 'var(--verde)', ['g1', 'g2', 'g3']],
  ['mi-guatemala', 'Mi Guatemala', '🇬🇹', 'var(--celeste)', TODOS],
  ['formacion-ciudadana', 'Formación Ciudadana', '🤝', 'var(--morado)', ['g4', 'g5', 'g6']],
  ['expresion-artistica', 'Expresión Artística', '🎨', 'var(--rojo)', TODOS],
  ['tecnologia', 'Tecnología y Computación', '💻', 'var(--marino)', TODOS],
].map(([id, nombre, icono, color, grados], i) => ({ id, nombre, icono, color, grados, visible: true, orden: i + 1 }));

/** Operaciones para dejar lista una instalación nueva de Firebase. */
export function operacionesIniciales() {
  return [
    { op: 'set', col: 'config', id: 'institucion', data: INSTITUCION_BASE },
    ...GRADOS_BASE.map(({ id, ...d }) => ({ op: 'set', col: 'grados', id, data: d })),
    ...MATERIAS_BASE.map(({ id, ...d }) => ({ op: 'set', col: 'materias', id, data: d })),
  ];
}

// ---------------- Datos de demostración ----------------
export async function datosDemo(hash) {
  const ahora = Date.now();
  const dia = 86400000;
  const dom = (window.CESL_CONFIG?.dominioUsuarios) || 'alumnos.cesl.local';
  const cuentas = {};
  const usuarios = {};
  const persona = async (uid, usuario, clave, datos) => {
    const email = usuario.includes('@') ? usuario : `${usuario}@${dom}`;
    cuentas[email] = { uid, hash: await hash(clave), desactivada: false };
    usuarios[uid] = { usuario, email, activo: true, debeCambiarPassword: false, creado: ahora, ...datos };
  };
  const clasesAna = [claseDe('g3', 'matematicas'), claseDe('g3', 'comunicacion'), claseDe('g4', 'matematicas')];
  await persona('u-admin', 'admin', 'admin123', { nombre: 'Administración CESL', rol: 'admin' });
  await persona('u-ana', 'maestra.ana', 'docente123', { nombre: 'Ana Morales', rol: 'docente', clases: clasesAna, grados: ['g3', 'g4'] });
  await persona('u-jorge', 'maestro.jorge', 'docente123', { nombre: 'Jorge Castillo', rol: 'docente', clases: [claseDe('g5', 'ciencias-naturales')], grados: ['g5'] });
  const alumnos = [
    ['u-luis', 'luis.perez', 'Luis Pérez', 'g3'], ['u-sofia', 'sofia.garcia', 'Sofía García', 'g3'],
    ['u-carlos', 'carlos.lopez', 'Carlos López', 'g3'], ['u-maria', 'maria.hernandez', 'María Hernández', 'g4'],
    ['u-diego', 'diego.ramirez', 'Diego Ramírez', 'g5'],
  ];
  for (const [uid, u, n, g] of alumnos) await persona(uid, u, '123456', { nombre: n, rol: 'alumno', gradoId: g, seccion: 'A' });

  const conClase = (g, m, d) => ({ gradoId: g, materiaId: m, clase: claseDe(g, m), ...d });
  const temas = {
    't-sumas': conClase('g3', 'matematicas', { nombre: 'Unidad 1: Sumas y restas', orden: 1, visible: true, autorId: 'u-ana' }),
    't-mult': conClase('g3', 'matematicas', { nombre: 'Unidad 2: Multiplicación', orden: 2, visible: true, autorId: 'u-ana' }),
    't-palabras': conClase('g3', 'comunicacion', { nombre: 'Unidad 1: Clases de palabras', orden: 1, visible: true, autorId: 'u-ana' }),
  };
  const recursos = {
    'r-2': conClase('g3', 'matematicas', { temaId: 't-mult', titulo: 'Tablas de multiplicar del 2 al 5', descripcion: 'Repasa las tablas antes de la tarea.', tipo: 'imagen', url: 'img/demo-tablas.png', visible: true, orden: 1, autorId: 'u-ana', creado: ahora }),
  };
  const act1 = conClase('g3', 'matematicas', {
    temaId: 't-sumas', titulo: 'Practico sumas y restas', instrucciones: 'Lee con atención cada pregunta y elige la respuesta correcta. ¡Tú puedes!',
    imagen: '', publicada: true, fechaPublicacion: ahora - dia, fechaLimite: ahora + 7 * dia, intentos: 2,
    mostrarNota: true, mostrarRespuestas: true, autorId: 'u-ana', creado: ahora - dia,
    preguntas: [
      { id: 'p1', tipo: 'opcion', enunciado: '¿Cuánto es 25 + 14?', puntos: 2, opciones: ['39', '29', '41', '311'] },
      { id: 'p2', tipo: 'vf', enunciado: '50 − 20 = 30', puntos: 1 },
      { id: 'p3', tipo: 'numerica', enunciado: 'Pedro tiene 48 canicas y regala 15. ¿Cuántas le quedan?', puntos: 2, unidad: 'canicas' },
      { id: 'p4', tipo: 'ordenar', enunciado: 'Ordena los números de menor a mayor', puntos: 2, elementos: ['72', '18', '45', '9'] },
      { id: 'p5', tipo: 'completar', enunciado: 'Completa:', texto: '10 + ___ = 15 y 20 − ___ = 12', puntos: 2 },
      { id: 'p6', tipo: 'relacionar', enunciado: 'Une cada operación con su resultado', puntos: 3, izquierda: ['6 + 6', '9 + 1', '7 + 8'], derecha: ['15', '12', '10'] },
    ],
  });
  const clave1 = { gradoId: 'g3', materiaId: 'matematicas', clase: act1.clase, respuestas: {
    p1: { correcta: 0, explicacion: '25 + 14 = 39' }, p2: { correcta: true }, p3: { valor: 33, tolerancia: 0 },
    p4: { orden: [3, 1, 2, 0] }, p5: { huecos: [['5', 'cinco'], ['8', 'ocho']] }, p6: { pares: [1, 2, 0] },
  } };
  const act2 = conClase('g3', 'comunicacion', {
    temaId: 't-palabras', titulo: 'Sustantivos y verbos', instrucciones: 'Responde cada pregunta. La última la revisará tu maestra.',
    imagen: '', publicada: true, fechaPublicacion: ahora - dia, fechaLimite: null, intentos: 1,
    mostrarNota: true, mostrarRespuestas: false, autorId: 'u-ana', creado: ahora - dia,
    preguntas: [
      { id: 'q1', tipo: 'opcion', enunciado: '¿Cuál de estas palabras es un sustantivo?', puntos: 1, opciones: ['correr', 'mesa', 'bonito', 'rápido'] },
      { id: 'q2', tipo: 'vf', enunciado: '"Saltar" es un verbo.', puntos: 1 },
      { id: 'q3', tipo: 'corta', enunciado: 'Escribe el verbo de esta oración: "El perro ladra fuerte".', puntos: 2 },
      { id: 'q4', tipo: 'abierta', enunciado: 'Escribe una oración con un sustantivo y un verbo.', puntos: 2 },
    ],
  });
  const clave2 = { gradoId: 'g3', materiaId: 'comunicacion', clase: act2.clase, respuestas: {
    q1: { correcta: 1 }, q2: { correcta: true }, q3: { aceptadas: ['ladra'] }, q4: {},
  } };
  return {
    version: 1,
    cuentas,
    datos: {
      config: { institucion: { ...INSTITUCION_BASE }, sistema: { inicializado: true, fecha: ahora } },
      grados: Object.fromEntries(GRADOS_BASE.map(({ id, ...d }) => [id, d])),
      materias: Object.fromEntries(MATERIAS_BASE.map(({ id, ...d }) => [id, d])),
      usuarios, temas, recursos,
      actividades: { 'a-sumas': act1, 'a-palabras': act2 },
      claves: { 'a-sumas': clave1, 'a-palabras': clave2 },
      entregas: {}, resultados: {}, bitacora: {}, practica: {},
    },
  };
}
