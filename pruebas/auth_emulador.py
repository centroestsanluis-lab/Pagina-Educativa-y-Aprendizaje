"""Ejecuta pruebas/auth-emulador.html contra el emulador de Firebase Auth. Uso: python3 pruebas/auth_emulador.py"""
import asyncio, json, sys
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/pruebas/auth-emulador.html'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page()
        pg.on('pageerror', lambda e: print('ERROR', e))
        await pg.goto(URL)
        await pg.wait_for_function('window.__resultado', timeout=60000)
        r = await pg.evaluate('window.__resultado')
        for x in r: print(('✔ ' if x['ok'] else '✖ ') + x['prueba'] + ('' if x['ok'] else '  [' + x['detalle'] + ']'))
        print(f"\nRESULTADO: {sum(x['ok'] for x in r)} de {len(r)}")
        await b.close()
        sys.exit(0 if all(x['ok'] for x in r) else 1)
asyncio.run(main())
