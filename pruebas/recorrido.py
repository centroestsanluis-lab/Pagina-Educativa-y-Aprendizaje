"""
Recorrido completo de CESL Digital (modo demostración) en un navegador real.
Uso:  python3 pruebas/recorrido.py [url]      (por defecto http://localhost:8765/)
Comprueba las pruebas obligatorias del proyecto y guarda capturas en pruebas/capturas/.
"""
import asyncio, sys, json, os, re
from playwright.async_api import async_playwright, expect

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
CAP = os.path.join(os.path.dirname(__file__), 'capturas'); os.makedirs(CAP, exist_ok=True)
resultados = []

def ok(nombre, cond, detalle=''):
    resultados.append((nombre, bool(cond), detalle))
    print(('✔ ' if cond else '✖ ') + nombre + (f'  [{detalle}]' if detalle and not cond else ''))

async def foto(pg, nombre): await pg.screenshot(path=os.path.join(CAP, nombre + '.png'), full_page=False)

async def entrar(pg, usuario, clave, esperar='.barra'):
    await pg.goto(URL + '#/entrar'); await pg.wait_for_selector('form.formulario-acceso')
    await pg.get_by_label('Usuario').fill(usuario)
    await pg.locator('input[type=password], .mostrar-clave input').first.fill(clave)
    await pg.get_by_role('button', name='Entrar').click()
    if esperar: await pg.wait_for_selector(esperar, timeout=8000)

async def salir(pg):
    await pg.evaluate("async () => { const {store} = await import('./js/store/index.js'); await store.auth.salir(); }")
    await pg.goto(URL + '#/'); await pg.wait_for_timeout(300)

async def permisos(pg, codigo):
    """Ejecuta intentos de acceso directamente contra la capa de datos (como haría alguien con conocimientos técnicos)."""
    return await pg.evaluate("""async (codigo) => {
      const {store} = await import('./js/store/index.js');
      const r = {};
      const p = async (n, fn) => { try { const x = await fn(); r[n] = 'PERMITIDO' + (Array.isArray(x) ? ':' + x.length : ''); } catch (e) { r[n] = e.code || e.message; } };
      """ + "await (async () => {" + codigo + "})();" + """
      return r;
    }""", None)

async def confirmar_modal(pg, texto_boton):
    await pg.locator('.modal').get_by_role('button', name=texto_boton).click()

async def main():
    async with async_playwright() as p:
        nav = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await nav.new_context(viewport={'width': 1280, 'height': 800}, accept_downloads=True, locale='es-GT')
        pg = await ctx.new_page()
        errores = []
        pg.on('pageerror', lambda e: errores.append(str(e)))
        await pg.goto(URL); await pg.evaluate('localStorage.clear()'); await pg.reload()
        await pg.wait_for_selector('text=Comenzar')
        await foto(pg, '01-bienvenida')

        # ---------------- 1. Inicio de sesión ----------------
        await entrar(pg, 'luis.perez', 'equivocada', esperar=None)
        await pg.wait_for_selector('.mensaje-error:not([hidden])')
        ok('Contraseña incorrecta muestra aviso claro', 'incorrectos' in await pg.inner_text('.mensaje-error'))
        for _ in range(4):
            await pg.get_by_role('button', name='Entrar').click(); await pg.wait_for_timeout(150)
        await pg.get_by_role('button', name='Entrar').click(); await pg.wait_for_timeout(300)
        ok('Bloqueo temporal tras intentos repetidos', 'espera' in (await pg.inner_text('.mensaje-error')).lower() or 'demasiados' in (await pg.inner_text('.mensaje-error')).lower(), await pg.inner_text('.mensaje-error'))
        await pg.evaluate("localStorage.removeItem('cesl-bloqueo-local'); localStorage.removeItem('cesl-demo-intentos')")

        # ---------------- 2. Alumno resuelve una actividad ----------------
        await entrar(pg, 'luis.perez', '123456')
        ok('Alumno inicia sesión y ve su grado', 'Tercero primaria' in await pg.inner_text('.barra'))
        await pg.wait_for_selector('.mosaico')
        materias = await pg.locator('.mosaico').all_inner_texts()
        ok('Alumno ve solo las materias de su grado', any('Medio Social' in m for m in materias) and not any('Ciencias Naturales' in m for m in materias), str(materias))
        await foto(pg, '02-alumno-inicio')
        await pg.get_by_role('button', name=re.compile('Mis tareas')).first.click()
        await pg.wait_for_selector('text=Practico sumas y restas')
        await foto(pg, '03-alumno-tareas')
        await pg.get_by_text('Practico sumas y restas').click()
        await pg.get_by_role('button', name='▶ Empezar').click()
        q = lambda pid: pg.locator(f'[data-pregunta="{pid}"]')
        await q('p1').get_by_role('button', name=re.compile('39')).click()
        await q('p2').get_by_role('button', name=re.compile('Verdadero')).click()
        await q('p3').locator('input').fill('33')
        for t in ['9', '18', '45', '72']: await q('p4').get_by_role('button', name=t, exact=True).click()
        h = q('p5').locator('input.hueco'); await h.nth(0).fill('5'); await h.nth(1).fill('ocho')
        sels = q('p6').locator('select')
        await sels.nth(0).select_option(label='12'); await sels.nth(1).select_option(label='10'); await sels.nth(2).select_option(label='15')
        await foto(pg, '04-alumno-resolviendo')
        await pg.get_by_role('button', name='📨 Entregar').click()
        await confirmar_modal(pg, 'Entregar')
        await pg.wait_for_selector('.celebracion')
        nota = await pg.inner_text('.celebracion .nota')
        ok('Calificación automática: todo correcto = 100', nota.strip() == '100', nota)
        await foto(pg, '05-alumno-resultado')
        r = await permisos(pg, """
          await p('leer lista de usuarios', () => store.list('usuarios'));
          await p('leer perfil de otro alumno', () => store.get('usuarios', 'u-sofia'));
          await p('leer respuestas correctas antes del último intento', () => store.get('claves', 'a-sumas'));
          await p('cambiar su nota', () => store.update('resultados', 'a-sumas__u-luis__1', { puntaje: 999 }));
          await p('crear una nota', () => store.set('resultados', 'x', { alumnoId: 'u-luis', clase: 'g3__matematicas', puntaje: 100 }));
          await p('modificar una actividad', () => store.update('actividades', 'a-sumas', { titulo: 'hack' }));
          await p('ver actividades de 4.º', () => store.list('actividades', [['gradoId','==','g4'],['publicada','==',true]]));
          await p('entregar dos veces el mismo intento', () => store.set('entregas', 'a-sumas__u-luis__1', { actividadId:'a-sumas', alumnoId:'u-luis', gradoId:'g3', clase:'g3__matematicas', intento:1, respuestas:{}, enviada: store.AHORA, estado:'pendiente' }));
          await p('entregar más intentos de los permitidos', () => store.set('entregas', 'a-sumas__u-luis__3', { actividadId:'a-sumas', alumnoId:'u-luis', gradoId:'g3', clase:'g3__matematicas', intento:3, respuestas:{}, enviada: store.AHORA, estado:'pendiente' }));
          await p('entregar a nombre de otro alumno', () => store.set('entregas', 'a-sumas__u-sofia__1', { actividadId:'a-sumas', alumnoId:'u-sofia', gradoId:'g3', clase:'g3__matematicas', intento:1, respuestas:{}, enviada: store.AHORA, estado:'pendiente' }));
          await p('entregar con nota incluida', () => store.set('entregas', 'a-sumas__u-luis__2', { actividadId:'a-sumas', alumnoId:'u-luis', gradoId:'g3', clase:'g3__matematicas', intento:2, respuestas:{}, enviada: store.AHORA, estado:'pendiente', puntaje: 100 }));
          await p('ver bitácora', () => store.list('bitacora'));
          await p('cambiarse a administrador', () => store.update('usuarios', 'u-luis', { rol: 'admin' }));
          await p('ver sus propias notas', () => store.list('resultados', [['alumnoId','==','u-luis'],['visibleAlumno','==',true]]));
        """)
        prohibidas = [k for k in r if k != 'ver sus propias notas']
        ok('Alumno: el servidor rechaza todo lo que no le corresponde', all(r[k] == 'permission-denied' for k in prohibidas), json.dumps(r, ensure_ascii=False))
        ok('Alumno: sí puede ver sus propias notas publicadas', r['ver sus propias notas'].startswith('PERMITIDO'), r['ver sus propias notas'])

        # Segundo intento → ahora sí puede ver las respuestas correctas
        await pg.get_by_role('button', name=re.compile('Volver a mis tareas')).click(); await pg.get_by_text('Practico sumas y restas').click(); await pg.wait_for_selector('text=Intentar de nuevo')
        await pg.get_by_role('button', name=re.compile('Intentar de nuevo')).click()
        await pg.get_by_role('button', name='📨 Entregar').click()
        await confirmar_modal(pg, 'Sí, entregar')
        await pg.wait_for_selector('.celebracion')
        ok('Segundo intento en blanco = 0', (await pg.inner_text('.celebracion .nota')).strip() == '0')
        await pg.get_by_role('button', name=re.compile('Ver correcciones')).click()
        await pg.wait_for_selector('.retro.bien')
        ok('Tras el último intento ve las respuestas correctas', await pg.locator('.retro.bien').count() >= 3)
        await pg.goto(URL + '#/logros'); await pg.wait_for_selector('text=Mis calificaciones')
        ok('Mis logros muestra calificaciones y progreso', await pg.locator('table tbody tr').count() >= 1)
        await foto(pg, '06-alumno-logros')

        # Biblioteca y visor
        await pg.goto(URL + '#/biblioteca'); await pg.wait_for_selector('text=Tablas de multiplicar')
        await pg.get_by_text('Tablas de multiplicar del 2 al 5').click()
        await pg.wait_for_selector('.visor img')
        ok('Abrir material dentro de la plataforma (visor)', await pg.locator('.visor').count() == 1)
        await foto(pg, '07-alumno-visor')
        await pg.get_by_role('button', name='✖ Cerrar').click()

        # Aprende Jugando
        await pg.goto(URL + '#/juegos'); await pg.wait_for_selector('text=Comparar números')
        await foto(pg, '08-aprende-jugando')
        await pg.get_by_role('button', name=re.compile('Comparar números')).click()
        for i in range(10):
            await pg.locator('.tablero .opcion').first.click()
            await pg.locator('.lu-reaccion .btn').click()
        await pg.wait_for_selector('text=Jugar otra vez')
        ok('Juego: 10 rondas y pantalla de resultado', True)
        await foto(pg, '09-juego-resultado')
        for jid, nivel in [('sumas', 4), ('formar', 2), ('lectura', 3), ('figuras', 1), ('departamentos', 5), ('mental', 6), ('oraciones', 4)]:
            await pg.goto(URL + f'#/juego/{jid}/{nivel}'); await pg.wait_for_selector('.tablero .consigna')
        ok('Todos los tipos de juego cargan', len(errores) == 0, '; '.join(errores))
        await pg.goto(URL + '#/juego/formar/2'); await pg.wait_for_selector('.tablero .ficha'); await foto(pg, '10-juego-formar')
        r = await permisos(pg, "await p('progreso guardado', async () => { const d = await store.get('practica', 'u-luis'); if (!d || !d.juegos['comparar-3']) throw new Error('no guardado'); });")
        ok('El progreso del juego se guarda para el alumno', r['progreso guardado'] == 'PERMITIDO', r['progreso guardado'])
        await salir(pg)

        # ---------------- 3. Docente ----------------
        await entrar(pg, 'maestra.ana', 'docente123')
        await pg.wait_for_selector('.mosaico')
        clases = await pg.locator('.mosaico').all_inner_texts()
        ok('Docente ve solo sus 4 clases asignadas', len(clases) == 4, str(clases))
        await foto(pg, '11-docente-inicio')
        r = await permisos(pg, """
          await p('ver alumnos de 3.º (su grado)', () => store.list('usuarios', [['rol','==','alumno'],['gradoId','==','g3']]));
          await p('ver alumnos de 5.º (no es su grado)', () => store.list('usuarios', [['rol','==','alumno'],['gradoId','==','g5']]));
          await p('ver actividades de una clase ajena', () => store.list('actividades', [['clase','==','g5__ciencias-naturales']]));
          await p('crear actividad en clase ajena', () => store.set('actividades', 'zz', { gradoId:'g5', materiaId:'ciencias-naturales', clase:'g5__ciencias-naturales', titulo:'x' }));
          await p('ver contraseñas o cuentas', () => store.list('usuarios'));
          await p('cambiar su propio rol', () => store.update('usuarios', 'u-ana', { rol: 'admin' }));
          await p('asignarse otra clase', () => store.update('usuarios', 'u-ana', { clases: ['g5__ciencias-naturales'] }));
          await p('crear usuarios', () => store.admin.crearCuenta('x@alumnos.cesl.local', '123456'));
          await p('cambiar el diseño institucional', () => store.set('config', 'institucion', { nombrePlataforma: 'x' }));
          await p('ver resultados de su clase', () => store.list('resultados', [['clase','==','g3__matematicas']]));
        """)
        permitidas = ['ver alumnos de 3.º (su grado)', 'ver resultados de su clase']
        ok('Docente: solo accede a sus grados y materias', all(r[k] == 'permission-denied' for k in r if k not in permitidas) and all(r[k].startswith('PERMITIDO') for k in permitidas), json.dumps(r, ensure_ascii=False))

        await pg.get_by_role('button', name=re.compile('Matemáticas.*Tercero', re.S)).click()
        await pg.wait_for_selector('text=Practico sumas y restas')
        await pg.get_by_role('button', name='📊 Resultados').first.click()
        await pg.wait_for_selector('text=Luis Pérez')
        fila = await pg.locator('tr', has_text='Luis Pérez').inner_text()
        ok('Docente ve el resultado del alumno (mejor intento = 100)', '100' in fila, fila)
        await foto(pg, '12-docente-resultados')
        async with pg.expect_download() as d:
            await pg.get_by_role('button', name='⬇️ Exportar').click()
        dl = await d.value; ruta = await dl.path(); contenido = open(ruta, encoding='utf-8-sig').read()
        ok('Exportar resultados (CSV para Excel/Sheets)', 'Luis Pérez' in contenido and 'Nota (100)' in contenido)

        # Subir material por enlace
        await pg.goto(URL + '#/clase/' + 'g3__matematicas'); await pg.wait_for_selector('text=Nueva actividad')
        await pg.get_by_role('button', name='📎 Subir material').click()
        m = pg.locator('.modal')
        await m.get_by_label('Título').fill('Guía de restas (Drive)')
        await m.get_by_label('…o enlace').fill('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing')
        await m.get_by_role('button', name='Guardar').click()
        await pg.wait_for_selector('text=Guía de restas (Drive)')
        ok('Docente agrega material con enlace de Google Drive', True)
        await pg.get_by_role('button', name='📎 Subir material').click()
        await m.get_by_label('Título').fill('Lámina de tablas')
        await m.locator('input[type=file]').set_input_files(os.path.join(os.path.dirname(__file__), '..', 'img', 'demo-tablas.png'))
        await m.get_by_role('button', name='Guardar').click()
        await pg.wait_for_selector('text=Lámina de tablas')
        ok('Docente sube una imagen (se reduce automáticamente)', True)

        # Crear actividad con los 8 tipos de pregunta
        await pg.get_by_role('button', name='➕ Nueva actividad').click()
        await pg.wait_for_selector('text=2. Preguntas')
        await pg.get_by_label('Título').fill('Prueba de todos los tipos')
        await pg.get_by_label('Instrucciones para el alumno').fill('Responde con calma.')
        await pg.get_by_label('Intentos permitidos').select_option('1')
        async def agregar(tipo):
            await pg.locator('.tipos-pregunta button', has_text=tipo).click()
            return pg.locator('.bloque-pregunta').last
        b = await agregar('Selección múltiple')
        await b.get_by_label('Pregunta o enunciado').fill('¿Cuál es el ave nacional?')
        for i, t in enumerate(['Loro', 'Quetzal', 'Paloma']): await b.get_by_placeholder(f'Opción {"ABC"[i]}').fill(t)
        await b.locator('input[type=radio]').nth(1).check()
        b = await agregar('Verdadero o falso')
        await b.get_by_label('Pregunta o enunciado').fill('Guatemala tiene 22 departamentos.')
        await b.get_by_label(re.compile('Verdadero')).check()
        b = await agregar('Completar espacios')
        await b.locator('textarea').fill('La capital es [Ciudad de Guatemala|Guatemala] y la moneda es el [quetzal].')
        b = await agregar('Relacionar columnas')
        await b.get_by_label('Pregunta o enunciado').fill('Une cada símbolo con lo que es')
        pares = [('Quetzal', 'Ave'), ('Ceiba', 'Árbol'), ('Monja blanca', 'Flor')]
        for i, (a, c) in enumerate(pares):
            await b.get_by_placeholder('Columna A').nth(i).fill(a); await b.get_by_placeholder('Columna B').nth(i).fill(c)
        b = await agregar('Ordenar elementos')
        await b.get_by_label('Pregunta o enunciado').fill('Ordena de menor a mayor')
        await b.locator('textarea').last.fill('uno\ndos\ntres\ncuatro')
        b = await agregar('Respuesta corta')
        await b.get_by_label('Pregunta o enunciado').fill('¿Cómo se llama el lago de Sololá?')
        await b.locator('textarea').last.fill('Atitlán\nLago de Atitlán')
        b = await agregar('Ejercicio numérico')
        await b.get_by_label('Pregunta o enunciado').fill('¿Cuánto es 7 × 8?')
        await b.get_by_label('Respuesta correcta (número)').fill('56')
        b = await agregar('Respuesta abierta')
        await b.get_by_label('Pregunta o enunciado').fill('Describe tu tradición favorita.')
        await b.locator('input[type=number]').fill('3')
        await pg.get_by_role('button', name='👀 Vista previa').click()
        await pg.wait_for_timeout(400)
        if await pg.locator('.modal .pregunta').count() == 0: print('AVISO:', await pg.inner_text('#avisos')); await foto(pg, 'error-editor')
        await pg.wait_for_selector('.modal .pregunta')
        ok('Vista previa del docente muestra las 8 preguntas', await pg.locator('.modal .pregunta').count() == 8)
        await foto(pg, '13-docente-vista-previa')
        await confirmar_modal(pg, 'Cerrar')
        await pg.get_by_label(re.compile('^Publicar')).check()
        await foto(pg, '14-docente-editor')
        await pg.get_by_role('button', name='💾 Guardar actividad').click()
        await pg.wait_for_selector('text=Prueba de todos los tipos')
        ok('Docente crea y publica actividad con los 8 tipos de pregunta', True)
        r = await permisos(pg, "await p('clave', async () => { const a = (await store.list('actividades', [['clase','==','g3__matematicas']])).find(x => x.titulo === 'Prueba de todos los tipos'); window.__act = a.id; const c = await store.get('claves', a.id); if (JSON.stringify(a.preguntas).includes('Quetzal\",\"Ave') ) throw new Error('mal'); return c; });")
        act_id = await pg.evaluate('window.__act')
        ok('Las respuestas correctas se guardan aparte de la actividad', r['clave'] == 'PERMITIDO', r['clave'])
        await foto(pg, '15-docente-clase')
        # duplicar / ocultar
        fila = pg.locator('.item', has_text='Prueba de todos los tipos').first
        await fila.get_by_role('button', name='📄 Duplicar').click()
        await confirmar_modal(pg, 'Duplicar')
        await pg.wait_for_selector('text=Prueba de todos los tipos (copia)')
        ok('Duplicar actividad (queda oculta)', 'Borrador' in await pg.locator('.item', has_text='(copia)').inner_text())
        await pg.locator('.item', has_text='(copia)').get_by_role('button', name='🗑️').click()
        await confirmar_modal(pg, 'Eliminar')
        await pg.wait_for_timeout(400)
        ok('Eliminar actividad', await pg.locator('text=(copia)').count() == 0)
        await salir(pg)

        # ---------------- 4. Otra alumna resuelve con errores y pregunta abierta ----------------
        await entrar(pg, 'sofia.garcia', '123456')
        await pg.goto(URL + '#/actividad/' + act_id); await pg.get_by_role('button', name='▶ Empezar').click()
        preg = pg.locator('.pregunta')
        await preg.nth(0).get_by_role('button', name=re.compile('Quetzal')).click()
        await preg.nth(1).get_by_role('button', name=re.compile('Falso')).click()       # incorrecta
        hs = preg.nth(2).locator('input.hueco'); await hs.nth(0).fill('guatemala'); await hs.nth(1).fill('Quetzal')
        s = preg.nth(3).locator('select')
        for i, (_, c) in enumerate(pares): await s.nth(i).select_option(label=c)
        for t in ['uno', 'dos', 'tres', 'cuatro']: await preg.nth(4).get_by_role('button', name=t, exact=True).click()
        await preg.nth(5).locator('input').fill('lago de atitlan')
        await preg.nth(6).locator('input').fill('54')                                  # incorrecta
        await preg.nth(7).locator('textarea').fill('Los barriletes gigantes de Sumpango.')
        await pg.get_by_role('button', name='📨 Entregar').click(); await confirmar_modal(pg, 'Entregar')
        await pg.wait_for_selector('.celebracion')
        txt = await pg.inner_text('.celebracion')
        ok('Calificación con errores y pregunta abierta pendiente', 'Obtuviste 5 de 10' in txt and 'revisará' in txt, txt.replace('\n', ' '))
        await salir(pg)

        # ---------------- 5. Docente revisa la pregunta abierta ----------------
        await entrar(pg, 'maestra.ana', 'docente123')
        await pg.wait_for_selector('text=esperan su revisión')
        ok('Docente ve avisos de entregas por revisar', True)
        await pg.goto(URL + '#/resultados/' + act_id); await pg.wait_for_selector('text=Sofía García')
        await pg.locator('tr', has_text='Sofía García').get_by_role('button', name=re.compile('Revisar')).click()
        await pg.wait_for_selector('.modal .pregunta')
        await pg.locator('.modal .pregunta').nth(7).locator('input[type=number]').fill('3')
        await foto(pg, '16-docente-revision')
        await confirmar_modal(pg, 'Guardar revisión')
        await pg.wait_for_timeout(500)
        fila = await pg.locator('tr', has_text='Sofía García').inner_text()
        ok('Revisión manual: la nota se actualiza (8/10 = 80)', '8/10' in fila and '80' in fila, fila)
        await pg.goto(URL + '#/calificaciones'); await pg.wait_for_selector('text=notas por actividad')
        ok('Calificaciones por grado y materia + temas que necesitan refuerzo', await pg.locator('text=Temas que necesitan refuerzo').count() == 1)
        await foto(pg, '17-docente-calificaciones')
        await salir(pg)
        await entrar(pg, 'sofia.garcia', '123456'); await pg.goto(URL + '#/logros'); await pg.wait_for_selector('text=Mis calificaciones')
        ok('La alumna ve su nota actualizada tras la revisión', '80' in await pg.inner_text('table'))
        await salir(pg)

        # ---------------- 6. Administración ----------------
        await entrar(pg, 'admin', 'admin123')
        await pg.wait_for_selector('text=Promedio por grado')
        await foto(pg, '18-admin-inicio')
        # crear alumno
        await pg.goto(URL + '#/usuarios/alumno'); await pg.wait_for_selector('text=Nuevo alumno')
        await foto(pg, '19-admin-usuarios')
        await pg.get_by_role('button', name='➕ Nuevo alumno').click()
        m = pg.locator('.modal')
        await m.get_by_label('Nombre completo').fill('Andrea Xol Caal')
        ok('Sugerencia automática de usuario', await m.get_by_label('Usuario').input_value() == 'andrea.caal')
        await m.get_by_label('Grado').select_option(label='Primero primaria')
        await m.get_by_label(re.compile('Pedir que cambie')).check()
        temporal = await m.get_by_label(re.compile('Contraseña temporal')).input_value()
        await m.get_by_role('button', name='Guardar').click()
        await pg.wait_for_selector('.clave-temporal')
        ok('Crear alumno muestra credenciales una sola vez', temporal in await pg.inner_text('.modal'))
        await foto(pg, '20-admin-credenciales')
        await confirmar_modal(pg, 'Ya los anoté')
        r = await permisos(pg, "await p('contraseña guardada en perfil', async () => { const u = (await store.list('usuarios', [['rol','==','alumno']])).find(x => x.usuario === 'andrea.caal'); window.__andrea = u.id; if (JSON.stringify(u).includes('" + temporal + "')) throw new Error('SE GUARDÓ'); });")
        ok('La contraseña nunca se guarda en el perfil', r['contraseña guardada en perfil'] == 'PERMITIDO', r['contraseña guardada en perfil'])
        # crear docente y asignar clases
        await pg.goto(URL + '#/usuarios/docente'); await pg.get_by_role('button', name='➕ Nuevo docente').click()
        await m.get_by_label('Nombre completo').fill('Rosa Pérez')
        await m.get_by_label('Matemáticas Primero primaria').check()
        await m.get_by_role('button', name='Guardar').click(); await pg.wait_for_selector('.clave-temporal')
        clave_rosa = (await pg.locator('.clave-temporal').nth(1).inner_text()).strip()
        await confirmar_modal(pg, 'Ya los anoté')
        ok('Crear docente con grados y materias asignados', 'Matemáticas · Primero primaria' in await pg.inner_text('table'))
        # desactivar y reactivar
        await pg.goto(URL + '#/usuarios/alumno'); await pg.wait_for_selector('text=Carlos López')
        await pg.locator('tr', has_text='Carlos López').get_by_role('button', name=re.compile('Desactivar')).click()
        await confirmar_modal(pg, 'Desactivar'); await pg.wait_for_timeout(400)
        # restablecer contraseña de Luis
        await pg.locator('tr', has_text='Luis Pérez').get_by_role('button', name=re.compile('Restablecer')).click()
        await confirmar_modal(pg, 'Crear contraseña temporal'); await pg.wait_for_selector('.clave-temporal')
        nueva_luis = (await pg.locator('.clave-temporal').nth(1).inner_text()).strip()
        await confirmar_modal(pg, 'Ya los anoté')
        # grados, materias
        await pg.goto(URL + '#/grados'); await pg.wait_for_selector('text=Nuevo grado')
        await pg.locator('.tarjeta', has_text='Primero primaria').get_by_role('button', name='✏️ Editar').click()
        await m.get_by_label('Secciones').fill('A, B'); await m.get_by_role('button', name='Guardar').click(); await pg.wait_for_timeout(400)
        ok('Agregar secciones a un grado', 'A, B' in await pg.locator('.tarjeta', has_text='Primero primaria').inner_text())
        await pg.goto(URL + '#/materias'); await pg.get_by_role('button', name='➕ Nueva materia').click()
        await m.get_by_label('Nombre').fill('Música'); await m.get_by_label('Primero primaria').check(); await m.get_by_label('Segundo primaria').check()
        await m.get_by_role('button', name='Guardar').click(); await pg.wait_for_selector('text=Música')
        ok('Crear materia y asignarla a grados', '1° · 2°' in await pg.locator('.item', has_text='Música').inner_text())
        await foto(pg, '21-admin-materias')
        # diseño institucional
        await pg.goto(URL + '#/diseno'); await pg.wait_for_selector('text=Colores institucionales')
        await pg.get_by_label('Lema').fill('Aprender hoy, transformar el mañana. ¡Vamos!')
        await pg.locator('.tarjeta', has_text='Colores institucionales').locator('input[type=color]').last.evaluate("e => { e.value = '#6A1B9A'; e.dispatchEvent(new Event('input', {bubbles:true})); }")
        await pg.get_by_role('button', name='💾 Guardar cambios').first.click(); await pg.wait_for_timeout(500)
        await foto(pg, '22-admin-diseno')
        # copia de seguridad
        await pg.goto(URL + '#/respaldos'); await pg.wait_for_selector('text=Descargar copia completa')
        async with pg.expect_download() as d:
            await pg.get_by_role('button', name='⬇️ Descargar copia de seguridad').click()
        copia = json.load(open(await (await d.value).path(), encoding='utf-8'))
        ok('Copia de seguridad completa (sin contraseñas)', copia['app'] == 'CESL Digital' and len(copia['datos']['usuarios']) >= 9 and 'hash' not in json.dumps(copia))
        # reportes
        await pg.goto(URL + '#/reportes'); await pg.wait_for_selector('text=Todas las calificaciones')
        async with pg.expect_download() as d:
            await pg.locator('.tarjeta', has_text='Todas las calificaciones').get_by_role('button').click()
        rep = open(await (await d.value).path(), encoding='utf-8-sig').read()
        ok('Reporte general de calificaciones', 'Sofía García' in rep and 'Luis Pérez' in rep)
        await pg.goto(URL + '#/bitacora'); await pg.wait_for_selector('table')
        bit = await pg.inner_text('table')
        ok('Registro de cambios importantes', all(x in bit for x in ['Creó usuario', 'Desactivó usuario', 'Restableció contraseña', 'Creó actividad', 'Revisó entrega']), bit[:300])
        await foto(pg, '23-admin-bitacora')
        await pg.goto(URL + '#/clase/g3__matematicas'); await pg.wait_for_selector('text=Prueba de todos los tipos')
        ok('Administración puede ver contenidos de cualquier clase', True)
        await salir(pg)
        await pg.wait_for_selector('text=Aprender hoy, transformar el mañana. ¡Vamos!')
        color = await pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--marino').trim()")
        ok('El diseño guardado se aplica a todos (lema y color)', color.lower() == '#6a1b9a', color)

        # ---------------- 7. Efectos de las acciones del administrador ----------------
        await entrar(pg, 'carlos.lopez', '123456', esperar=None); await pg.wait_for_timeout(800)
        ok('Usuario desactivado no puede entrar', await pg.locator('.barra').count() == 0)
        await entrar(pg, 'luis.perez', '123456', esperar=None); await pg.wait_for_timeout(500)
        ok('Tras restablecer, la contraseña anterior deja de funcionar', await pg.locator('.barra').count() == 0)
        await pg.evaluate("localStorage.removeItem('cesl-bloqueo-local')")
        await entrar(pg, 'luis.perez', nueva_luis)
        ok('La contraseña temporal nueva funciona', True); await salir(pg)
        await entrar(pg, 'andrea.caal', temporal, esperar='text=Crea tu contraseña')
        await foto(pg, '24-cambio-obligatorio')
        campos = pg.locator('.mostrar-clave input')
        await campos.nth(0).fill(temporal); await campos.nth(1).fill('482916'); await campos.nth(2).fill('482916')
        await pg.get_by_role('button', name='Guardar contraseña').click()
        await pg.wait_for_selector('text=Mis materias')
        ok('Cambio obligatorio de contraseña al primer ingreso', 'Primero primaria' in await pg.inner_text('.barra'))
        await salir(pg)
        await entrar(pg, 'andrea.caal', '482916')
        ok('Entra con su nueva contraseña', True)
        await pg.locator('.barra .salir').click(); await pg.get_by_role('button', name=re.compile('Cambiar mi contraseña')).click()
        mm = pg.locator('.modal'); ins = mm.locator('.mostrar-clave input')
        await ins.nth(0).fill('482916'); await ins.nth(1).fill('135790'); await ins.nth(2).fill('135790')
        await mm.get_by_role('button', name='Guardar').click(); await pg.wait_for_timeout(400)
        await salir(pg); await entrar(pg, 'andrea.caal', '135790')
        ok('Cambio de contraseña voluntario', True)
        await salir(pg)
        await entrar(pg, 'rosa.perez', clave_rosa, esperar='text=Crea tu contraseña')
        ok('Docente nuevo debe cambiar la contraseña al entrar', True)

        # ---------------- 8. Pantallas de distintos tamaños ----------------
        await pg.evaluate("async () => { const {store} = await import('./js/store/index.js'); await store.auth.salir(); }")
        for nombre, w, hh in [('tablet-vertical', 800, 1280), ('telefono', 412, 915)]:
            await pg.set_viewport_size({'width': w, 'height': hh})
            await entrar(pg, 'luis.perez', nueva_luis); await pg.wait_for_selector('.mosaico')
            ancho = await pg.evaluate('document.documentElement.scrollWidth')
            ok(f'Sin desplazamiento horizontal en {nombre} ({w}px)', ancho <= w + 1, f'ancho {ancho}')
            await foto(pg, f'25-alumno-{nombre}')
            await pg.goto(URL + '#/juego/sumas/2'); await pg.wait_for_selector('.tablero .consigna'); await foto(pg, f'26-juego-{nombre}')
            await salir(pg)
            await entrar(pg, 'maestra.ana', 'docente123'); await pg.goto(URL + '#/clase/g3__matematicas'); await pg.wait_for_selector('text=Nueva actividad')
            ancho = await pg.evaluate('document.documentElement.scrollWidth')
            ok(f'Panel docente sin desplazamiento horizontal en {nombre}', ancho <= w + 1, f'ancho {ancho}')
            await foto(pg, f'27-docente-{nombre}')
            await salir(pg)

        ok('Sin errores de JavaScript en todo el recorrido', len(errores) == 0, '; '.join(errores))
        await nav.close()
    total = len(resultados); bien = sum(1 for r in resultados if r[1])
    print(f'\nRESULTADO: {bien} de {total} pruebas superadas')
    json.dump([{'prueba': n, 'ok': o, 'detalle': d} for n, o, d in resultados], open(os.path.join(CAP, 'resultado.json'), 'w'), ensure_ascii=False, indent=1)
    sys.exit(0 if bien == total else 1)

if __name__ == '__main__':
    asyncio.run(main())
