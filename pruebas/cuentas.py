"""Eliminar usuario y volver a crearlo; reutilizar cuenta sin perfil; diagnóstico. Uso: python3 pruebas/cuentas.py [url]"""
import asyncio, sys, os, re
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
import recorrido
from recorrido import entrar, salir, permisos, confirmar_modal, foto
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'; recorrido.URL = URL
res = []
def ok(n, c, d=''): res.append(bool(c)); print(('✔ ' if c else '✖ ') + n + ('' if c else f'  [{d}]'))
async def crear_docente(pg, nombre, usuario):
    await pg.goto(URL + '#/usuarios/docente'); await pg.get_by_role('button', name='➕ Nuevo docente').click()
    m = pg.locator('.modal').first
    await m.get_by_label('Nombre completo').fill(nombre); await m.get_by_label('Usuario').fill(usuario)
    await m.get_by_role('button', name='Guardar').click()
async def main():
    async with async_playwright() as p:
        nav = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await (await nav.new_context(viewport={'width': 1280, 'height': 800})).new_page()
        err = []; pg.on('pageerror', lambda e: err.append(str(e)))
        await pg.goto(URL); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_selector('text=Comenzar')
        await entrar(pg, 'admin', 'admin123')
        # Eliminar y volver a crear con el mismo usuario
        await crear_docente(pg, 'Elia Fuentes', 'elia.fuentes'); await pg.wait_for_selector('.clave-temporal'); await confirmar_modal(pg, 'Ya los anoté')
        await pg.locator('tr', has_text='Elia Fuentes').get_by_role('button', name='🗑️').click(); await confirmar_modal(pg, 'Eliminar definitivamente')
        await pg.wait_for_timeout(500)
        await crear_docente(pg, 'Elia Fuentes', 'elia.fuentes'); await pg.wait_for_selector('.clave-temporal', timeout=5000)
        ok('Eliminar un usuario borra también su cuenta: se puede volver a crear', True)
        await confirmar_modal(pg, 'Ya los anoté')
        # Cuenta huérfana (perfil borrado, cuenta de acceso viva): se ofrece reutilizarla
        await permisos(pg, "await p('x', async () => { const u = (await store.list('usuarios', [['rol','==','docente']])).find(x => x.usuario === 'elia.fuentes'); await store.del('usuarios', u.id); });")
        await crear_docente(pg, 'Elia M.F. Fuentes', 'elia.fuentes')
        await pg.wait_for_selector('text=Ese usuario ya tiene una cuenta de acceso')
        await foto(pg, '40-reutilizar-cuenta')
        await pg.get_by_role('button', name='Reutilizar la cuenta').click()
        await pg.wait_for_selector('.clave-temporal')
        clave = (await pg.locator('.clave-temporal').nth(1).inner_text()).strip()
        await confirmar_modal(pg, 'Ya los anoté')
        ok('Cuenta sin perfil: se reutiliza y el usuario aparece de nuevo', 'Elia M.F. Fuentes' in await pg.inner_text('table'))
        # Un usuario en uso no se puede "reutilizar"
        await crear_docente(pg, 'Otra persona', 'elia.fuentes')
        await pg.wait_for_selector('text=Ese usuario ya tiene una cuenta de acceso'); await pg.get_by_role('button', name='Reutilizar la cuenta').click()
        await pg.wait_for_timeout(400)
        ok('No permite quitarle la cuenta a un usuario que la está usando', 'Ya existe una cuenta' in await pg.inner_text('#avisos'), await pg.inner_text('#avisos'))
        await pg.keyboard.press('Escape')
        await salir(pg)
        await entrar(pg, 'elia.fuentes', clave, esperar='text=Crea tu contraseña')
        ok('La persona entra con la cuenta reutilizada', True)
        ok('Sin errores de JavaScript', not err, '; '.join(err))
        await nav.close()
    print(f"\nRESULTADO: {sum(res)} de {len(res)} pruebas superadas"); sys.exit(0 if all(res) else 1)
asyncio.run(main())
