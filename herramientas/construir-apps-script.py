#!/usr/bin/env python3
"""Genera apps-script/Code.gs insertando js/calificar.js (para que la nota sea idéntica en ambos lados)."""
import pathlib, re
raiz = pathlib.Path(__file__).resolve().parent.parent
base = (raiz / 'herramientas' / 'Code.base.gs').read_text(encoding='utf-8')
calif = (raiz / 'js' / 'calificar.js').read_text(encoding='utf-8')
calif = re.sub(r'^export \{[^}]*\};?\s*$', '', calif, flags=re.M)
salida = base.replace('//@@CALIFICAR@@', calif.strip() + '\n')
(raiz / 'apps-script' / 'Code.gs').write_text(salida, encoding='utf-8')
print('apps-script/Code.gs generado')
