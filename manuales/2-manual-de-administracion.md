# Manual de administración de CESL Digital

Entre con su correo y contraseña de administración. A la izquierda está el menú.

## Inicio
Muestra alumnos y docentes activos, actividades publicadas, entregas calificadas y el promedio general y por grado.

## Usuarios
Hay tres pestañas: **Alumnos**, **Docentes** y **Administración**. Puede buscar por nombre y filtrar por grado o estado.

**Crear un alumno**
1. Usuarios → Alumnos → **➕ Nuevo alumno**.
2. Escriba el nombre completo. El usuario se sugiere solo (ejemplo: `andrea.caal`); puede cambiarlo.
3. Elija grado y sección.
4. La contraseña temporal es un PIN de 6 números que se genera solo. Si marca "Pedir que cambie la contraseña", el alumno creará la suya al entrar (para 1.º y 2.º se recomienda dejarla sin marcar y entregar el PIN impreso).
5. **Guardar.** Aparecen el usuario y la contraseña **una sola vez**: imprímalos o anótelos. Por seguridad la contraseña no se guarda en ningún lugar.

**Importar muchos alumnos a la vez**: botón **📥 Importar lista**. Pegue desde Excel o Google Sheets las columnas *Nombre, Grado (1 a 6), Sección*. Al final podrá descargar o imprimir la lista de usuarios y PIN.

**Crear un docente**: Usuarios → Docentes → **➕ Nuevo docente**. Si el docente tiene correo, escríbalo: entrará con su correo y podrá recuperar su contraseña solo. Marque en la tabla cada **grado y materia** que imparte. El docente solo verá lo marcado.

**Editar**: cambia nombre, grado/sección o materias asignadas. El usuario no se puede cambiar.

**🔑 Restablecer**: crea una contraseña temporal nueva (la anterior deja de funcionar). Para docentes con correo también puede enviar un enlace de recuperación. Vea el *Manual de recuperación de acceso*.

**⛔ Desactivar / ✅ Activar**: la persona no puede entrar, pero se conservan sus entregas y notas. Úselo para alumnos retirados. **🗑️ Eliminar** borra el perfil; se recomienda desactivar.

## Grados
Cambie nombres, color, orden y **secciones** (ejemplo: `A, B`). Puede crear grupos nuevos. No se puede eliminar un grado que tiene alumnos.

## Materias
Cree, edite, oculte o elimine materias. Elija ícono, color y en qué **grados** se imparte. Las materias ocultas no aparecen a los alumnos.

## Contenidos y Actividades
**Contenidos** muestra cada grado con sus materias: entre a cualquiera para ver o administrar temas, materiales y actividades (igual que un docente). **Actividades** lista todas las actividades del colegio con su docente y estado.

## Calificaciones
Elija grado, materia y sección para ver la tabla de notas (sobre 100) por actividad, el promedio de cada alumno y los **temas que necesitan refuerzo**. Toque el nombre de un alumno para ver su progreso. Botones: **Exportar** (Excel / Google Sheets) e **Imprimir**.

## Reportes
Descargas en CSV: listado de alumnos, docentes y asignaciones, todas las calificaciones y resumen por grado y materia. Para abrir en Google Sheets: Archivo → Importar → Subir.

## Diseño institucional
Cambie sin programar: nombre de la plataforma y de la institución, lema, mensaje de bienvenida de LU, mensajes de ánimo, los 8 colores, logotipo, imagen de LU, imagen de fondo, banner de avisos y los títulos e íconos del menú de los alumnos. Los cambios se ven al instante; pulse **💾 Guardar cambios** para aplicarlos en todas las tablets. **↩️ Restaurar originales** vuelve al diseño inicial.

Consejo: para imágenes grandes (fondo) suba la imagen a Google Drive, compártala como "Cualquier persona con el enlace" y pegue el enlace.

## Configuración
Misión, visión, valores y datos de contacto. Muestra también el estado técnico (modo real o demostración, conexión con Apps Script) y el botón **Probar conexión**.

## Copias de seguridad
1. **Descargar copia** (recomendado cada semana): guarda toda la información en un archivo `.json`. Súbalo a una carpeta de Drive.
2. **Copia automática en Drive**: si Apps Script está conectado, cada noche se guarda una copia en *Mi unidad → CESL Digital → Respaldos* (se conservan las 30 más recientes).
3. **Restaurar**: solo en emergencias. Elija el archivo de copia y confirme. No cambia usuarios ni contraseñas de acceso.

Los archivos de materiales están en *Mi unidad → CESL Digital → Materiales*, ordenados por grado, materia y tema.

## Registro de cambios
Muestra quién hizo cada cambio importante (crear o desactivar usuarios, restablecer contraseñas, crear, publicar o borrar actividades, revisar notas, cambiar el diseño, restaurar copias). No se puede editar ni borrar.

## Buenas prácticas de seguridad
- No comparta la cuenta de administración. Si otra persona administra, créele su propia cuenta en la pestaña Administración.
- Desactive de inmediato a docentes que dejen el colegio.
- Las contraseñas temporales se entregan en persona o impresas, nunca por grupos de mensajería.
- La plataforma no tiene publicidad, redes sociales ni chat, y solo guarda nombre, usuario, grado y sección de cada alumno.
