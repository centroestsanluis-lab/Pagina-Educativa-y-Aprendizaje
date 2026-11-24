// Bienvenida, inicio de sesión, recuperación, cambio obligatorio y configuración inicial.
import { h, vaciar, aviso, modal, campo, campoClave, mensajeError, ErrorCesl } from '../ui.js';
import { store, correoDeUsuario, esCorreoReal, registrar } from '../store/index.js';
import { inst, logo, mascota, partesMarca, aplicarTema } from '../tema.js';
import { S, navegar, salir } from '../app.js';
import { operacionesIniciales } from '../semilla.js';

function marca() {
  const [a, b] = partesMarca();
  return h('p', { class: 'marca' }, a, ' ', h('span', null, b));
}

export function render(raiz, partes) {
  if (partes[0] === 'entrar') return renderAcceso(raiz);
  vaciar(raiz).append(h('div', { class: 'escenario bienvenida' + (inst.fondo ? ' con-fondo-img' : '') },
    inst.banner?.activo && inst.banner.texto ? h('div', { class: 'mensaje-info', style: { position: 'absolute', top: '12px', left: '12px', right: '12px', textAlign: 'center', background: inst.banner.color, color: '#fff', fontWeight: 900 } }, inst.banner.texto) : null,
    h('div', { class: 'caja' },
      h('div', null, h('img', { class: 'lu-grande', src: mascota(), alt: 'LU, la mascota', width: 436, height: 700 })),
      h('div', null,
        h('img', { class: 'logo-inst', src: logo(), alt: inst.institucion }),
        marca(),
        h('p', { class: 'lema' }, inst.lema),
        h('div', { class: 'burbuja', style: { marginBottom: '22px' } }, inst.bienvenida),
        h('button', { class: 'btn rojo grande', onclick: () => navegar('/entrar') }, 'Comenzar ▶'),
      ))));
}

const BLOQUEO = 'cesl-bloqueo-local';
function bloqueoLocal() { try { return JSON.parse(localStorage.getItem(BLOQUEO) || '{"n":0,"hasta":0}'); } catch { return { n: 0, hasta: 0 }; } }

function renderAcceso(raiz) {
  const usuario = h('input', { type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: false, placeholder: 'Ejemplo: ana.lopez' });
  const clave = campoClave({ placeholder: 'Contraseña o PIN' });
  const error = h('div', { class: 'mensaje-error', hidden: true });
  const boton = h('button', { class: 'btn verde grande bloque', type: 'submit' }, 'Entrar');

  const enviar = async (e) => {
    e.preventDefault();
    error.hidden = true;
    const b = bloqueoLocal();
    if (b.hasta > Date.now()) {
      error.textContent = `Por seguridad espera ${Math.ceil((b.hasta - Date.now()) / 60000)} minuto(s) antes de intentar otra vez.`; error.hidden = false; return;
    }
    if (!usuario.value.trim() || !clave.input.value) { error.textContent = 'Escribe tu usuario y tu contraseña.'; error.hidden = false; return; }
    boton.disabled = true; boton.textContent = 'Entrando…';
    try {
      await store.auth.entrar(correoDeUsuario(usuario.value), clave.input.value);
      localStorage.removeItem(BLOQUEO);
    } catch (err) {
      // Bloqueo temporal en este dispositivo (además del bloqueo del servidor de Firebase)
      const nb = bloqueoLocal(); nb.n += 1;
      if (nb.n >= 5) { nb.hasta = Date.now() + 5 * 60000; nb.n = 0; }
      try { localStorage.setItem(BLOQUEO, JSON.stringify(nb)); } catch { /* sin almacenamiento */ }
      error.textContent = mensajeError(err); error.hidden = false;
      boton.disabled = false; boton.textContent = 'Entrar';
    }
  };

  vaciar(raiz).append(h('div', { class: 'escenario bienvenida' },
    h('div', { class: 'caja' },
      h('div', { style: { textAlign: 'center' } },
        h('img', { class: 'logo-inst', src: logo(), alt: inst.institucion, style: { maxWidth: '300px' } }),
        h('img', { class: 'lu-grande', src: mascota(), alt: '', style: { maxHeight: '46vh', marginTop: '10px' } })),
      h('form', { class: 'formulario-acceso', onsubmit: enviar },
        h('h1', null, '¡Hola de nuevo! 👋'),
        h('p', { class: 'texto-suave' }, 'Escribe tu usuario y tu contraseña para entrar.'),
        error,
        campo('Usuario', usuario),
        campo('Contraseña', clave),
        boton,
        h('div', { class: 'fila-botones', style: { justifyContent: 'space-between', marginTop: '14px' } },
          h('button', { type: 'button', class: 'btn claro chico', onclick: () => navegar('/') }, '◀ Volver'),
          h('button', { type: 'button', class: 'btn claro chico', onclick: recuperar }, '¿Olvidaste tu contraseña?')),
        store.modo === 'demo' ? h('div', { class: 'mensaje-info chico', style: { marginTop: '16px' } },
          h('b', null, 'Modo demostración. '), 'Cuentas de prueba: ', h('br'),
          'Administración: admin / admin123', h('br'), 'Docente: maestra.ana / docente123', h('br'), 'Alumno de 3°: luis.perez / 123456') : null,
      ))));
  setTimeout(() => usuario.focus(), 100);
}

function recuperar() {
  const correo = h('input', { type: 'email', autocomplete: 'email', placeholder: 'correo@ejemplo.com' });
  modal({
    titulo: '¿Olvidaste tu contraseña?',
    contenido: h('div', null,
      h('div', { class: 'mensaje-info' }, h('b', null, 'Alumnos: '), 'pide ayuda a tu maestra o maestro. La administración te dará una contraseña nueva.'),
      h('p', null, h('b', null, 'Docentes con correo registrado: '), 'escriba su correo y le enviaremos un enlace seguro para crear una contraseña nueva.'),
      campo('Correo electrónico', correo)),
    botones: [{ texto: 'Cancelar', clase: 'claro' }, {
      texto: 'Enviar enlace', clase: 'verde', accion: async () => {
        const v = correo.value.trim().toLowerCase();
        if (!esCorreoReal(v)) { aviso('Escriba un correo electrónico real.', 'error'); return false; }
        try { await store.auth.recuperar(v); } catch (e) { if (!String(e.code).includes('user-not-found')) throw e; }
        // Mismo mensaje exista o no la cuenta, para no revelar quién está registrado.
        aviso('Si el correo está registrado, recibirá un enlace en unos minutos. Revise también "Spam".', 'ok');
      },
    }],
  });
}

/** Pantalla obligatoria cuando la cuenta tiene contraseña temporal. */
export function renderCambioObligatorio(raiz) {
  const actual = campoClave({ autocomplete: 'current-password' });
  const nueva = campoClave({ autocomplete: 'new-password' });
  const repetir = campoClave({ autocomplete: 'new-password' });
  const error = h('div', { class: 'mensaje-error', hidden: true });
  const esAlumno = S.yo.rol === 'alumno';
  const enviar = async (e) => {
    e.preventDefault(); error.hidden = true;
    const n = nueva.input.value;
    const prob = n.length < 6 ? 'La nueva contraseña debe tener al menos 6 caracteres.' :
      n !== repetir.input.value ? 'Las dos contraseñas nuevas no son iguales.' :
      n === actual.input.value ? 'La nueva contraseña debe ser diferente de la temporal.' : null;
    if (prob) { error.textContent = prob; error.hidden = false; return; }
    try {
      await store.auth.cambiarClave(actual.input.value, n);
      await store.update('usuarios', S.uid, { debeCambiarPassword: false });
      S.yo.debeCambiarPassword = false;
      aviso('¡Listo! Tu contraseña fue cambiada.', 'ok');
      navegar('/');
    } catch (err) { error.textContent = mensajeError(err); error.hidden = false; }
  };
  vaciar(raiz).append(h('div', { class: 'escenario bienvenida' },
    h('form', { class: 'formulario-acceso', style: { maxWidth: '520px', width: '100%' }, onsubmit: enviar },
      h('h1', null, '🔒 Crea tu contraseña'),
      h('p', null, `Hola, ${S.yo.nombre}. Estás usando una contraseña temporal. Por seguridad, crea una nueva que solo tú conozcas.`),
      esAlumno ? h('div', { class: 'mensaje-info chico' }, 'Puedes usar 6 números que recuerdes fácilmente (PIN). No se la digas a tus compañeros.') : null,
      error,
      campo('Contraseña temporal (la que te dieron)', actual),
      campo('Nueva contraseña', nueva, 'Mínimo 6 caracteres.'),
      campo('Repite la nueva contraseña', repetir),
      h('div', { class: 'fila-botones' }, h('button', { class: 'btn verde', type: 'submit' }, 'Guardar contraseña'),
        h('button', { class: 'btn claro', type: 'button', onclick: salir }, 'Salir')))));
}

/** Primera vez en modo Firebase: crea la cuenta de administración y los datos base. */
export function renderConfiguracionInicial(raiz) {
  const nombre = h('input', { type: 'text', value: 'Administración CESL' });
  const correo = h('input', { type: 'email', placeholder: 'correo de la persona administradora' });
  const clave = campoClave({ autocomplete: 'new-password' });
  const error = h('div', { class: 'mensaje-error', hidden: true });
  const boton = h('button', { class: 'btn verde grande', type: 'submit' }, 'Crear administración y empezar');
  const enviar = async (e) => {
    e.preventDefault(); error.hidden = true;
    if (!esCorreoReal(correo.value.trim())) { error.textContent = 'Use un correo real: servirá para recuperar el acceso.'; error.hidden = false; return; }
    if (clave.input.value.length < 8) { error.textContent = 'Para la administración use al menos 8 caracteres.'; error.hidden = false; return; }
    boton.disabled = true; boton.textContent = 'Preparando la plataforma…';
    try {
      const email = correo.value.trim().toLowerCase();
      try { await store.auth.entrar(email, clave.input.value); } catch (err) {
        if (!/invalid-credential|user-not-found/.test(err.code || '')) throw err;
        const { createUserWithEmailAndPassword, getAuth } = await import('../../vendor/firebase.js');
        await createUserWithEmailAndPassword(getAuth(), email, clave.input.value);
      }
      const uid = store.auth.uid();
      if (!uid) throw new ErrorCesl('auth', 'No se pudo iniciar sesión.');
      // 1) perfil de administración + marca de "sistema iniciado" (las reglas solo lo permiten una vez)
      await store.lote([
        { op: 'set', col: 'usuarios', id: uid, data: { nombre: nombre.value.trim() || 'Administración', rol: 'admin', usuario: email, email, activo: true, debeCambiarPassword: false, creado: store.AHORA } },
        { op: 'set', col: 'config', id: 'sistema', data: { inicializado: true, fecha: store.AHORA, adminInicial: uid } },
      ]);
      // 2) grados, materias e identidad institucional por defecto
      await store.lote(operacionesIniciales());
      await registrar('Configuración inicial', 'Plataforma creada', { nombre: nombre.value, rol: 'admin' });
      aplicarTema(await store.get('config', 'institucion'));
      aviso('¡Plataforma lista!', 'ok');
      location.hash = '#/'; location.reload();
    } catch (err) {
      console.error(err);
      error.textContent = mensajeError(err) + (err.code === 'permission-denied' ? ' (La plataforma ya fue configurada antes: inicie sesión normalmente.)' : '');
      error.hidden = false; boton.disabled = false; boton.textContent = 'Crear administración y empezar';
    }
  };
  vaciar(raiz).append(h('div', { class: 'escenario bienvenida' },
    h('form', { class: 'formulario-acceso', style: { maxWidth: '620px', width: '100%' }, onsubmit: enviar },
      h('img', { src: logo(), alt: '', style: { maxWidth: '260px', display: 'block', marginBottom: '10px' } }),
      h('h1', null, 'Configuración inicial'),
      h('p', null, 'Firebase está conectado y la base de datos está vacía. Cree la cuenta de la persona administradora. ',
        h('b', null, 'Este paso solo puede hacerse una vez.')),
      error,
      campo('Nombre que se mostrará', nombre),
      campo('Correo de la administración', correo, 'Debe ser un correo real (para recuperar la contraseña).'),
      campo('Contraseña (mínimo 8 caracteres)', clave),
      boton)));
}
