// Motor de "Aprende Jugando": rondas de 10 preguntas, teclado grande, estrellas y LU.
import { h, vaciar } from '../ui.js';
import { store } from '../store/index.js';
import { inst, mascotaChica, mensajeLU } from '../tema.js';
import { S, navegar, grado } from '../app.js';
import { JUEGOS, AREAS, mezclar } from './catalogo.js';
import { leerNumero } from '../calificar.js';
import { construirJuego, disponibleEnNivel } from './personalizados.js';

/** Juegos creados por docentes y administración (colección "juegos"). */
async function juegosPersonalizados() {
  try { return (await store.list('juegos', [['visible', '==', true]])).sort((a, b) => String(a.titulo).localeCompare(b.titulo)); } catch (e) { console.warn('Juegos personalizados no disponibles', e); return []; }
}
const vozDisponible = () => typeof speechSynthesis !== 'undefined';
function hablar(texto, idioma) {
  if (!vozDisponible() || !texto) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto); u.lang = idioma; u.rate = 0.85;
  const vz = speechSynthesis.getVoices().find((x) => x.lang?.toLowerCase().startsWith(idioma.slice(0, 2).toLowerCase()));
  if (vz) u.voice = vz;
  speechSynthesis.speak(u);
}
const botonVoz = (v) => (v && vozDisponible() ? h('button', { class: 'btn claro chico', type: 'button', onclick: () => hablar(v.texto, v.idioma), 'aria-label': 'Escuchar' }, '🔊 Escuchar') : null);

const RONDAS = 10;
const COLORES_NIVEL = ['var(--azul)', 'var(--verde)', 'var(--naranja)', 'var(--rojo)', 'var(--amarillo)', 'var(--marino)'];
const nivelPorDefecto = () => { const g = S.grados.find((x) => x.id === S.yo?.gradoId); return Math.min(6, Math.max(1, g?.orden || 3)); };
let nivelElegido = null;

async function progreso() {
  if (S.yo?.rol !== 'alumno') return null;
  try { return (await store.get('practica', S.uid)) || { juegos: {} }; } catch { return { juegos: {} }; }
}

export async function renderCatalogo(cont) {
  const nivel = nivelElegido || nivelPorDefecto();
  const [prog, propios] = await Promise.all([progreso(), juegosPersonalizados()]);
  vaciar(cont);
  cont.append(h('h1', null, `${inst.iconos.juegos} ${inst.titulos.juegos}`),
    h('div', { class: 'saludo' }, h('img', { class: 'lu', src: mascotaChica(), alt: '', style: { width: '90px' } }),
      h('div', { class: 'burbuja' }, '¡Elige un juego y aprende jugando! ', h('span', { class: 'chico', style: { color: 'var(--tinta)' } }, 'Primero escoge tu nivel:'))),
    h('div', { class: 'selector-nivel', role: 'group', 'aria-label': 'Nivel' }, COLORES_NIVEL.map((c, i) =>
      h('button', { class: i + 1 === nivel ? 'activo' : '', style: { background: c, color: i === 4 ? 'var(--tinta)' : '#fff' }, 'aria-pressed': String(i + 1 === nivel), title: `Nivel ${i + 1}° primaria`,
        onclick: () => { nivelElegido = i + 1; renderCatalogo(cont); } }, `${i + 1}°`))));
  for (const a of AREAS) {
    cont.append(h('section', { style: { marginBottom: '22px' } }, h('h2', null, `${a.icono} ${a.nombre}`),
      h('div', { class: 'rejilla chica' }, JUEGOS.filter((j) => j.area === a.id).map((j) => {
        const r = prog?.juegos?.[`${j.id}-${nivel}`];
        return mosaicoJuego(j, a.color, nivel, prog);
      }))));
  }
  // Juegos creados por la escuela, agrupados por materia
  const porMateria = {};
  for (const d of propios) if (disponibleEnNivel(d, nivel)) (porMateria[d.materiaId] ||= []).push(d);
  for (const [mid, lista] of Object.entries(porMateria)) {
    const m = S.materias.find((x) => x.id === mid) || { nombre: 'Más juegos', icono: '🧩', color: 'var(--morado)' };
    cont.append(h('section', { style: { marginBottom: '22px' } }, h('h2', null, `${m.icono || '🧩'} ${m.nombre}`),
      h('div', { class: 'rejilla chica' }, lista.map((d) => mosaicoJuego({ id: 'c-' + d.id, icono: d.icono || '🧩', titulo: d.titulo }, m.color, nivel, prog)))));
  }
}

function mosaicoJuego(j, color, nivel, prog) {
  const r = prog?.juegos?.[`${j.id}-${nivel}`];
  return h('button', { class: 'mosaico', style: { '--c': color, minHeight: '120px', fontSize: '1.02rem' }, onclick: () => navegar(`/juego/${j.id}/${nivel}`) },
    r ? h('span', { class: 'insignia', style: { color: 'var(--naranja)' } }, '⭐'.repeat(r.estrellas || 0) || '✔') : null,
    h('span', { class: 'icono', style: { fontSize: '2.3rem' } }, j.icono), j.titulo);
}

export async function renderJuego(cont, juegoId, nivel) {
  let juego = JUEGOS.find((j) => j.id === juegoId);
  if (!juego && String(juegoId).startsWith('c-')) {
    try { const d = await store.get('juegos', juegoId.slice(2)); if (d) juego = construirJuego(d); } catch (e) { console.warn(e); }
  }
  if (!juego) { navegar('/juegos'); return; }
  nivel = nivel || nivelPorDefecto();
  const usadas = new Set(); const estado = {};
  let ronda = 0; let aciertos = 0; let inicio = Date.now();

  const barra = h('div'); const marcador = h('b');
  const tablero = h('div', { class: 'tablero' });
  vaciar(cont).append(h('div', { class: 'juego' },
    h('div', { class: 'marcador' }, h('button', { class: 'btn claro chico', onclick: () => navegar('/juegos') }, '◀ Juegos'),
      h('div', { class: 'progreso' }, barra), marcador),
    h('h2', { style: { textAlign: 'center' } }, `${juego.icono} ${juego.titulo} · Nivel ${nivel}°`),
    tablero));

  const siguiente = () => {
    if (ronda >= RONDAS) return final();
    ronda++;
    barra.style.width = ((ronda - 1) / RONDAS) * 100 + '%';
    marcador.textContent = `${aciertos} ⭐`;
    let q; let t = 0;
    do { q = juego.generar(nivel, usadas, estado); t++; } while (t < 5 && usadas.has('q:' + q.consigna + JSON.stringify(q.visual)));
    usadas.add('q:' + q.consigna + JSON.stringify(q.visual));
    pintar(q);
  };

  function pintar(q) {
    vaciar(tablero);
    const reaccion = h('div', { class: 'lu-reaccion' });
    let respondida = false;
    const responder = (correcto, mostrar) => {
      if (respondida) return; respondida = true;
      if (correcto) aciertos++;
      marcador.textContent = `${aciertos} ⭐`;
      vaciar(reaccion).append(h('img', { src: mascotaChica(), alt: '' }),
        h('div', { class: 'burbuja', style: { color: correcto ? 'var(--exito)' : 'var(--error)' } }, correcto ? `✔ ${mensajeLU()}` : `La respuesta era: ${mostrar}. ¡Tú puedes!`),
        botonVoz(q.vozRespuesta));
      if (q.vozRespuesta) hablar(q.vozRespuesta.texto, q.vozRespuesta.idioma);
      reaccion.append(h('button', { class: 'btn verde', onclick: siguiente, autofocus: true }, ronda >= RONDAS ? 'Ver resultado 🏆' : 'Siguiente ▶'));
    };
    tablero.append(h('div', { class: 'consigna' }, q.consigna), q.voz ? h('div', { style: { marginBottom: '10px' } }, botonVoz(q.voz)) : null);
    if (q.visual?.tipo === 'num') tablero.append(h('div', { class: 'grande-num' }, q.visual.valor));
    if (q.visual?.tipo === 'emoji') tablero.append(h('div', { class: 'emoji-grande', style: { fontSize: q.visual.valor.length > 8 ? '2.4rem' : '4.5rem', wordBreak: 'break-all' } }, q.visual.valor));
    if (q.visual?.tipo === 'lectura') tablero.append(h('div', { class: 'lectura' }, q.visual.valor));
    if (q.visual?.tipo === 'svg') tablero.append(h('div', { class: 'figura', html: q.visual.valor })); // SVG generado por el propio juego
    if (q.ayuda) tablero.append(h('p', { class: 'texto-suave chico' }, q.ayuda));

    if (q.tipo === 'opciones') {
      const botones = q.opciones.map((o) => h('button', { class: 'opcion', onclick: (e) => {
        if (respondida) return;
        const ok = String(o) === String(q.correcta);
        e.currentTarget.classList.add(ok ? 'bien' : 'mal');
        if (!ok) botones.find((b) => b.dataset.v === String(q.correcta))?.classList.add('bien');
        responder(ok, q.correcta);
      }, 'data-v': String(o) }, String(o)));
      tablero.append(h('div', { class: 'opciones' }, botones));
    } else if (q.tipo === 'teclado') {
      let valor = '';
      const pantalla = h('div', { class: 'pantalla-num', 'aria-live': 'polite' }, '?');
      const tecla = (t) => { if (respondida) return; if (t === '⌫') valor = valor.slice(0, -1); else if (valor.length < 9 && !(t === '.' && valor.includes('.'))) valor += t; pantalla.textContent = valor || '?'; };
      const comprobar = () => { if (respondida || !valor) return; const ok = Math.abs(leerNumero(valor) - Number(q.correcta)) < 1e-9; pantalla.style.borderColor = ok ? 'var(--verde)' : 'var(--rojo)'; responder(ok, q.correcta); };
      tablero.append(pantalla, h('div', { class: 'teclado' },
        ['7', '8', '9', '4', '5', '6', '1', '2', '3', nivel >= 5 ? '.' : '⌫', '0', '✔'].map((t) => h('button', { class: t === '✔' ? 'ok' : '', onclick: () => (t === '✔' ? comprobar() : tecla(t)), 'aria-label': t === '⌫' ? 'Borrar' : t === '✔' ? 'Comprobar' : t }, t)),
        nivel >= 5 ? h('button', { onclick: () => tecla('⌫'), 'aria-label': 'Borrar', style: { gridColumn: 'span 3' } }, '⌫ Borrar') : null));
      tablero.tecladoFisico = (e) => { if (/^[0-9.]$/.test(e.key)) tecla(e.key); else if (e.key === 'Backspace') tecla('⌫'); else if (e.key === 'Enter') comprobar(); };
    } else if (q.tipo === 'ordenar') {
      const elegido = [];
      const zonaRes = h('div', { class: 'fichas', style: { justifyContent: 'center' } });
      const zonaFichas = h('div', { class: 'fichas', style: { justifyContent: 'center', borderStyle: 'solid', marginTop: '10px' } });
      const usadasIdx = new Set();
      const redibujar = () => {
        vaciar(zonaRes).append(elegido.length ? elegido.map(({ t, i }, k) => h('button', { class: 'ficha colocada', onclick: () => { if (respondida) return; elegido.splice(k, 1); usadasIdx.delete(i); redibujar(); } }, t)) : h('span', { class: 'texto-suave' }, 'Toca en orden 👇'));
        vaciar(zonaFichas).append(q.elementos.map((t, i) => usadasIdx.has(i) ? null : h('button', { class: 'ficha', onclick: () => { if (respondida) return; elegido.push({ t, i }); usadasIdx.add(i); redibujar(); if (elegido.length === q.elementos.length) comprobar(); } }, t)));
      };
      const comprobar = () => { const r = elegido.map((x) => x.t); const ok = r.join('|') === q.correcta.join('|'); zonaRes.style.borderColor = ok ? 'var(--verde)' : 'var(--rojo)'; responder(ok, q.correcta.join(q.juntar)); };
      redibujar();
      tablero.append(zonaRes, zonaFichas);
    }
    tablero.append(reaccion);
  }

  const teclas = (e) => { if (!document.body.contains(tablero)) { removeEventListener('keydown', teclas); return; } tablero.tecladoFisico?.(e); };
  addEventListener('keydown', teclas);

  async function final() {
    barra.style.width = '100%';
    const seg = Math.round((Date.now() - inicio) / 1000);
    const estrellas = aciertos >= 9 ? 3 : aciertos >= 7 ? 2 : aciertos >= 5 ? 1 : 0;
    vaciar(tablero).append(h('div', { class: 'celebracion' },
      h('img', { src: mascotaChica(), alt: 'LU' }),
      h('h2', null, aciertos >= 7 ? '¡Excelente trabajo!' : aciertos >= 5 ? '¡Muy bien, sigue practicando!' : '¡Buen intento! Practica otra vez'),
      h('div', { class: 'estrellas' }, '⭐'.repeat(estrellas) + '☆'.repeat(3 - estrellas)),
      h('p', { style: { fontSize: '1.3rem' } }, `Acertaste ${aciertos} de ${RONDAS}`, juego.cronometro ? ` en ${seg} segundos` : '', '.'),
      h('div', { class: 'fila-botones', style: { justifyContent: 'center' } },
        h('button', { class: 'btn verde grande', onclick: () => { ronda = 0; aciertos = 0; inicio = Date.now(); usadas.clear(); siguiente(); } }, '🔁 Jugar otra vez'),
        nivel < 6 && aciertos >= 8 ? h('button', { class: 'btn naranja', onclick: () => navegar(`/juego/${juego.id}/${nivel + 1}`) }, `Subir a nivel ${nivel + 1}° 🚀`) : null,
        h('button', { class: 'btn claro', onclick: () => navegar('/juegos') }, 'Otros juegos'))));
    // Guardar el mejor resultado del alumno (solo él lo puede escribir)
    if (S.yo?.rol === 'alumno') {
      try {
        const k = `${juego.id}-${nivel}`;
        const p = (await store.get('practica', S.uid)) || { juegos: {} };
        const ant = p.juegos?.[k];
        const juegos = { ...(p.juegos || {}), [k]: { mejor: Math.max(aciertos, ant?.mejor || 0), estrellas: Math.max(estrellas, ant?.estrellas || 0), veces: (ant?.veces || 0) + 1 } };
        await store.set('practica', S.uid, { juegos, total: (p.total || 0) + aciertos, actualizado: store.AHORA });
      } catch (e) { console.warn('No se guardó el progreso del juego', e); }
    }
  }
  siguiente();
}
export { mezclar };
