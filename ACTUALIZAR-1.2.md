# Actualización 1.2 — Corrección de cuentas, subida de materiales y diagnóstico

## Qué corrige
- **Eliminar usuario**: ahora borra primero la cuenta de acceso. Si no puede, lo avisa en lugar de dejarla ocupada en silencio.
- **Crear un usuario que ya existió**: si la cuenta de acceso quedó sin perfil, la plataforma ofrece **"Reutilizar la cuenta"** con la contraseña nueva.
- **Mensajes del servidor**: en lugar de "No tiene permiso", se muestra el motivo real que da Apps Script.
- **Configuración → Probar conexión**: ahora revisa paso a paso la sesión (API_KEY), la base de datos (PROYECTO), su perfil, la administración de cuentas y Google Drive, y dice cuál falla y cómo corregirlo.

## Pasos
1. **Subir a GitHub** todos los archivos de este paquete (no trae `config.js`; no lo reemplace).
2. **Actualizar Apps Script (obligatorio en esta versión):** script.google.com → su proyecto → reemplace todo el código por el nuevo `apps-script/Code.gs` → **vuelva a escribir sus dos líneas PROYECTO y API_KEY** → Guardar → **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar**. (Si no se crea una versión nueva, sigue funcionando el código viejo.)
3. Entre como administración → **Configuración → Probar conexión**. Corrija el primer paso marcado con ❌ y repita hasta que todo salga ✅.
4. Vuelva a crear el usuario eliminado: aparecerá **"Reutilizar la cuenta"**.

Las reglas de Firebase no cambian en esta versión.
