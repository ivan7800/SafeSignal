# SafeSignal

**SafeSignal** es una PWA estática de asistencia rápida, discreta y privada para situaciones de riesgo.

Está hecha con **HTML, CSS y JavaScript puro**, sin backend, sin login y sin dependencias externas. Puede subirse directamente a GitHub Pages.

> Importante: SafeSignal no sustituye a emergencias ni garantiza rescate. Su objetivo es reducir el tiempo de reacción: preparar ubicación, mensaje, llamadas y canales de contacto en pocos toques.

## Funciones

Versión actual: **1.2.0**.

- Botón SOS con cuenta atrás cancelable.
- Obtención de ubicación aproximada mediante el navegador.
- Mensaje de emergencia personalizable.
- Contactos de confianza guardados localmente.
- Acciones rápidas por SMS, WhatsApp, email, llamada y menú de compartir del móvil.
- Llamada rápida a emergencias.
- Recurso adicional configurable, por defecto 016 en España.
- WhatsApp y email de recurso de ayuda configurables.
- Falsa llamada con vibración y sonido simple.
- Sirena/luz visual.
- Check-in temporal mientras la app permanece abierta.
- Modo discreto tipo bloc de notas con salida visible, pulsación larga y triple toque en el título.
- Exportación/importación de datos locales.
- PWA instalable y caché offline básica.
- Política CSP básica para reducir superficie de ataque en despliegues estáticos.

## Límites reales

Por seguridad de iOS, Android y los navegadores, una web estática no puede:

- Enviar SMS en silencio.
- Enviar WhatsApp automáticamente sin interacción del usuario.
- Enviar emails reales en segundo plano.
- Rastrear ubicación con la pantalla bloqueada de forma fiable.
- Activarse con botones físicos del móvil.
- Garantizar funcionamiento sin batería, cobertura, permisos o conexión.

SafeSignal prepara el mensaje y abre el canal elegido; la persona usuaria debe confirmar el envío. En algunos navegadores, el menú de compartir solo puede abrirse tras una pulsación directa del usuario.

## Estructura

```text
safesignal/
├── index.html
├── style.css
├── app.js
├── manifest.json
├── sw.js
├── README.md
├── SECURITY.md
├── LICENSE
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── icon-192.svg
```

## Cómo usar en local

1. Descarga o clona este repositorio.
2. Abre `index.html` en el navegador.
3. Añade contactos de confianza.
4. Pulsa **Probar sin enviar**.
5. Comprueba que la ubicación y el mensaje son correctos.

Para probar PWA, permisos y service worker con más fiabilidad, sirve la carpeta con un servidor local:

```bash
python -m http.server 8080
```

Luego abre:

```text
http://localhost:8080
```

## Cómo subir a GitHub Pages

1. Crea un repositorio llamado, por ejemplo, `safesignal`.
2. Sube todos los archivos de esta carpeta.
3. En GitHub: **Settings → Pages**.
4. Source: `Deploy from a branch`.
5. Branch: `main`, folder `/root`.
6. Abre la URL de GitHub Pages.

GitHub Pages usa HTTPS, necesario para que la ubicación funcione correctamente en móviles.

## Recomendaciones de uso seguro

- Añade al menos 2 contactos reales.
- Haz una prueba antes de necesitarla.
- Explica a tus contactos qué deben hacer si reciben un aviso.
- No dependas solo de esta app.
- En una emergencia real, llama a los servicios de emergencia de tu país.

## Recursos por defecto en España

- Emergencias generales: 112.
- Atención 016.
- WhatsApp 016: 600 000 016.
- Email 016: 016-online@igualdad.gob.es.

Estos valores pueden editarse en Ajustes para adaptarlos a otro país o recurso local.

## Privacidad

- Los contactos, ajustes y notas se guardan en `localStorage` del navegador.
- SafeSignal no tiene servidor.
- No se envían datos a ningún sitio salvo cuando la persona decide compartirlos mediante SMS, WhatsApp, email, llamada o el menú de compartir.
- Si alguien tiene acceso físico al dispositivo o al navegador, podría ver los datos guardados. Usa el bloqueo del móvil.

## Personalización

Puedes editar:

- Mensaje base en la pestaña **Mensaje**.
- Número de emergencias.
- Recurso adicional.
- Nombre de falsa llamada.
- Duración de cuenta atrás.
- Contactos de confianza.

## Licencia

MIT.
