// Panel de administración.
import { h, vaciar, aviso, modal, confirmar, campo, selector, casilla, campoClave, cargando, vacio, fecha, fechaHora, nota100, colorNota,
  descargar, descargarCSV, comprimirImagen, leerArchivoTexto, normalizar, mensajeError, ErrorCesl } from '../ui.js';
import { store, registrar, correoDeUsuario, esCorreoReal } from '../store/index.js';
import { claseDe, ID_SEP } from '../store/permisos.js';
import { S, navegar, grado, materia, recargarCatalogos } from '../app.js';
import { panelConMenu, encabezado, estadoActividad, intentar, ordenar } from './comun.js';
import { rutasContenido, misClases, partesClase, nombreClase } from './docente.js';
import { aplicarTema, inst, logo, mascota } from '../tema.js';
import { INSTITUCION_BASE, COLORES_BASE } from '../semilla.js';
import { servidorConfigurado, llamarServidor, urlImagen, esUrlSegura } from '../drive.js';

const MENU = [
  ['/', '🏠', 'Inicio'], ['/usuarios', '👥', 'Usuarios'], ['/grados', '🎒', 'Grados'], ['/materias', '📚', 'Materias'],
  ['/contenidos', '📁', 'Contenidos'], ['/actividades', '📝', 'Actividades'], ['/calificaciones', '📊', 'Calificaciones'],
  ['/reportes', '📄', 'Reportes'], ['/diseno', '🎨', 'Diseño institucional'], ['/config', '⚙️', 'Configuración'],
  ['/respaldos', '💾', 'Copias de seguridad'], ['/bitacora', '🕑', 'Registro de cambios'], ['/mis-juegos', '🧩', 'Juegos de aprendizaje'], ['/juegos', '🎮', 'Aprende Jugando'],
];
const COLECCIONES = ['config', 'grados', 'materias', 'usuarios', 'temas', 'recursos', 'actividades', 'claves', 'entregas', 'resultados', 'bitacora', 'practica', 'juegos'];

export async function render(raiz, partes, cancelada) {
  const [r, p1, p2] = partes;
  const contenidoRutas = ['clase', 'nueva', 'editar', 'resultados'];
  const activa = contenidoRutas.includes(r) ? '/contenidos' : r === 'juego' ? '/juegos' : '/' + (r || '');
  const cont = panelConMenu(raiz, 'Administración', MENU, activa);
  const rc = rutasContenido(cont, partes);
  if (rc) return rc;
  switch (r) {
    case 'usuarios': return vistaUsuarios(cont, p1 || 'alumno');
    case 'grados': return vistaGrados(cont);
    case 'materias': return vistaMaterias(cont);
    case 'contenidos': return vistaContenidos(cont);
    case 'actividades': return vistaActividades(cont);
    case 'calificaciones': return import('./resultados.js').then((m) => m.renderCalificaciones(cont, misClases()));
    case 'reportes': return vistaReportes(cont);
    case 'diseno': return vistaDiseno(cont);
    case 'config': return vistaConfig(cont);
    case 'respaldos': return vistaRespaldos(cont);
    case 'bitacora': return vistaBitacora(cont);
    case 'mis-juegos': { await asegurarMateriasDocentes(); const m = await import('./juegos-admin.js'); await m.instalarPaquetesIniciales(); return m.renderJuegosAdmin(cont, partes); }
    case 'juegos': case 'juego': return import('../juegos/motor.js').then((m) => (r === 'juego' ? m.renderJuego(cont, p1, Number(p2) || null) : m.renderCatalogo(cont)));
    default: return vistaInicio(cont, cancelada);
  }
}

/** Grados y materias de un docente, calculados de sus clases (los usan las reglas de seguridad). */
const derivados = (clases) => ({ grados: [...new Set(clases.map((c) => c.split(ID_SEP)[0]))], materias: [...new Set(clases.map((c) => c.split(ID_SEP)[1]))] });
/** Completa "materias" en docentes creados antes de la versión 1.1 (necesario para editar juegos). */
async function asegurarMateriasDocentes() {
  try {
    const docs = await store.list('usuarios', [['rol', '==', 'docente']]);
    const ops = docs.filter((u) => JSON.stringify((u.materias || []).slice().sort()) !== JSON.stringify(derivados(u.clases || []).materias.slice().sort()))
      .map((u) => ({ op: 'update', col: 'usuarios', id: u.id, data: derivados(u.clases || []) }));
    if (ops.length) await store.lote(ops);
  } catch (e) { console.warn('No se pudieron actualizar los docentes', e); }
}

// ================================================================== INICIO
async function vistaInicio(cont, cancelada) {
  asegurarMateriasDocentes();
  import('./juegos-admin.js').then((m) => m.instalarPaquetesIniciales());
  cont.append(encabezado('Panel de administración'));
  const zona = h('div'); cont.append(zona); cargando(zona);
  try {
    const [usuarios, acts, res] = await Promise.all([store.list('usuarios'), store.list('actividades'), store.list('resultados')]);
    if (cancelada()) return;
    const al = usuarios.filter((u) => u.rol === 'alumno'); const doc = usuarios.filter((u) => u.rol === 'docente');
    const calif = res.filter((r) => r.estado === 'calificada');
    const prom = calif.length ? Math.round(calif.reduce((s, r) => s + nota100(r.puntaje, r.puntajeMax), 0) / calif.length) : null;
    vaciar(zona).append(
      h('div', { class: 'cifras' },
        h('div', { class: 'cifra', style: { '--c': 'var(--azul)' } }, h('b', null, al.filter((u) => u.activo).length), h('span', null, 'Alumnos activos')),
        h('div', { class: 'cifra', style: { '--c': 'var(--verde)' } }, h('b', null, doc.filter((u) => u.activo).length), h('span', null, 'Docentes activos')),
        h('div', { class: 'cifra', style: { '--c': 'var(--naranja)' } }, h('b', null, acts.filter((a) => a.publicada).length), h('span', null, 'Actividades publicadas')),
        h('div', { class: 'cifra', style: { '--c': 'var(--morado)' } }, h('b', null, res.length), h('span', null, 'Entregas calificadas')),
        h('div', { class: 'cifra', style: { '--c': 'var(--rojo)' } }, h('b', null, prom ?? '—'), h('span', null, 'Promedio general'))),
      h('div', { class: 'rejilla dos' },
        h('section', { class: 'tarjeta' }, h('h2', null, 'Promedio por grado'),
          S.grados.map((g) => { const rs = calif.filter((r) => r.gradoId === g.id); const p = rs.length ? Math.round(rs.reduce((s, r) => s + nota100(r.puntaje, r.puntajeMax), 0) / rs.length) : null;
            return h('div', { class: 'barra-h' }, h('span', null, g.nombre), h('div', { class: 'pista' }, h('div', { style: { width: (p || 0) + '%', background: g.color } })), h('b', null, p ?? '—')); })),
        h('section', { class: 'tarjeta' }, h('h2', null, 'Alumnos por grado'),
          S.grados.map((g) => { const n = al.filter((u) => u.gradoId === g.id && u.activo).length; const max = Math.max(1, ...S.grados.map((x) => al.filter((u) => u.gradoId === x.id && u.activo).length));
            return h('div', { class: 'barra-h' }, h('span', null, g.nombre), h('div', { class: 'pista' }, h('div', { style: { width: (n / max) * 100 + '%', background: g.color } })), h('b', null, n)); }))),
      h('h2', { style: { marginTop: '10px' } }, 'Accesos rápidos'),
      h('div', { class: 'rejilla chica' },
        [['/usuarios/alumno', '🧒', 'Crear alumnos', 'var(--azul)'], ['/usuarios/docente', '👩‍🏫', 'Crear docentes', 'var(--verde)'], ['/contenidos', '📁', 'Contenidos', 'var(--naranja)'],
          ['/calificaciones', '📊', 'Calificaciones', 'var(--morado)'], ['/diseno', '🎨', 'Diseño', 'var(--rojo)'], ['/respaldos', '💾', 'Copia de seguridad', 'var(--marino)']]
          .map(([ruta, ic, t, c]) => h('button', { class: 'mosaico', style: { '--c': c }, onclick: () => navegar(ruta) }, h('span', { class: 'icono' }, ic), t))),
      store.modo === 'firebase' && !servidorConfigurado() ? h('div', { class: 'mensaje-info', style: { marginTop: '16px' } }, '💡 Falta conectar Google Apps Script. Sin él no se pueden restablecer contraseñas de alumnos ni subir archivos directamente a Drive. Vea "Configuración".') : null);
  } catch (e) { vaciar(zona).append(vacio(mensajeError(e))); }
}

// ================================================================== USUARIOS
function generarClave(rol) {
  const n = new Uint32Array(3); crypto.getRandomValues(n);
  if (rol === 'alumno') return String(100000 + (n[0] % 900000)); // PIN de 6 números
  const letras = 'abcdefghjkmnpqrstuvwxyz'; const nums = '23456789';
  return letras[n[0] % 23] + letras[(n[0] >> 8) % 23] + letras[(n[0] >> 16) % 23] + letras[n[1] % 23] + nums[n[1] % 8] + nums[(n[1] >> 8) % 8] + nums[n[2] % 8] + nums[(n[2] >> 8) % 8];
}
function sugerirUsuario(nombre) {
  const p = normalizar(nombre).replace(/[^a-z ]/g, '').split(' ').filter(Boolean);
  return p.length > 1 ? `${p[0]}.${p.length > 2 ? p[2] : p[1]}` : p[0] || '';
}
const ROL_T = { alumno: 'Alumnos', docente: 'Docentes', admin: 'Administración' };

async function vistaUsuarios(cont, rol) {
  cont.append(encabezado('👥 Usuarios',
    h('button', { class: 'btn verde', onclick: () => editarUsuario(null, rol, () => navegar('/usuarios/' + rol)) }, `➕ Nuevo ${rol === 'alumno' ? 'alumno' : rol === 'docente' ? 'docente' : 'administrador'}`),
    rol === 'alumno' ? h('button', { class: 'btn claro', onclick: importarAlumnos }, '📥 Importar lista') : null));
  cont.append(h('div', { class: 'fila-botones', style: { marginBottom: '14px' } }, Object.entries(ROL_T).map(([k, t]) =>
    h('button', { class: 'btn chico ' + (k === rol ? '' : 'claro'), onclick: () => navegar('/usuarios/' + k) }, t))));
  const buscar = h('input', { type: 'search', placeholder: 'Buscar por nombre o usuario…' });
  const filtroG = selector([['', 'Todos los grados'], ...S.grados.map((g) => [g.id, g.nombre])], '');
  const filtroE = selector([['', 'Activos e inactivos'], ['1', 'Solo activos'], ['0', 'Solo desactivados']], '');
  const zona = h('div');
  cont.append(h('div', { class: 'form-rejilla' }, campo('Buscar', buscar), rol === 'alumno' ? campo('Grado', filtroG) : h('span'), campo('Estado', filtroE)), zona);
  cargando(zona);
  let lista;
  try { lista = await store.list('usuarios', [['rol', '==', rol]]); } catch (e) { vaciar(zona).append(vacio(mensajeError(e))); return; }
  lista.sort((a, b) => (a.gradoId || '').localeCompare(b.gradoId || '') || a.nombre.localeCompare(b.nombre));
  const recargar = () => navegar('/usuarios/' + rol);
  const pintar = () => {
    const q = normalizar(buscar.value);
    const f = lista.filter((u) => (!q || normalizar(u.nombre + ' ' + u.usuario).includes(q)) && (!filtroG.value || u.gradoId === filtroG.value) && (!filtroE.value || String(Number(!!u.activo)) === filtroE.value));
    vaciar(zona).append(h('p', { class: 'texto-suave' }, `${f.length} usuario(s)`),
      f.length ? h('div', { class: 'tabla-envoltura' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, 'Nombre'), h('th', null, 'Usuario para entrar'), h('th', null, rol === 'alumno' ? 'Grado' : rol === 'docente' ? 'Clases asignadas' : ''), h('th', null, 'Estado'), h('th', null, ''))),
        h('tbody', null, f.map((u) => h('tr', null,
          h('td', null, h('b', null, u.nombre)),
          h('td', null, u.usuario, u.debeCambiarPassword ? h('div', { class: 'chico texto-suave' }, '🔑 contraseña temporal') : null),
          h('td', null, rol === 'alumno' ? `${grado(u.gradoId).nombre}${u.seccion ? ' · ' + u.seccion : ''}` : rol === 'docente' ? h('span', { class: 'chico' }, (u.clases || []).map(nombreClase).join(' · ') || '—') : ''),
          h('td', null, h('span', { class: 'etiqueta-estado ' + (u.activo ? 'e-verde' : 'e-rojo') }, u.activo ? 'Activo' : 'Desactivado')),
          h('td', null, h('div', { class: 'fila-botones' },
            h('button', { class: 'btn claro chico', onclick: () => editarUsuario(u, rol, recargar) }, '✏️ Editar'),
            h('button', { class: 'btn claro chico', onclick: () => restablecer(u, recargar) }, '🔑 Restablecer'),
            u.id !== S.uid ? h('button', { class: 'btn chico ' + (u.activo ? 'peligro' : 'verde'), onclick: () => cambiarActivo(u, recargar) }, u.activo ? '⛔ Desactivar' : '✅ Activar') : null,
            u.id !== S.uid ? h('button', { class: 'btn peligro chico', title: 'Eliminar', onclick: () => eliminarUsuario(u, recargar) }, '🗑️') : null)))))))
      : vacio('No hay usuarios con estos filtros.'));
  };
  buscar.oninput = pintar; filtroG.onchange = pintar; filtroE.onchange = pintar;
  pintar();
}

function selectorClases(actuales = []) {
  const caja = h('div', { class: 'tabla-envoltura' });
  const tabla = h('table', null, h('thead', null, h('tr', null, h('th', null, 'Materia'), S.grados.map((g) => h('th', { class: 'num' }, g.corto || g.nombre)))),
    h('tbody', null, S.materias.map((m) => h('tr', null, h('td', null, `${m.icono || ''} ${m.nombre}`), S.grados.map((g) => h('td', { class: 'num' },
      (m.grados || []).includes(g.id) ? h('input', { type: 'checkbox', value: claseDe(g.id, m.id), checked: actuales.includes(claseDe(g.id, m.id)), style: { width: '26px', height: '26px' }, 'aria-label': `${m.nombre} ${g.nombre}` }) : h('span', { class: 'texto-suave' }, '·')))))));
  caja.append(tabla);
  caja.valor = () => [...caja.querySelectorAll('input:checked')].map((i) => i.value);
  return caja;
}

function editarUsuario(u, rol, listo) {
  const esNuevo = !u;
  rol = u?.rol || rol;
  const nombre = h('input', { type: 'text', value: u?.nombre || '', placeholder: 'Nombre y apellido' });
  const usuario = h('input', { type: 'text', value: u?.usuario || '', disabled: !esNuevo, autocapitalize: 'none', placeholder: 'ejemplo: ana.lopez' });
  const correo = h('input', { type: 'email', value: esCorreoReal(u?.email) ? u.email : '', disabled: !esNuevo, placeholder: 'opcional' });
  if (esNuevo) nombre.oninput = () => { if (!usuario.dataset.tocado) usuario.value = sugerirUsuario(nombre.value); };
  usuario.oninput = () => { usuario.dataset.tocado = '1'; };
  const selG = selector(S.grados.map((g) => [g.id, g.nombre]), u?.gradoId || S.grados[0]?.id);
  const selS = h('select');
  const llenarS = () => { const g = S.grados.find((x) => x.id === selG.value); vaciar(selS).append((g?.secciones?.length ? g.secciones : ['A']).map((s) => h('option', { value: s, selected: s === u?.seccion }, s))); };
  selG.onchange = llenarS; llenarS();
  const clases = selectorClases(u?.clases || []);
  const clave = h('input', { type: 'text', value: generarClave(rol), autocomplete: 'off' });
  const obligar = casilla('Pedir que cambie la contraseña al entrar por primera vez', rol !== 'alumno');
  modal({
    titulo: esNuevo ? `Nuevo ${rol === 'alumno' ? 'alumno' : rol === 'docente' ? 'docente' : 'administrador'}` : `Editar: ${u.nombre}`, ancho: rol === 'docente',
    contenido: h('div', null,
      campo('Nombre completo', nombre),
      h('div', { class: 'form-rejilla' },
        campo('Usuario', usuario, esNuevo ? 'Solo letras, números y puntos. No se puede cambiar después.' : 'El usuario no se puede cambiar.'),
        rol !== 'alumno' ? campo('Correo real (opcional)', correo, 'Si lo escribe, entrará con su correo y podrá recuperar su contraseña solo.') : null),
      rol === 'alumno' ? h('div', { class: 'form-rejilla' }, campo('Grado', selG), campo('Sección', selS)) : null,
      rol === 'docente' ? h('div', null, h('p', { class: 'etiqueta' }, 'Grados y materias que imparte'), h('p', { class: 'chico texto-suave' }, 'Marque cada casilla de grado y materia. El docente solo verá lo que esté marcado.'), clases) : null,
      esNuevo ? h('div', { style: { marginTop: '14px' } }, campo(rol === 'alumno' ? 'Contraseña temporal (PIN)' : 'Contraseña temporal', clave, 'Puede cambiarla. Mínimo 6 caracteres.'), obligar) : null),
    botones: [{ texto: 'Cancelar', clase: 'claro' }, { texto: 'Guardar', clase: 'verde', accion: async () => {
      const n = nombre.value.trim();
      if (!n) { aviso('Escriba el nombre.', 'error'); return false; }
      const datos = { nombre: n, rol };
      if (rol === 'alumno') { datos.gradoId = selG.value; datos.seccion = selS.value; }
      if (rol === 'docente') { datos.clases = clases.valor(); Object.assign(datos, derivados(datos.clases)); }
      if (!esNuevo) {
        await store.update('usuarios', u.id, { ...datos, actualizado: store.AHORA });
        registrar('Editó usuario', `${n} (${u.usuario})`, S.yo); aviso('Usuario actualizado', 'ok'); listo(); return;
      }
      const us = normalizar(usuario.value).replace(/[^a-z0-9._-]/g, '');
      const real = correo.value.trim().toLowerCase();
      if (!us && !real) { aviso('Escriba un usuario.', 'error'); return false; }
      if (real && !esCorreoReal(real)) { aviso('El correo no es válido.', 'error'); return false; }
      if (clave.value.length < 6) { aviso('La contraseña debe tener al menos 6 caracteres.', 'error'); return false; }
      const email = real || correoDeUsuario(us);
      const uid = await crearOReutilizarCuenta(email, clave.value);
      try {
        await store.set('usuarios', uid, { ...datos, usuario: real || us, email, activo: true, debeCambiarPassword: obligar.querySelector('input').checked, creado: store.AHORA });
      } catch (e) { throw new ErrorCesl('perfil', 'Se creó el acceso pero no el perfil: ' + mensajeError(e) + ' Intente "Restablecer" o consulte el manual.'); }
      registrar('Creó usuario', `${n} (${real || us}) — ${rol}`, S.yo);
      tarjetaCredenciales([{ nombre: n, usuario: real || us, clave: clave.value, grado: datos.gradoId ? grado(datos.gradoId).nombre : '' }]);
      listo();
    } }],
  });
}

/** Muestra (una sola vez) las credenciales para entregarlas al usuario. Nunca se guardan. */
function tarjetaCredenciales(lista) {
  const imprimir = () => {
    const w = open('', '_blank');
    if (!w) { aviso('Permita ventanas emergentes para imprimir.', 'error'); return; }
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Credenciales</title><style>body{font-family:sans-serif}div{border:2px dashed #999;border-radius:12px;padding:12px 16px;margin:10px;display:inline-block;width:300px;vertical-align:top}b{font-size:1.3em}</style>` +
      lista.map((c) => `<div><p>${esc(inst.nombrePlataforma)}<br><strong>${esc(c.nombre)}</strong> ${esc(c.grado || '')}</p><p>Usuario: <b>${esc(c.usuario)}</b><br>Contraseña: <b>${esc(c.clave)}</b></p><small>Dirección: ${esc(location.origin + location.pathname)}</small></div>`).join(''));
    w.document.close(); w.print();
  };
  modal({ titulo: '✅ Listo. Entregue estos datos', ancho: lista.length > 1,
    contenido: h('div', null,
      h('div', { class: 'mensaje-info' }, 'Por seguridad, la contraseña NO se guarda en ningún lugar y no se volverá a mostrar. Imprímala o anótela ahora.'),
      lista.length <= 3 ? lista.map((c) => h('div', { class: 'tarjeta plana' }, h('b', null, c.nombre), h('p', null, 'Usuario para entrar:'), h('div', { class: 'clave-temporal' }, c.usuario), h('p', null, 'Contraseña:'), h('div', { class: 'clave-temporal' }, c.clave)))
        : h('p', null, `Se crearon ${lista.length} cuentas. Descargue o imprima la lista.`)),
    botones: [
      { texto: '⬇️ Descargar lista', clase: 'claro', accion: () => { descargarCSV('credenciales-cesl', [['Nombre', 'Grado', 'Usuario', 'Contraseña'], ...lista.map((c) => [c.nombre, c.grado, c.usuario, c.clave])]); return false; } },
      { texto: '🖨️ Imprimir', clase: 'claro', accion: () => { imprimir(); return false; } },
      { texto: 'Ya los anoté', clase: 'verde' }] });
}

async function restablecer(u, listo) {
  const nueva = generarClave(u.rol);
  const obligar = casilla('Pedir que la cambie al entrar', u.rol !== 'alumno');
  const real = esCorreoReal(u.email);
  if (store.modo === 'firebase' && !servidorConfigurado()) {
    await modal({ titulo: 'Restablecer acceso', contenido: h('div', null,
      real ? h('p', null, `Se puede enviar un enlace de recuperación al correo ${u.email}.`) : null,
      h('div', { class: 'mensaje-info' }, 'Para poner una contraseña nueva directamente (alumnos sin correo) hay que conectar Google Apps Script (Manual de instalación, paso 7).')),
    botones: [{ texto: 'Cerrar', clase: 'claro' }, real ? { texto: 'Enviar enlace al correo', clase: 'verde', accion: async () => { await store.auth.recuperar(u.email); registrar('Envió enlace de recuperación', u.usuario, S.yo); aviso('Enlace enviado', 'ok'); } } : null].filter(Boolean) });
    return;
  }
  const ok = await modal({ titulo: `Restablecer acceso de ${u.nombre}`, contenido: h('div', null,
    h('p', null, 'Se creará una contraseña temporal nueva. La anterior dejará de funcionar.'), obligar,
    real ? h('p', { class: 'chico texto-suave' }, `También puede enviar un enlace de recuperación a ${u.email}.`) : null),
  botones: [{ texto: 'Cancelar', clase: 'claro', valor: false },
    real ? { texto: 'Enviar enlace al correo', clase: 'claro', accion: async () => { await store.auth.recuperar(u.email); aviso('Enlace enviado', 'ok'); return 'correo'; } } : null,
    { texto: 'Crear contraseña temporal', clase: 'verde', valor: true }].filter(Boolean) });
  if (ok !== true) return;
  await intentar(async () => {
    await store.admin.restablecerClave(u.id, nueva);
    await store.update('usuarios', u.id, { debeCambiarPassword: obligar.querySelector('input').checked });
    registrar('Restableció contraseña', u.usuario, S.yo);
    tarjetaCredenciales([{ nombre: u.nombre, usuario: u.usuario, clave: nueva, grado: u.gradoId ? grado(u.gradoId).nombre : '' }]);
    listo();
  });
}

async function cambiarActivo(u, listo) {
  const activar = !u.activo;
  if (!activar && !(await confirmar(`${u.nombre} ya no podrá entrar a la plataforma. Sus notas y entregas se conservan. Puede activarlo de nuevo cuando quiera.`, { si: 'Desactivar' }))) return;
  await intentar(async () => {
    await store.update('usuarios', u.id, { activo: activar });
    try { await store.admin.estadoCuenta(u.id, activar); } catch (e) { console.warn(e); }
    registrar(activar ? 'Activó usuario' : 'Desactivó usuario', u.usuario, S.yo);
  }, activar ? 'Usuario activado' : 'Usuario desactivado');
  listo();
}

async function eliminarUsuario(u, listo) {
  const ok = await confirmar(h('div', null, h('p', null, `¿Eliminar a ${u.nombre}?`),
    h('p', { class: 'mensaje-error' }, 'Recomendación: use "Desactivar". Eliminar borra el perfil y la cuenta de acceso; las notas ya registradas se conservan.')), { si: 'Eliminar definitivamente' });
  if (!ok) return;
  // 1) Primero la cuenta de acceso; si falla, se avisa en lugar de dejarla "huérfana" sin decir nada.
  try { await store.admin.borrarCuenta(u.id); }
  catch (e) {
    const seguir = await modal({ titulo: 'No se pudo borrar la cuenta de acceso', contenido: h('div', null,
      h('p', { class: 'mensaje-error' }, mensajeError(e)),
      h('p', null, 'Si continúa, se borrará solo el perfil y el usuario ', h('b', null, u.usuario), ' quedará ocupado. Podrá reutilizarlo al crearlo de nuevo, o borrarlo en la consola de Firebase → Authentication → Usuarios.'),
      h('p', null, 'Mejor opción: use "Desactivar" y revise Configuración → Probar conexión.')),
    botones: [{ texto: 'Cancelar', clase: 'claro', valor: false }, { texto: 'Borrar solo el perfil', clase: 'rojo', valor: true }] });
    if (!seguir) return;
  }
  await intentar(async () => {
    await store.del('usuarios', u.id);
    registrar('Eliminó usuario', `${u.nombre} (${u.usuario})`, S.yo);
  }, 'Usuario eliminado');
  listo();
}

/** Crea la cuenta de acceso; si ya existe una cuenta sin perfil (de un usuario eliminado), ofrece reutilizarla. */
async function crearOReutilizarCuenta(email, clave, preguntar = true) {
  try { return await store.admin.crearCuenta(email, clave); }
  catch (e) {
    if (e.code !== 'auth/email-already-in-use') throw e;
    if (preguntar) {
      const si = await modal({ titulo: 'Ese usuario ya tiene una cuenta de acceso', contenido: h('div', null,
        h('p', null, `Ya existe una cuenta de acceso para "${email.split('@')[0]}". Suele pasar cuando un usuario se eliminó antes.`),
        h('p', null, 'Si nadie más la está usando, se puede reutilizar con la contraseña nueva.')),
      botones: [{ texto: 'Cancelar', clase: 'claro', valor: false }, { texto: 'Reutilizar la cuenta', clase: 'verde', valor: true }] });
      if (!si) throw new ErrorCesl('cancelado', 'Operación cancelada. Puede elegir otro usuario.');
    }
    return await store.admin.recuperarCuenta(email, clave);
  }
}

async function importarAlumnos() {
  const archivo = h('input', { type: 'file', accept: '.csv,.txt' });
  const texto = h('textarea', { placeholder: 'Nombre, Grado, Sección\nAna López, 1, A\nLuis Pérez, 3, B', style: { minHeight: '160px' } });
  const r = await modal({ titulo: 'Importar alumnos', ancho: true, contenido: h('div', null,
    h('p', null, 'Pegue la lista (puede copiarla desde Excel o Google Sheets) o elija un archivo CSV. Una fila por alumno: ', h('b', null, 'Nombre, Grado (1 a 6), Sección'), '. La columna Usuario es opcional (Nombre, Grado, Sección, Usuario).'),
    campo('Archivo CSV (opcional)', archivo), campo('Lista', texto)),
  botones: [{ texto: 'Cancelar', clase: 'claro', valor: null }, { texto: 'Revisar', clase: 'verde', accion: async () => (archivo.files[0] ? await leerArchivoTexto(archivo.files[0]) : texto.value) }] });
  if (!r) return;
  const filas = r.split(/\r?\n/).map((l) => l.split(/\t|;|,/).map((x) => x.trim())).filter((f) => f[0] && !/^nombre$/i.test(f[0]));
  const buscarGrado = (v) => S.grados.find((g) => g.id === v || String(g.orden) === String(v).replace(/[^0-9]/g, '') || normalizar(g.nombre) === normalizar(v) || normalizar(g.corto) === normalizar(v));
  const lista = filas.map(([nombre, g, sec, us]) => ({ nombre, grado: buscarGrado(g || ''), seccion: (sec || 'A').toUpperCase(), usuario: (us ? normalizar(us) : sugerirUsuario(nombre)).replace(/[^a-z0-9._-]/g, '') }));
  const malos = lista.filter((x) => !x.grado || !x.usuario);
  if (!lista.length) { aviso('No se encontraron filas.', 'error'); return; }
  const usados = new Set();
  for (const x of lista) { let base = x.usuario; let k = 2; while (usados.has(x.usuario)) x.usuario = base + k++; usados.add(x.usuario); }
  const seguir = await modal({ titulo: `Se crearán ${lista.length - malos.length} alumnos`, ancho: true, contenido: h('div', null,
    malos.length ? h('div', { class: 'mensaje-error' }, `${malos.length} fila(s) tienen el grado mal escrito y se omitirán: ${malos.map((m) => m.nombre).join(', ')}`) : null,
    h('div', { class: 'tabla-envoltura', style: { maxHeight: '300px', overflow: 'auto' } }, h('table', null, h('tbody', null, lista.filter((x) => x.grado).map((x) => h('tr', null, h('td', null, x.nombre), h('td', null, x.grado.nombre), h('td', null, x.seccion), h('td', null, x.usuario))))))),
  botones: [{ texto: 'Cancelar', clase: 'claro', valor: false }, { texto: 'Crear cuentas', clase: 'verde', valor: true }] });
  if (!seguir) return;
  const creadas = []; const errores = [];
  const prog = h('p', null, 'Creando…');
  const fondo = h('div', { class: 'modal-fondo' }, h('div', { class: 'modal' }, h('h2', null, 'Creando cuentas'), prog));
  document.getElementById('modal-raiz').append(fondo);
  for (const [i, x] of lista.filter((y) => y.grado).entries()) {
    prog.textContent = `Creando ${i + 1} de ${lista.length - malos.length}: ${x.nombre}`;
    const clave = generarClave('alumno');
    try {
      const email = correoDeUsuario(x.usuario);
      const uid = await crearOReutilizarCuenta(email, clave, false);
      await store.set('usuarios', uid, { nombre: x.nombre, rol: 'alumno', usuario: x.usuario, email, gradoId: x.grado.id, seccion: x.seccion, activo: true, debeCambiarPassword: false, creado: store.AHORA });
      creadas.push({ nombre: x.nombre, usuario: x.usuario, clave, grado: x.grado.nombre });
    } catch (e) { errores.push(`${x.nombre}: ${mensajeError(e)}`); }
  }
  fondo.remove();
  registrar('Importó alumnos', `${creadas.length} creados, ${errores.length} con error`, S.yo);
  if (errores.length) await modal({ titulo: 'Algunas cuentas no se crearon', contenido: h('ul', null, errores.map((e) => h('li', null, e))) });
  if (creadas.length) tarjetaCredenciales(creadas);
  navegar('/usuarios/alumno');
}

// ================================================================== GRADOS
async function vistaGrados(cont) {
  await recargarCatalogos();
  const listo = () => recargarCatalogos().then(() => vistaGradosOtraVez(cont));
  cont.append(encabezado('🎒 Grados y secciones', h('button', { class: 'btn verde', onclick: () => editarGrado(null, listo) }, '➕ Nuevo grado')),
    h('p', { class: 'texto-suave' }, 'Puede cambiar nombres, agregar secciones (A, B, C…) o crear grupos nuevos.'),
    h('div', { class: 'rejilla' }, S.grados.map((g) => h('div', { class: 'tarjeta', style: { borderTop: `8px solid ${g.color}` } },
      h('h2', null, `${g.corto || ''} ${g.nombre}`), h('p', null, 'Secciones: ', h('b', null, (g.secciones || []).join(', ') || '—')),
      g.activo === false ? h('p', null, h('span', { class: 'etiqueta-estado e-gris' }, 'Inactivo')) : null,
      h('div', { class: 'fila-botones' }, h('button', { class: 'btn claro chico', onclick: () => editarGrado(g, listo) }, '✏️ Editar'),
        h('button', { class: 'btn peligro chico', onclick: () => borrarGrado(g, listo) }, '🗑️'))))));
}
function vistaGradosOtraVez(cont) { vaciar(cont); vistaGrados(cont); }
const COLORES_OPC = [['var(--azul)', 'Azul'], ['var(--verde)', 'Verde'], ['var(--naranja)', 'Naranja'], ['var(--rojo)', 'Rojo'], ['var(--amarillo)', 'Amarillo'], ['var(--morado)', 'Morado'], ['var(--celeste)', 'Celeste'], ['var(--marino)', 'Azul marino']];
function editarGrado(g, listo) {
  const nombre = h('input', { type: 'text', value: g?.nombre || '', placeholder: 'Ejemplo: Primero primaria' });
  const corto = h('input', { type: 'text', value: g?.corto || '', placeholder: '1°' });
  const orden = h('input', { type: 'number', value: g?.orden ?? S.grados.length + 1 });
  const secciones = h('input', { type: 'text', value: (g?.secciones || ['A']).join(', ') });
  const color = selector(COLORES_OPC, g?.color || 'var(--azul)');
  const act = casilla('Grado activo', g ? g.activo !== false : true);
  modal({ titulo: g ? 'Editar grado' : 'Nuevo grado', contenido: h('div', null, campo('Nombre', nombre),
    h('div', { class: 'form-rejilla' }, campo('Abreviatura', corto), campo('Orden', orden), campo('Color', color)),
    campo('Secciones', secciones, 'Separadas por coma. Ejemplo: A, B'), act),
  botones: [{ texto: 'Cancelar', clase: 'claro' }, { texto: 'Guardar', clase: 'verde', accion: async () => {
    if (!nombre.value.trim()) { aviso('Escriba el nombre.', 'error'); return false; }
    const data = { nombre: nombre.value.trim(), corto: corto.value.trim(), orden: Number(orden.value) || 0, color: color.value,
      secciones: secciones.value.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean), activo: act.querySelector('input').checked };
    if (g) await store.update('grados', g.id, data); else await store.set('grados', 'g' + store.nuevoId(), data);
    registrar(g ? 'Editó grado' : 'Creó grado', data.nombre, S.yo); aviso('Grado guardado', 'ok'); listo();
  } }] });
}
async function borrarGrado(g, listo) {
  const al = await store.list('usuarios', [['rol', '==', 'alumno'], ['gradoId', '==', g.id]]);
  if (al.length) { await modal({ titulo: 'No se puede eliminar', contenido: `Hay ${al.length} alumno(s) en ${g.nombre}. Muévalos a otro grado o desactive el grado.` }); return; }
  if (!(await confirmar(`¿Eliminar ${g.nombre}?`))) return;
  await intentar(() => store.del('grados', g.id), 'Grado eliminado'); registrar('Eliminó grado', g.nombre, S.yo); listo();
}

// ================================================================== MATERIAS
const ICONOS = ['📖', '🔢', '🔬', '🌎', '🌱', '🇬🇹', '🤝', '🎨', '💻', '🎵', '⚽', '🗣️', '✝️', '🧮', '📐', '🧪', '🌍', '📚', '✏️', '🏃'];
async function vistaMaterias(cont) {
  await recargarCatalogos();
  const listo = () => recargarCatalogos().then(() => { vaciar(cont); vistaMaterias(cont); });
  cont.append(encabezado('📚 Materias', h('button', { class: 'btn verde', onclick: () => editarMateria(null, listo) }, '➕ Nueva materia')),
    h('p', { class: 'texto-suave' }, 'Marque en qué grados se imparte cada materia.'),
    h('div', { class: 'lista' }, S.materias.map((m) => h('div', { class: 'item' + (m.visible === false ? ' inactivo' : ''), style: { cursor: 'default' } },
      h('span', { class: 'ic-redondo', style: { '--c': m.color } }, m.icono || '📘'),
      h('div', { class: 'cuerpo' }, h('strong', null, m.nombre), h('small', null, (m.grados || []).map((g) => grado(g).corto || grado(g).nombre).join(' · ') || 'Sin grados', m.visible === false ? ' · Oculta' : '')),
      h('div', { class: 'fila-botones' }, h('button', { class: 'btn claro chico', onclick: () => editarMateria(m, listo) }, '✏️ Editar'),
        h('button', { class: 'btn peligro chico', onclick: async () => {
          if (await confirmar(`¿Eliminar la materia "${m.nombre}"? Si solo quiere quitarla por un tiempo, use Editar → Oculta.`)) { await intentar(() => store.del('materias', m.id), 'Materia eliminada'); registrar('Eliminó materia', m.nombre, S.yo); listo(); }
        } }, '🗑️'))))));
}
function editarMateria(m, listo) {
  const nombre = h('input', { type: 'text', value: m?.nombre || '' });
  let icono = m?.icono || '📘';
  const iconos = h('div', { class: 'fila-botones' });
  const pintarIconos = () => vaciar(iconos).append(ICONOS.map((ic) => h('button', { type: 'button', class: 'btn chico ' + (ic === icono ? '' : 'claro'), onclick: () => { icono = ic; pintarIconos(); } }, ic)));
  pintarIconos();
  const color = selector(COLORES_OPC, m?.color || 'var(--azul)');
  const orden = h('input', { type: 'number', value: m?.orden ?? S.materias.length + 1 });
  const grados = h('div', { class: 'fila-botones' }, S.grados.map((g) => casilla(g.nombre, (m?.grados || []).includes(g.id), { value: g.id })));
  const vis = casilla('Visible', m ? m.visible !== false : true);
  modal({ titulo: m ? 'Editar materia' : 'Nueva materia', ancho: true, contenido: h('div', null, campo('Nombre', nombre), h('p', { class: 'etiqueta' }, 'Ícono'), iconos,
    h('div', { class: 'form-rejilla', style: { marginTop: '12px' } }, campo('Color', color), campo('Orden', orden)),
    h('p', { class: 'etiqueta' }, 'Grados donde se imparte'), grados, vis),
  botones: [{ texto: 'Cancelar', clase: 'claro' }, { texto: 'Guardar', clase: 'verde', accion: async () => {
    if (!nombre.value.trim()) { aviso('Escriba el nombre.', 'error'); return false; }
    const data = { nombre: nombre.value.trim(), icono, color: color.value, orden: Number(orden.value) || 0, visible: vis.querySelector('input').checked,
      grados: [...grados.querySelectorAll('input:checked')].map((i) => i.value) };
    if (m) await store.update('materias', m.id, data);
    else { const base = normalizar(data.nombre).replace(/[^a-z0-9]+/g, '-').slice(0, 30) || 'materia'; await store.set('materias', S.materias.some((x) => x.id === base) ? base + '-' + store.nuevoId().slice(-4) : base, data); }
    registrar(m ? 'Editó materia' : 'Creó materia', data.nombre, S.yo); aviso('Materia guardada', 'ok'); listo();
  } }] });
}

// ================================================================== CONTENIDOS Y ACTIVIDADES
function vistaContenidos(cont) {
  cont.append(encabezado('📁 Contenidos por grado y materia'),
    h('p', { class: 'texto-suave' }, 'Elija una clase para ver o administrar sus temas, materiales y actividades.'));
  for (const g of S.grados) {
    const ms = S.materias.filter((m) => (m.grados || []).includes(g.id));
    if (!ms.length) continue;
    cont.append(h('section', { class: 'tarjeta' }, h('h2', null, g.nombre), h('div', { class: 'rejilla chica' }, ms.map((m) =>
      h('button', { class: 'mosaico', style: { '--c': m.color, minHeight: '110px', fontSize: '1rem' }, onclick: () => navegar('/clase/' + encodeURIComponent(claseDe(g.id, m.id))) }, h('span', { class: 'icono', style: { fontSize: '2rem' } }, m.icono), m.nombre)))));
  }
}

async function vistaActividades(cont) {
  cont.append(encabezado('📝 Todas las actividades'));
  const fG = selector([['', 'Todos los grados'], ...S.grados.map((g) => [g.id, g.nombre])], '');
  const fM = selector([['', 'Todas las materias'], ...S.materias.map((m) => [m.id, m.nombre])], '');
  const zona = h('div');
  cont.append(h('div', { class: 'form-rejilla' }, campo('Grado', fG), campo('Materia', fM)), zona);
  cargando(zona);
  let acts, usuarios;
  try { [acts, usuarios] = await Promise.all([store.list('actividades'), store.list('usuarios', [['rol', 'in', ['docente', 'admin']]])]); } catch (e) { vaciar(zona).append(vacio(mensajeError(e))); return; }
  const autor = (id) => usuarios.find((u) => u.id === id)?.nombre || '—';
  acts.sort((a, b) => (b.creado || 0) - (a.creado || 0));
  const pintar = () => {
    const f = acts.filter((a) => (!fG.value || a.gradoId === fG.value) && (!fM.value || a.materiaId === fM.value));
    vaciar(zona).append(f.length ? h('div', { class: 'tabla-envoltura' }, h('table', null,
      h('thead', null, h('tr', null, ['Actividad', 'Grado', 'Materia', 'Docente', 'Creada', 'Estado', ''].map((t) => h('th', null, t)))),
      h('tbody', null, f.map((a) => { const [t, c] = estadoActividad(a); return h('tr', null, h('td', null, h('b', null, a.titulo)), h('td', null, grado(a.gradoId).nombre), h('td', null, materia(a.materiaId).nombre),
        h('td', null, autor(a.autorId)), h('td', null, fecha(a.creado)), h('td', null, h('span', { class: 'etiqueta-estado ' + c }, t)),
        h('td', null, h('div', { class: 'fila-botones' }, h('button', { class: 'btn chico', onclick: () => navegar('/resultados/' + a.id) }, '📊'), h('button', { class: 'btn claro chico', onclick: () => navegar('/editar/' + a.id) }, '✏️')))); })))) : vacio('No hay actividades.'));
  };
  fG.onchange = pintar; fM.onchange = pintar; pintar();
}

// ================================================================== REPORTES
function vistaReportes(cont) {
  const rep = (titulo, desc, fn) => h('div', { class: 'tarjeta' }, h('h3', null, titulo), h('p', { class: 'texto-suave' }, desc),
    h('button', { class: 'btn', onclick: async (e) => { const b = e.currentTarget; b.disabled = true; try { await fn(); } catch (err) { aviso(mensajeError(err), 'error'); } b.disabled = false; } }, '⬇️ Descargar'));
  const hoy = new Date().toISOString().slice(0, 10);
  cont.append(encabezado('📄 Reportes'), h('p', { class: 'texto-suave' }, 'Los reportes se descargan en formato CSV, que se abre con Excel o Google Sheets (Archivo → Importar).'),
    h('div', { class: 'rejilla dos' },
      rep('Listado de alumnos', 'Nombre, usuario, grado, sección y estado de cada alumno.', async () => {
        const us = await store.list('usuarios', [['rol', '==', 'alumno']]);
        descargarCSV(`alumnos-${hoy}`, [['Nombre', 'Usuario', 'Grado', 'Sección', 'Estado'], ...us.sort((a, b) => (a.gradoId || '').localeCompare(b.gradoId || '') || a.nombre.localeCompare(b.nombre)).map((u) => [u.nombre, u.usuario, grado(u.gradoId).nombre, u.seccion || '', u.activo ? 'Activo' : 'Desactivado'])]);
      }),
      rep('Docentes y asignaciones', 'Cada docente con los grados y materias que tiene asignados.', async () => {
        const us = await store.list('usuarios', [['rol', '==', 'docente']]);
        const f = [['Docente', 'Usuario', 'Grado', 'Materia', 'Estado']];
        for (const u of us) { if (!(u.clases || []).length) f.push([u.nombre, u.usuario, '', '', u.activo ? 'Activo' : 'Desactivado']); for (const c of u.clases || []) { const p = partesClase(c); f.push([u.nombre, u.usuario, grado(p.gradoId).nombre, materia(p.materiaId).nombre, u.activo ? 'Activo' : 'Desactivado']); } }
        descargarCSV(`docentes-${hoy}`, f);
      }),
      rep('Todas las calificaciones', 'Cada entrega calificada: alumno, actividad, materia, grado, intento y nota.', async () => {
        const [res, us] = await Promise.all([store.list('resultados'), store.list('usuarios', [['rol', '==', 'alumno']])]);
        const nom = (id) => us.find((u) => u.id === id);
        descargarCSV(`calificaciones-${hoy}`, [['Alumno', 'Usuario', 'Grado', 'Sección', 'Materia', 'Actividad', 'Intento', 'Puntos', 'Puntos posibles', 'Nota (100)', 'Estado', 'Fecha'],
          ...res.map((r) => [r.alumnoNombre || nom(r.alumnoId)?.nombre || '', nom(r.alumnoId)?.usuario || '', grado(r.gradoId).nombre, r.seccion || '', materia(r.materiaId).nombre, r.titulo || '', r.intento, r.puntaje, r.puntajeMax, nota100(r.puntaje, r.puntajeMax), r.estado === 'revision' ? 'Por revisar' : 'Calificada', fecha(r.calificado)])]);
      }),
      rep('Resumen por grado y materia', 'Promedio, número de entregas y actividades publicadas por cada grado y materia.', async () => {
        const [res, acts] = await Promise.all([store.list('resultados'), store.list('actividades')]);
        const f = [['Grado', 'Materia', 'Actividades publicadas', 'Entregas calificadas', 'Promedio (100)']];
        for (const g of S.grados) for (const m of S.materias.filter((x) => (x.grados || []).includes(g.id))) {
          const rs = res.filter((r) => r.gradoId === g.id && r.materiaId === m.id && r.estado === 'calificada');
          f.push([g.nombre, m.nombre, acts.filter((a) => a.gradoId === g.id && a.materiaId === m.id && a.publicada).length, rs.length, rs.length ? Math.round(rs.reduce((s, r) => s + nota100(r.puntaje, r.puntajeMax), 0) / rs.length) : '']);
        }
        descargarCSV(`resumen-${hoy}`, f);
      })));
}

// ================================================================== DISEÑO
async function vistaDiseno(cont) {
  const actual = (await store.get('config', 'institucion')) || {};
  const d = JSON.parse(JSON.stringify({ ...INSTITUCION_BASE, ...actual, colores: { ...COLORES_BASE, ...(actual.colores || {}) }, titulos: { ...INSTITUCION_BASE.titulos, ...(actual.titulos || {}) }, iconos: { ...INSTITUCION_BASE.iconos, ...(actual.iconos || {}) }, banner: { ...INSTITUCION_BASE.banner, ...(actual.banner || {}) } }));
  const t = (k, ph) => h('input', { type: 'text', value: d[k] || '', placeholder: ph || '', oninput: (e) => { d[k] = e.target.value; } });
  const area = (k) => h('textarea', { oninput: (e) => { d[k] = e.target.value; } }, d[k] || '');
  const vistaPrevia = () => aplicarTema(d);
  const NOMBRES_COLOR = { rojo: 'Rojo', azul: 'Azul', verde: 'Verde', amarillo: 'Amarillo', naranja: 'Naranja', morado: 'Morado', celeste: 'Celeste', marino: 'Azul marino (barras)' };

  const imagen = (k, titulo, ayuda, base) => {
    const vista = h('img', { src: urlImagen(d[k]) || base, alt: '', style: { maxHeight: '110px', maxWidth: '100%', borderRadius: '12px', background: '#fff', border: '2px solid var(--linea)' } });
    const enlace = h('input', { type: 'url', placeholder: 'o pegue un enlace de Google Drive', value: d[k]?.startsWith('data:') ? '' : d[k] || '', onchange: (e) => { d[k] = e.target.value.trim(); vista.src = urlImagen(d[k]) || base; vistaPrevia(); } });
    return h('div', { class: 'tarjeta plana' }, h('h3', null, titulo), h('p', { class: 'chico texto-suave' }, ayuda), vista,
      h('input', { type: 'file', accept: 'image/*', style: { marginTop: '8px' }, onchange: async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { d[k] = await comprimirImagen(f, k === 'fondo' ? 1600 : 600, 0.8); if (d[k].length > 450000) { aviso('Imagen muy pesada; use una más pequeña o un enlace de Drive.', 'error'); d[k] = actual[k] || ''; return; } vista.src = d[k]; vistaPrevia(); } catch (err) { aviso(mensajeError(err), 'error'); }
      } }), enlace,
      h('button', { class: 'btn claro chico', style: { marginTop: '8px' }, onclick: () => { d[k] = ''; enlace.value = ''; vista.src = base; vistaPrevia(); } }, 'Usar la original'));
  };

  cont.append(encabezado('🎨 Diseño institucional',
    h('button', { class: 'btn verde', onclick: guardar }, '💾 Guardar cambios'),
    h('button', { class: 'btn claro', onclick: async () => {
      if (!(await confirmar('Se volverá al diseño original de CESL Digital (logo, LU, colores y textos). La misión, visión y datos de contacto se conservan.', { si: 'Restaurar', clase: 'naranja' }))) return;
      const conservar = { mision: d.mision, vision: d.vision, valores: d.valores, direccion: d.direccion, telefono: d.telefono, correo: d.correo };
      await intentar(async () => { await store.set('config', 'institucion', { ...INSTITUCION_BASE, ...conservar }); aplicarTema({ ...INSTITUCION_BASE, ...conservar }); registrar('Restauró el diseño original', '', S.yo); }, 'Diseño original restaurado');
      vaciar(cont); vistaDiseno(cont);
    } }, '↩️ Restaurar originales')),
    h('p', { class: 'texto-suave' }, 'Los cambios se ven al instante en esta pantalla. Pulse "Guardar cambios" para aplicarlos a todos.'));
  vistaDisenoCon(cont, d);

  function vistaDisenoCon(c, d) {
    c.append(
      h('section', { class: 'tarjeta' }, h('h2', null, 'Nombre y textos'),
        h('div', { class: 'form-rejilla' }, campo('Nombre de la plataforma', t('nombrePlataforma')), campo('Nombre de la institución', t('institucion')), campo('País', t('pais'))),
        campo('Lema', t('lema')), campo('Mensaje de bienvenida de LU', area('bienvenida')), campo('Pregunta de LU al alumno', t('preguntaAlumno', '¿Qué quieres aprender hoy?')),
        campo('Mensajes de ánimo de LU (uno por línea)', h('textarea', { oninput: (e) => { d.mensajesLU = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean); } }, (d.mensajesLU || []).join('\n')))),
      h('section', { class: 'tarjeta' }, h('h2', null, 'Colores institucionales'),
        h('div', { class: 'rejilla chica' }, Object.keys(COLORES_BASE).map((k) => h('label', { class: 'casilla', style: { flexDirection: 'column', alignItems: 'flex-start' } }, NOMBRES_COLOR[k],
          h('input', { type: 'color', value: d.colores[k], oninput: (e) => { d.colores[k] = e.target.value; vistaPrevia(); } }))))),
      h('section', { class: 'tarjeta' }, h('h2', null, 'Imágenes'),
        h('div', { class: 'rejilla dos' },
          imagen('logo', 'Logotipo institucional', 'Aparece en la bienvenida y en la barra superior.', 'img/logo.webp'),
          imagen('mascota', 'Imagen de LU', 'Mejor con fondo transparente (PNG).', 'img/lu.webp'),
          imagen('fondo', 'Imagen de fondo (opcional)', 'Se muestra detrás de la bienvenida y del panel del alumno. Use una imagen clara.', 'img/favicon.png'))),
      h('section', { class: 'tarjeta' }, h('h2', null, 'Banner de avisos'),
        casilla('Mostrar un aviso arriba de la pantalla (ejemplo: "Lunes no hay clases")', d.banner.activo, { onchange: (e) => { d.banner.activo = e.target.checked; } }),
        h('div', { class: 'form-rejilla' }, campo('Texto del aviso', h('input', { type: 'text', value: d.banner.texto, oninput: (e) => { d.banner.texto = e.target.value; } })),
          campo('Color', h('input', { type: 'color', value: d.banner.color, oninput: (e) => { d.banner.color = e.target.value; } })))),
      h('section', { class: 'tarjeta' }, h('h2', null, 'Menú de los alumnos: títulos e iconos'),
        h('div', { class: 'rejilla' }, Object.keys(INSTITUCION_BASE.titulos).map((k) => h('div', null,
          campo('Título', h('input', { type: 'text', value: d.titulos[k], oninput: (e) => { d.titulos[k] = e.target.value; } })),
          campo('Ícono (emoji)', h('input', { type: 'text', value: d.iconos[k], maxLength: 4, oninput: (e) => { d.iconos[k] = e.target.value; } })))))),
      h('div', { class: 'fila-botones' }, h('button', { class: 'btn verde grande', onclick: guardar }, '💾 Guardar cambios')));
  }
  async function guardar() {
    const tam = JSON.stringify(d).length;
    if (tam > 950000) { aviso('Las imágenes son demasiado pesadas. Use enlaces de Google Drive para el fondo.', 'error'); return; }
    await intentar(async () => { await store.set('config', 'institucion', d); aplicarTema(d); registrar('Cambió el diseño institucional', '', S.yo); }, 'Diseño guardado para todos ✔');
  }
}

// ================================================================== CONFIGURACIÓN
async function vistaConfig(cont) {
  const actual = (await store.get('config', 'institucion')) || {};
  const d = { ...actual };
  const t = (k) => h('input', { type: 'text', value: d[k] || '', oninput: (e) => { d[k] = e.target.value; } });
  const area = (k) => h('textarea', { oninput: (e) => { d[k] = e.target.value; } }, d[k] || '');
  const estado = h('span', { class: 'etiqueta-estado e-gris' }, 'Sin probar');
  cont.append(encabezado('⚙️ Configuración'),
    h('section', { class: 'tarjeta' }, h('h2', null, 'Información institucional'),
      campo('Misión', area('mision')), campo('Visión', area('vision')), campo('Valores', area('valores')),
      h('div', { class: 'form-rejilla' }, campo('Dirección', t('direccion')), campo('Teléfono', t('telefono')), campo('Correo', t('correo'))),
      h('button', { class: 'btn verde', onclick: () => intentar(async () => { await store.set('config', 'institucion', d, { merge: true }); registrar('Editó información institucional', '', S.yo); }, 'Información guardada') }, '💾 Guardar')),
    h('section', { class: 'tarjeta' }, h('h2', null, 'Estado técnico'),
      h('div', { class: 'tabla-envoltura' }, h('table', null, h('tbody', null,
        h('tr', null, h('td', null, 'Modo de funcionamiento'), h('td', null, store.modo === 'firebase' ? h('span', { class: 'etiqueta-estado e-verde' }, 'Real (Firebase)') : h('span', { class: 'etiqueta-estado e-naranja' }, 'Demostración (solo este dispositivo)'))),
        store.modo === 'firebase' ? h('tr', null, h('td', null, 'Proyecto de Firebase'), h('td', null, window.CESL_CONFIG.firebase.projectId)) : null,
        h('tr', null, h('td', null, 'Google Apps Script (Drive, contraseñas, respaldos)'), h('td', null, store.modo === 'demo' ? 'Simulado en demostración' : servidorConfigurado() ? h('div', { class: 'fila-botones' }, estado, h('button', { class: 'btn claro chico', onclick: probar }, 'Probar conexión')) : h('span', { class: 'etiqueta-estado e-naranja' }, 'No conectado'))),
        h('tr', null, h('td', null, 'Cierre de sesión por inactividad'), h('td', null, `${window.CESL_CONFIG?.minutosInactividad || 30} minutos`)),
        h('tr', null, h('td', null, 'Dirección para las tablets'), h('td', null, location.origin + location.pathname))))),
      h('p', { class: 'chico texto-suave', style: { marginTop: '10px' } }, 'Estos datos técnicos se cambian una sola vez en el archivo config.js (vea el Manual de instalación).')),
    store.modo === 'demo' ? h('section', { class: 'tarjeta' }, h('h2', null, 'Datos de demostración'),
      h('p', null, 'Borra todo lo hecho en este dispositivo y vuelve a cargar los ejemplos.'),
      h('button', { class: 'btn peligro', onclick: async () => { if (await confirmar('Se borrarán todos los datos de demostración de este dispositivo.', { si: 'Reiniciar' })) { await store.reiniciarDemo(); location.hash = '#/'; location.reload(); } } }, 'Reiniciar demostración')) : null);
  async function probar() {
    estado.className = 'etiqueta-estado e-gris'; estado.textContent = 'Probando…';
    try {
      const r = await store.admin.diagnostico();
      const todoBien = r.pasos.every((p) => p.ok);
      estado.className = 'etiqueta-estado ' + (todoBien ? 'e-verde' : 'e-rojo');
      estado.textContent = todoBien ? `Todo correcto ✔ (${r.version})` : 'Hay un problema ✖';
      modal({ titulo: 'Diagnóstico del servidor (Apps Script)', ancho: true, contenido: h('div', null,
        h('p', { class: 'texto-suave' }, `Versión del servidor: ${r.version}`),
        h('div', { class: 'tabla-envoltura' }, h('table', null, h('tbody', null, r.pasos.map((p) => h('tr', null,
          h('td', { class: 'num' }, p.ok ? '✅' : '❌'), h('td', null, h('b', null, p.nombre)), h('td', { class: 'chico' }, p.detalle)))))),
        !todoBien ? h('p', { class: 'mensaje-info', style: { marginTop: '12px' } }, 'Corrija el primer paso marcado con ❌. Después de cambiar Code.gs: Implementar → Administrar implementaciones → ✏️ → Nueva versión → Implementar.') : null) });
    } catch (e) {
      estado.className = 'etiqueta-estado e-rojo'; estado.textContent = 'Sin respuesta';
      modal({ titulo: 'El servidor no respondió', contenido: h('div', null, h('p', { class: 'mensaje-error' }, mensajeError(e)),
        h('p', null, 'Si el mensaje habla de una acción desconocida, falta actualizar Code.gs a la versión 1.2 y publicar una nueva versión de la implementación.')) });
    }
  }
}

// ================================================================== RESPALDOS
function vistaRespaldos(cont) {
  const archivo = h('input', { type: 'file', accept: '.json,application/json' });
  cont.append(encabezado('💾 Copias de seguridad'),
    h('section', { class: 'tarjeta' }, h('h2', null, '1. Descargar copia completa'),
      h('p', null, 'Guarda en un archivo toda la información: usuarios, grados, materias, materiales, actividades, respuestas y notas. ', h('b', null, 'Recomendado: una vez por semana'), ', guardándolo en Google Drive.'),
      h('p', { class: 'chico texto-suave' }, 'Las contraseñas nunca se incluyen. Los archivos subidos a Drive ya están en Drive.'),
      h('button', { class: 'btn verde', onclick: async (e) => {
        const b = e.currentTarget; b.disabled = true; b.textContent = 'Preparando…';
        try {
          const datos = await store.exportar(COLECCIONES);
          const copia = { app: 'CESL Digital', version: 1, fecha: new Date().toISOString(), modo: store.modo, datos };
          descargar(`cesl-respaldo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(copia), 'application/json');
          registrar('Descargó copia de seguridad', '', S.yo); aviso('Copia descargada', 'ok');
        } catch (err) { aviso(mensajeError(err), 'error'); }
        b.disabled = false; b.textContent = '⬇️ Descargar copia de seguridad';
      } }, '⬇️ Descargar copia de seguridad')),
    h('section', { class: 'tarjeta' }, h('h2', null, '2. Copia automática en Google Drive'),
      store.modo === 'firebase' && servidorConfigurado()
        ? [h('p', null, 'Google Apps Script guarda una copia automática cada día en la carpeta "CESL Digital/Respaldos" de su Google Drive (se conservan las últimas 30).'),
          h('button', { class: 'btn claro', onclick: () => intentar(() => llamarServidor('respaldar'), 'Copia guardada en Google Drive ✔') }, 'Hacer una copia en Drive ahora')]
        : h('p', null, 'Disponible cuando se conecta Google Apps Script (Manual de instalación, paso 7).')),
    h('section', { class: 'tarjeta' }, h('h2', null, '3. Restaurar desde una copia'),
      h('div', { class: 'mensaje-error' }, 'Úselo solo en caso de emergencia: los datos del archivo reemplazan a los actuales con el mismo identificador.'),
      campo('Archivo de copia (.json)', archivo),
      h('button', { class: 'btn naranja', onclick: async () => {
        const f = archivo.files[0]; if (!f) { aviso('Elija el archivo de copia.', 'error'); return; }
        let copia; try { copia = JSON.parse(await leerArchivoTexto(f)); } catch { aviso('El archivo no es una copia válida.', 'error'); return; }
        if (copia.app !== 'CESL Digital' || !copia.datos) { aviso('El archivo no es una copia de CESL Digital.', 'error'); return; }
        const n = Object.values(copia.datos).reduce((s, c) => s + Object.keys(c).length, 0);
        if (!(await confirmar(`Se restaurarán ${n} registros de la copia del ${fechaHora(Date.parse(copia.fecha))}. Las cuentas de acceso (usuario y contraseña) no se modifican.`, { si: 'Restaurar' }))) return;
        await intentar(async () => {
          const ops = [];
          const fechas = /^(fecha|creado|actualizado|enviada|calificado|fechaPublicacion|fechaLimite|ultimoAcceso)$/;
          const revivir = (o) => { if (o && typeof o === 'object' && !Array.isArray(o)) { for (const [k, v] of Object.entries(o)) { if (fechas.test(k) && typeof v === 'number') o[k] = new Date(v); else revivir(v); } } return o; };
          for (const col of COLECCIONES) for (const [id, doc] of Object.entries(copia.datos[col] || {})) {
            if (col === 'config' && id === 'sistema') continue;
            if (col === 'usuarios' && id === S.uid) continue; // no tocar la propia cuenta en uso
            ops.push({ op: 'set', col, id, data: revivir(doc) });
          }
          await store.lote(ops);
          registrar('Restauró copia de seguridad', `${ops.length} registros`, S.yo);
        }, 'Copia restaurada ✔');
        await recargarCatalogos();
      } }, '♻️ Restaurar')));
}

// ================================================================== BITÁCORA
async function vistaBitacora(cont) {
  cont.append(encabezado('🕑 Registro de cambios importantes'));
  const zona = h('div'); cont.append(zona); cargando(zona);
  try {
    const l = (await store.list('bitacora')).sort((a, b) => (b.fecha || 0) - (a.fecha || 0)).slice(0, 300);
    vaciar(zona).append(l.length ? h('div', { class: 'tabla-envoltura' }, h('table', null,
      h('thead', null, h('tr', null, ['Fecha', 'Persona', 'Rol', 'Acción', 'Detalle'].map((t) => h('th', null, t)))),
      h('tbody', null, l.map((x) => h('tr', null, h('td', null, fechaHora(x.fecha)), h('td', null, x.actorNombre), h('td', null, x.rol), h('td', null, h('b', null, x.accion)), h('td', { class: 'chico' }, x.detalle)))))) : vacio('Aún no hay registros.'),
      h('div', { class: 'fila-botones', style: { marginTop: '12px' } }, h('button', { class: 'btn claro', onclick: () => descargarCSV('registro-cambios', [['Fecha', 'Persona', 'Rol', 'Acción', 'Detalle'], ...l.map((x) => [fechaHora(x.fecha), x.actorNombre, x.rol, x.accion, x.detalle])]) }, '⬇️ Exportar')));
  } catch (e) { vaciar(zona).append(vacio(mensajeError(e))); }
}
