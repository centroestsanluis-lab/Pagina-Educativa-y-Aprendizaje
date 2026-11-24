# Manual de recuperación de acceso

La plataforma **nunca guarda contraseñas visibles**. Nadie (ni la administración ni los docentes) puede ver la contraseña de otra persona: solo se puede **reemplazar** por una nueva.

## 1. Alumno que olvidó su PIN o contraseña
1. El alumno avisa a su docente; el docente avisa a la administración.
2. Administración → **Usuarios → Alumnos** → busque al alumno → **🔑 Restablecer**.
3. Decida si debe cambiarla al entrar (para 1.º y 2.º se recomienda que no) → **Crear contraseña temporal**.
4. Entregue el nuevo PIN **en persona o impreso**. La contraseña anterior deja de funcionar al instante.

> Requiere tener conectado Google Apps Script (Manual de instalación, paso 7). Sin él, la administración no puede poner contraseñas nuevas a alumnos sin correo.

## 2. Docente que olvidó su contraseña
- **Si tiene correo registrado**: en la pantalla de inicio, **¿Olvidaste tu contraseña?** → escriba su correo → recibirá un enlace seguro de Google para crear una nueva (revise también "Spam"). La administración también puede enviarlo desde 🔑 Restablecer.
- **Si no tiene correo**: la administración usa 🔑 Restablecer, igual que con un alumno. Se recomienda marcar "Pedir que la cambie al entrar".

## 3. La administración olvidó su contraseña
En la pantalla de inicio: **¿Olvidaste tu contraseña?** → escriba el correo de administración → siga el enlace del correo.

Si además perdió el acceso a ese correo: el dueño del proyecto entra a la consola de Firebase → Authentication → Usuarios → busque la cuenta → menú ⋮ → **Restablecer contraseña**. Se recomienda tener **dos cuentas de administración**.

## 4. "Demasiados intentos"
Tras varios intentos fallidos la cuenta se bloquea temporalmente (en la tablet 5 minutos y en el servidor de Google unos minutos). Espere y vuelva a intentar con calma. Si no recuerda la contraseña, siga el punto 1 o 2.

## 5. "Esta cuenta está desactivada"
La administración la desactivó. Para reactivarla: Usuarios → buscar → **✅ Activar**.

## 6. Cambiar la propia contraseña
Cualquier usuario: **⚙️ (arriba a la derecha) → Cambiar mi contraseña** → escriba la actual y la nueva dos veces.

## 7. Contraseñas temporales y primer ingreso
Si la cuenta tiene "Pedir que cambie la contraseña", al entrar aparecerá **Crea tu contraseña**: se escribe la temporal y luego la nueva (mínimo 6 caracteres) dos veces.

## Reglas para el personal
- Nunca envíe contraseñas por grupos de mensajería ni las escriba en la pizarra.
- No pida a los alumnos que digan su PIN en voz alta.
- Si sospecha que alguien conoce la contraseña de otra persona, use 🔑 Restablecer de inmediato.
