# Seguridad y privacidad

SafeSignal está pensada como herramienta de asistencia rápida, no como sustituto de servicios de emergencia.

## Modelo de privacidad

- App estática: HTML, CSS y JavaScript.
- Sin backend.
- Sin analíticas.
- Sin cuentas de usuario.
- Sin dependencias externas.
- CSP básica en `index.html`.
- Datos guardados en `localStorage` del navegador.

## Datos sensibles

La app puede almacenar:

- Nombres de contactos.
- Teléfonos.
- Emails.
- Mensaje de emergencia personalizado.
- Nota local en modo discreto.

Estos datos permanecen en el dispositivo/navegador. Si el móvil está desbloqueado o el navegador se sincroniza/restaura, puede haber exposición. Se recomienda usar bloqueo de pantalla y no compartir el dispositivo.

## Ubicación

La ubicación se obtiene solo cuando la persona pulsa una acción que la requiere. El navegador pedirá permiso. La precisión depende del dispositivo, GPS, señal y permisos.

## Limitaciones críticas

El menú nativo de compartir puede requerir una acción directa del usuario. Por eso la app siempre muestra el aviso preparado y botones manuales de compartir, SMS, WhatsApp, email y llamada.


Una PWA estática no puede garantizar:

- Envío automático silencioso.
- Rastreo en segundo plano.
- Funcionamiento con pantalla bloqueada.
- Funcionamiento sin red.
- Disponibilidad de permisos en todos los navegadores.

## Reporte de vulnerabilidades

Si encuentras un problema de seguridad, abre un issue privado o contacta con el mantenedor del repositorio antes de publicar detalles.

## Recomendación

Antes de usar SafeSignal en una situación real:

1. Añade contactos reales.
2. Haz una prueba sin enviar.
3. Verifica permisos de ubicación.
4. Explica el protocolo a tus contactos.
5. Ten siempre a mano el número oficial de emergencias de tu país.
