// =====================================================================
//  CESL DIGITAL — ARCHIVO DE CONFIGURACIÓN (se edita UNA sola vez)
//  Siga el "Manual de instalación", paso 4. No hace falta tocar nada más.
// =====================================================================
window.CESL_CONFIG = {
  // "demo"     → funciona sin internet de servidores: los datos se guardan
  //              solo en ESTE dispositivo. Sirve para probar y capacitar.
  // "firebase" → modo real: todos los dispositivos comparten los datos.
  modo: "firebase",

  // Pegue aquí los datos que Firebase le muestra en
  // Configuración del proyecto → Tus apps → Configuración del SDK.
  firebase: {
      apiKey: "AIzaSyDoHwcGeTqJYRELlk_nWlMxxuY82mNaYeU",
      authDomain: "cesl-digital.firebaseapp.com",
      projectId: "cesl-digital",
      storageBucket: "cesl-digital.firebasestorage.app",
      messagingSenderId: "670703542424",
      appId: "1:670703542424:web:9f0037a03d4401580730ed""
  },

  // Dirección de la "Aplicación web" de Google Apps Script
  // (Manual de instalación, paso 7). Permite: subir archivos a Google
  // Drive, restablecer contraseñas, calificar al instante y respaldos.
  // Si se deja vacío la plataforma funciona igual, pero esas cuatro
  // funciones quedan limitadas (ver manual).
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbz0gtcyjJJaMvbOc7dsKAKs9X8f7sgIh8UOO9APzHKN7ULbFiKYFM-1CJnqm4Q2cFMVnQ/exec",

  // Terminación interna para los usuarios sin correo (alumnos y docentes).
  // El alumno escribe solo "ana.lopez"; el sistema usa "ana.lopez@alumnos.cesl.local".
  // ".local" es un dominio reservado: nunca recibe correos reales.
  dominioUsuarios: "alumnos.cesl.local",

  // Minutos sin uso antes de cerrar la sesión automáticamente.
  minutosInactividad: 30
};
