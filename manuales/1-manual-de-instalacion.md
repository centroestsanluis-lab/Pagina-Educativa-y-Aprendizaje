# Manual de instalación de CESL Digital

Este manual se sigue **una sola vez**. Tiempo aproximado: 1 a 2 horas. No hace falta saber programar: solo copiar, pegar y hacer clic.

## Qué se va a usar (todo gratuito)

| Servicio | Para qué | Costo |
|---|---|---|
| GitHub Pages | Publicar la aplicación (la dirección que abren las tablets) | Gratis |
| Firebase Authentication | Usuarios y contraseñas | Gratis (plan Spark) |
| Cloud Firestore | Base de datos: grados, actividades, entregas y notas | Gratis dentro del límite diario del plan Spark (aprox. 50 000 lecturas y 20 000 escrituras por día; una escuela de 200 alumnos usa una fracción) |
| Google Drive | Guardar PDF, presentaciones, videos e imágenes | Gratis (espacio de la cuenta de Google) |
| Google Apps Script | Subir archivos a Drive, restablecer contraseñas, calificar al instante y copias diarias | Gratis |

**No se necesita tarjeta de crédito.** No active el plan "Blaze" de Firebase: no hace falta. Consulte los límites vigentes en https://firebase.google.com/pricing

> Use siempre **la misma cuenta de Google institucional** para Firebase, Drive y Apps Script (por ejemplo, la cuenta del colegio). Esa cuenta será la "dueña" de todo.

---

## Paso 1. Crear el proyecto de Firebase

1. Entre a https://console.firebase.google.com con la cuenta del colegio.
2. Clic en **Crear un proyecto** (o "Agregar proyecto"). Nombre: `cesl-digital`. Puede desactivar Google Analytics. Clic en **Crear proyecto**.
3. Anote el **ID del proyecto** (aparece debajo del nombre, por ejemplo `cesl-digital-a1b2c`).

## Paso 2. Activar los usuarios con contraseña

1. Menú izquierdo → **Compilación → Authentication** → **Comenzar**.
2. Pestaña **Método de acceso** → **Correo electrónico/contraseña** → **Habilitar** (solo el primer interruptor) → **Guardar**.
3. Pestaña **Configuración → Dominios autorizados** → **Agregar dominio** → escriba `colegiosanluis-gt.github.io` → Agregar.
4. (Recomendado) Pestaña **Plantillas** → "Restablecimiento de contraseña" → cambie el idioma a **español**.

## Paso 3. Crear la base de datos y sus reglas de seguridad

1. Menú izquierdo → **Compilación → Firestore Database** → **Crear base de datos**.
2. Ubicación: elija una de Estados Unidos (por ejemplo `nam5` o `us-central1`). Modo: **producción**. Crear.
3. Pestaña **Reglas**: borre todo lo que aparece, abra el archivo `firebase/firestore.rules` del paquete, copie **todo** su contenido, péguelo y pulse **Publicar**.

> Estas reglas son la seguridad real: aunque alguien modifique la aplicación en una tablet, el servidor de Google no le dejará ver ni cambiar lo que no le corresponde.

## Paso 4. Conectar la aplicación con Firebase

1. En Firebase, clic en el engranaje ⚙️ → **Configuración del proyecto** → sección "Tus apps" → ícono **</>** (Web). Nombre: `CESL Digital`. **No** marque Firebase Hosting. Clic en **Registrar app**.
2. Aparecerá un bloque `const firebaseConfig = { apiKey: "...", authDomain: "...", ... }`. Déjelo abierto.
3. Abra el archivo `config.js` del paquete con el Bloc de notas y:
   - cambie `modo: "demo"` por `modo: "firebase"`;
   - copie cada valor (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId) entre las comillas correspondientes.
4. Guarde el archivo.

> El `apiKey` de Firebase no es una contraseña secreta: identifica al proyecto. La protección la dan las reglas del paso 3.

## Paso 5. Publicar en GitHub Pages

La plataforma se publica en el repositorio que ya usan: **ColegioSanLuis-gt/Pagina-Educativa** → dirección `https://colegiosanluis-gt.github.io/Pagina-Educativa/`.

1. Entre a https://github.com/ColegioSanLuis-gt/Pagina-Educativa
2. Si quiere conservar la página anterior, cree primero una copia (botón **Code → Download ZIP**).
3. **Add file → Upload files**. Arrastre **todo el contenido** de la carpeta `cesl-digital` (index.html, config.js, sw.js, manifest.webmanifest y las carpetas css, js, img, fonts, vendor, firebase, apps-script, manuales, pruebas, herramientas). Escriba "Instalar CESL Digital" y pulse **Commit changes**.
4. **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main` / carpeta `/ (root)` → Save. Espere 1–2 minutos.

## Paso 6. Configuración inicial (crear la cuenta de administración)

1. Abra `https://colegiosanluis-gt.github.io/Pagina-Educativa/` en una computadora.
2. Como la base está vacía, aparecerá **Configuración inicial**. Escriba el nombre, un **correo real** de la administración y una contraseña de al menos 8 caracteres.
3. Se crean automáticamente los 6 grados, las 9 materias y el diseño institucional (logo, LU y colores). Este paso solo se puede hacer **una vez**: hágalo inmediatamente después de publicar.

## Paso 7. Conectar Google Apps Script (Drive, contraseñas, calificación al instante, copias)

Sin este paso la plataforma funciona, pero: los materiales se agregan pegando enlaces de Drive, la administración no puede poner contraseñas nuevas a alumnos sin correo, y la nota de cada entrega se calcula cuando el docente abre los resultados.

1. Con la **misma cuenta** dueña del proyecto de Firebase entre a https://script.google.com → **Nuevo proyecto**. Nombre: `CESL Digital Servidor`.
2. Borre el contenido de `Código.gs`, abra `apps-script/Code.gs` del paquete, copie todo y péguelo.
3. Al inicio del archivo llene las dos líneas:
   - `PROYECTO:` el ID del proyecto de Firebase (paso 1);
   - `API_KEY:` el apiKey (paso 4).
4. Engranaje ⚙️ **Configuración del proyecto** → marque **Mostrar el archivo de manifiesto "appsscript.json"**. Vuelva al editor, abra `appsscript.json`, reemplace su contenido por el del archivo `apps-script/appsscript.json` del paquete. Guarde (💾).
5. Arriba, elija la función **instalar** y pulse **Ejecutar**. Google pedirá permisos: **Revisar permisos** → elija la cuenta → "Configuración avanzada" → "Ir a CESL Digital Servidor" → **Permitir**. En el registro debe aparecer "✔ Conexión con Firestore correcta".
6. **Implementar → Nueva implementación** → tipo **Aplicación web** → *Ejecutar como*: **Yo** → *Quién tiene acceso*: **Cualquier usuario** → **Implementar**. Copie la **URL de la aplicación web**.
7. En `config.js` pegue esa URL en `appsScriptUrl: ""` y súbalo de nuevo a GitHub (Add file → Upload files → reemplaza el anterior).
8. En la plataforma: **Configuración → Probar conexión** debe decir "Conectado ✔".

**Si "instalar" muestra un error de API no habilitada:** en Apps Script → Configuración del proyecto → *Proyecto de Google Cloud* → **Cambiar proyecto** → escriba el **número** del proyecto de Firebase (Firebase → Configuración del proyecto → "Número del proyecto") y vuelva a ejecutar `instalar`.

## Paso 8. Instalar en las tablets
Siga la **Guía para instalar en las 20 tablets**.

## Probar sin instalar nada (modo demostración)
Con `modo: "demo"` la plataforma funciona sin Firebase y guarda todo solo en el dispositivo. Sirve para capacitar a docentes. Cuentas: `admin / admin123`, `maestra.ana / docente123`, `luis.perez / 123456`.

## Opcional: enlace desde Google Sites
En el sitio institucional de Google Sites agregue un **botón** (Insertar → Botón) con el texto "Entrar a CESL Digital" y la dirección de GitHub Pages. Se recomienda un botón y no "insertar" la plataforma dentro de Sites, porque dentro de un marco las tablets pueden olvidar la sesión.

## Actualizaciones futuras
Para cambiar logo, colores, textos, grados, materias o usuarios **no se toca ningún archivo**: todo se hace desde el panel de administración. Solo se edita `config.js` si cambia el proyecto de Firebase o la URL de Apps Script.
