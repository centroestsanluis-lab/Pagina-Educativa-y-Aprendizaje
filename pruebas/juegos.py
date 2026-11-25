"""Pruebas de los Juegos de aprendizaje creados por administración y docentes (modo demostración).
Uso: python3 pruebas/juegos.py [url]"""
import asyncio, sys, os, re, json
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from recorrido import entrar, salir, permisos, foto, confirmar_modal, CAP

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
import recorrido; recorrido.URL = URL
res = []
def ok(n, c, d=''): res.append((n, bool(c))); print(('✔ ' if c else '✖ ') + n + ('' if c else f'  [{d}]'))

async def jugar_ronda(pg):
    for _ in range(10):
        t = pg.locator('.tablero')
        if await t.locator('.opcion').count():
            await t.locator('.opcion').first.click()
        else:
            while await t.locator('.fichas .ficha:not(.colocada)').count():
                await t.locator('.fichas .ficha:not(.colocada)').first.click()
        await pg.locator('.lu-reaccion .btn.verde').click()
    await pg.wait_for_selector('text=Jugar otra vez')

async def main():
    async with async_playwright() as p:
        nav = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await (await nav.new_context(viewport={'width': 1280, 'height': 800})).new_page()
        errores = []; pg.on('pageerror', lambda e: errores.append(str(e)))
        await pg.goto(URL); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_selector('text=Comenzar')

        # Administración
        await entrar(pg, 'admin', 'admin123')
        await pg.goto(URL + '#/mis-juegos'); await pg.wait_for_selector('text=Juegos de aprendizaje')
        await pg.wait_for_selector('text=Animals / Animales')
        ok('Administración ve el paquete de Inglés (9 juegos)', await pg.locator('.item').count() == 9)
        await foto(pg, '30-juegos-lista')
        await pg.get_by_role('button', name='📦 Paquete de Inglés').click(); await confirmar_modal(pg, 'Cargar paquete')
        await pg.wait_for_timeout(500)
        ok('Cargar el paquete otra vez no duplica juegos', await pg.locator('.item').count() == 9)
        r = await permisos(pg, "await p('docentes con materias', async () => { const d = await store.list('usuarios', [['rol','==','docente']]); if (!d.every(u => Array.isArray(u.materias))) throw new Error('sin materias'); });")
        ok('Los docentes tienen sus materias calculadas (para la seguridad)', r['docentes con materias'] == 'PERMITIDO', r)
        await salir(pg)

        # Docente crea un juego de vocabulario pegando una lista
        await entrar(pg, 'maestra.ana', 'docente123')
        await pg.get_by_role('button', name=re.compile('Juegos de aprendizaje')).click()
        await pg.get_by_role('button', name='➕ Juego de vocabulario').click()
        await pg.get_by_label('Nombre del juego').fill('Shapes / Figuras')
        await pg.get_by_label('Materia').select_option(value='ingles')
        await pg.get_by_role('button', name=re.compile('Pegar lista')).click()
        await pg.locator('.modal textarea').fill('circle\tcírculo\t⚪\t1\t3\nsquare\tcuadrado\t🟥\t1\t3\ntriangle\ttriángulo\t🔺\t2\t4\nstar\testrella\t⭐\t1\t6\nheart\tcorazón\t❤️\t1\t6')
        await pg.locator('.modal').get_by_label(re.compile('Reemplazar')).check()
        await confirmar_modal(pg, 'Agregar')
        ok('Pegar lista desde Excel/Sheets llena la tabla', await pg.locator('tbody tr').count() == 5)
        await foto(pg, '31-juegos-editor-vocabulario')
        await pg.get_by_role('button', name='▶️ Guardar y probar').click()
        await pg.wait_for_selector('.tablero .consigna')
        ok('Guardar y probar abre el juego nuevo', 'Shapes' in await pg.inner_text('.juego h2'))
        await jugar_ronda(pg)
        ok('El juego de vocabulario completa 10 rondas', True)

        # Docente crea un juego de preguntas en su materia
        await pg.goto(URL + '#/mis-juegos/nuevo/preguntas'); await pg.wait_for_selector('text=Nuevo juego de preguntas')
        await pg.get_by_label('Nombre del juego').fill('Valores de mi escuela')
        await pg.get_by_label('Materia').select_option(value='comunicacion')
        preguntas = [('¿Qué hacemos al recibir ayuda?', 'Dar las gracias', 'Gritar'), ('Decir la verdad es ser…', 'honesto', 'egoísta'), ('Compartir la refacción es un acto de…', 'solidaridad', 'enojo')]
        for i, (q, c, m) in enumerate(preguntas):
            if i: await pg.get_by_role('button', name='➕ Agregar pregunta').click()
            b = pg.locator('.bloque-pregunta').nth(i)
            await b.get_by_label('Pregunta').fill(q); await b.get_by_label('✔ Respuesta correcta').fill(c); await b.get_by_label('✖ Incorrecta 1').fill(m)
        await foto(pg, '32-juegos-editor-preguntas')
        await pg.get_by_role('button', name='💾 Guardar juego').click()
        await pg.wait_for_selector('text=Valores de mi escuela')
        ok('Docente crea un juego de preguntas', True)
        # Validación
        await pg.goto(URL + '#/mis-juegos/nuevo/vocabulario'); await pg.wait_for_selector('text=Nuevo juego de vocabulario')
        await pg.get_by_label('Nombre del juego').fill('Incompleto')
        await pg.get_by_role('button', name='💾 Guardar juego').click(); await pg.wait_for_timeout(300)
        ok('Avisa si faltan palabras', 'al menos 4 palabras' in await pg.inner_text('#avisos'))
        r = await permisos(pg, """
          await p('crear juego en materia ajena', () => store.set('juegos', 'x1', { titulo:'x', tipo:'preguntas', materiaId:'ciencias-naturales', elementos:[] }));
          await p('mover un juego suyo a materia ajena', () => store.update('juegos', 'ing0', { materiaId: 'ciencias-naturales' }));
          await p('editar juego de Inglés (su materia)', () => store.update('juegos', 'ing0', { visible: true }));
        """)
        ok('Docente: solo edita juegos de sus materias', r['crear juego en materia ajena'] == 'permission-denied' and r['mover un juego suyo a materia ajena'] == 'permission-denied' and r['editar juego de Inglés (su materia)'] == 'PERMITIDO', json.dumps(r, ensure_ascii=False))
        # Ocultar un juego
        await pg.goto(URL + '#/mis-juegos'); await pg.wait_for_selector('text=Greetings / Saludos')
        await pg.locator('.item', has_text='Greetings / Saludos').get_by_role('button', name=re.compile('Ocultar')).click(); await pg.wait_for_timeout(400)
        await salir(pg)

        await entrar(pg, 'maestro.jorge', 'docente123')
        await pg.goto(URL + '#/mis-juegos'); await pg.wait_for_selector('text=Animals / Animales')
        ok('Docente de otra materia solo puede probar los juegos de Inglés', await pg.locator('.item', has_text='Animals / Animales').get_by_role('button', name='✏️ Editar').count() == 0)
        r = await permisos(pg, "await p('editar juego ajeno', () => store.update('juegos', 'ing0', { titulo: 'x' }));")
        ok('…y el servidor le impide editarlos', r['editar juego ajeno'] == 'permission-denied', r)
        await salir(pg)

        # Alumno juega
        await entrar(pg, 'luis.perez', '123456')
        await pg.goto(URL + '#/juegos'); await pg.wait_for_selector('text=Animals / Animales')
        txt = await pg.inner_text('main')
        ok('El alumno ve la sección Inglés con los juegos de la escuela', 'Inglés' in txt and 'Shapes / Figuras' in txt and 'Valores de mi escuela' in txt)
        ok('Los juegos ocultos no aparecen al alumno', 'Greetings / Saludos' not in txt)
        await foto(pg, '33-aprende-jugando-ingles')
        await pg.locator('.mosaico', has_text='Animals / Animales').click(); await pg.wait_for_selector('.tablero .consigna')
        await foto(pg, '34-juego-ingles')
        await jugar_ronda(pg)
        await foto(pg, '35-juego-ingles-final')
        r = await permisos(pg, """
          await p('progreso', async () => { const d = await store.get('practica', 'u-luis'); if (!d || !d.juegos['c-ing2-3']) throw new Error('no guardado'); });
          await p('alumno modifica un juego', () => store.update('juegos', 'ing0', { titulo: 'x' }));
        """)
        ok('Se guarda el progreso del alumno en juegos de la escuela', r['progreso'] == 'PERMITIDO', r)
        ok('El alumno no puede modificar juegos', r['alumno modifica un juego'] == 'permission-denied', r)
        # Distintos niveles generan preguntas
        for n in range(1, 7):
            await pg.goto(URL + f'#/juego/c-ing1/{n}'); await pg.wait_for_selector('.tablero .consigna')
        ok('Los juegos de vocabulario funcionan en los 6 niveles', True)
        ok('Sin errores de JavaScript', not errores, '; '.join(errores))
        await nav.close()
    print(f"\nRESULTADO: {sum(1 for r in res if r[1])} de {len(res)} pruebas superadas")
    sys.exit(0 if all(r[1] for r in res) else 1)
asyncio.run(main())
