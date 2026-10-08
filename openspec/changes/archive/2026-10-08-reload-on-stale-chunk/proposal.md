# Proposal

## Why

Las cuatro secciones se cargan bajo demanda (`lazy()`), cada una en un fichero JS con el hash de su
contenido en el nombre. Un deploy sustituye esos ficheros. Android puede tener la app instalada
viva en segundo plano durante horas con el JS anterior en memoria: si después de un deploy se entra
en una sección que aún no se había abierto, la app pide un fichero que ya no existe, el Worker
responde con `index.html` (`not_found_handling: single-page-application`) y la sección no carga.
React Router muestra entonces su pantalla de error por defecto, en inglés y con la traza.

Cerrar y abrir la app lo arregla, pero quien la usa no tiene por qué saberlo. Sin *service worker*
(ADR-011) no hay otro mecanismo de actualización: la app tiene que darse cuenta sola.

## What Changes

- **Recarga automática una vez**: al fallar la carga de un fichero de la app, la página se recarga
  y trae la versión nueva. Para no entrar en bucle, no se vuelve a recargar si ya se hizo hace
  menos de 10 segundos, ni sin conexión (recargar sin red cambiaría la app por la página de error
  del navegador).
- **Error de sección propio**: si aun así una sección no carga, se ve dentro de la shell un mensaje
  en español con un botón "Recargar", en vez de la pantalla de error por defecto. La barra de
  navegación y la de captura siguen disponibles.

### Fuera de alcance

- Avisar de que hay una versión nueva mientras la app está abierta: exigiría consultar la versión
  periódicamente, lo que gasta invocaciones del plan gratuito, y la recarga al fallar ya cubre el
  único caso que rompe algo.
- Mantener los ficheros de versiones anteriores en el deploy.

## Capabilities

### Modified Capabilities

- `installable-app`: se añade cómo se recupera la app instalada después de un deploy.

## Impact

- `src/lib/stale-chunk.ts` (nuevo) y su registro en `src/main.tsx`.
- `src/app/layout/section-error.tsx` (nuevo) y una ruta sin `path` con `errorElement` en
  `src/app/router.tsx`.
- Tests unitarios y `e2e/pwa.spec.ts`.
