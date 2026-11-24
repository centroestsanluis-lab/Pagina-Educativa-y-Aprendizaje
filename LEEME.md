# CESL Digital — Centro de Estudios San Luis

Plataforma educativa para primaria (1.º a 6.º) con paneles de administración, docentes y alumnos, actividades con calificación automática y la sección "Aprende Jugando" con LU.

## Empiece aquí
1. **Probar ya**: abra la plataforma con `config.js` en `modo: "demo"` (cuentas en la pantalla de inicio).
2. **Instalar de verdad**: `manuales/1-manual-de-instalacion.md`.

## Contenido del paquete
| Carpeta / archivo | Qué es |
|---|---|
| `index.html`, `css/`, `js/`, `img/`, `fonts/`, `vendor/` | La aplicación (web instalable en tablets, PWA) |
| `config.js` | Único archivo que se edita una vez (datos de Firebase y Apps Script) |
| `firebase/firestore.rules` | Reglas de seguridad de la base de datos (estructura y permisos) |
| `apps-script/` | "Servidor" gratuito en Google Apps Script: Drive, contraseñas, calificación al instante, copias diarias |
| `manuales/` | Instalación, administración, docentes, recuperación de acceso y guía de tablets |
| `pruebas/` | Pruebas automáticas y capturas de pantalla |
| `herramientas/` | Solo para mantenimiento técnico |

## Estructura de la base de datos (Firestore)
`config` (identidad institucional) · `grados` · `materias` · `usuarios` (nombre, rol, grado, sección, clases asignadas; nunca contraseñas) · `temas` · `recursos` · `actividades` (preguntas sin respuestas) · `claves` (respuestas correctas, solo docentes) · `entregas` (id = actividad__alumno__intento) · `resultados` (notas) · `bitacora` · `practica` (progreso en juegos).

## Pruebas
- `node pruebas/calificar.test.mjs` — calificación automática.
- `python3 pruebas/recorrido.py` — recorrido completo en navegador (modo demostración).
- `python3 pruebas/auth_emulador.py` — autenticación real de Firebase contra el emulador local.
