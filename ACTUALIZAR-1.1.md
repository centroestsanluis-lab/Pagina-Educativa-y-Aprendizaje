# Actualización 1.1 — Juegos de aprendizaje y LU con el logo del CESL

## Qué trae
- **🧩 Juegos de aprendizaje** en los paneles de Administración y Docentes: crear y actualizar juegos de Aprende Jugando sin programar (vocabulario o preguntas, con pegado desde Excel/Sheets).
- **📦 Paquete de Inglés**: 9 juegos listos con pronunciación.
- **LU** con el logo real del Centro de Estudios San Luis en la camisa (también en `img/LU-con-logo-CESL.png`, alta resolución).

## Pasos (unos 15 minutos), en este orden
1. **Reglas de seguridad (obligatorio).** Consola de Firebase → Firestore Database → **Reglas** → borre todo, pegue el contenido del nuevo `firebase/firestore.rules` → **Publicar**. Sin esto los juegos nuevos no se pueden crear ni ver.
2. **Subir los archivos a GitHub.** En el repositorio: Add file → Upload files → arrastre **todas las carpetas y archivos de este paquete** → Commit changes.
   Este paquete **no trae `config.js`** a propósito, para no borrar sus datos de Firebase. No lo reemplace.
3. **Abrir el panel de Administración una vez** (pantalla Inicio). Esto actualiza automáticamente a los docentes existentes para que puedan editar juegos de sus materias.
4. **Juegos de aprendizaje → 📦 Paquete de Inglés** para crear la materia Inglés y sus 9 juegos.
5. **Asigne Inglés** a la maestra o maestro correspondiente (Usuarios → Docentes → Editar).
6. **(Recomendado) Apps Script.** Abra su proyecto en script.google.com, reemplace el código por el nuevo `apps-script/Code.gs`, **vuelva a escribir sus dos líneas** (PROYECTO y API_KEY), guarde, y luego Implementar → Administrar implementaciones → ✏️ → Versión: **Nueva versión** → Implementar. Así la copia diaria también guarda los juegos. La URL no cambia.
7. **Tablets:** se actualizan solas. Si alguna muestra la versión anterior, cierre la app desde Recientes y ábrala de nuevo.

Si en **Diseño institucional** había subido otra imagen de LU, pulse "Usar la original" en la imagen de LU (o suba `img/LU-con-logo-CESL.png`) y Guardar.
