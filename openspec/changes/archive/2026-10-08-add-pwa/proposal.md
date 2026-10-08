# Proposal

## Why

Nexus se usa sobre todo desde el móvil (`docs/DESIGN.md`). Abrirlo hoy es abrir Chrome, buscar la
pestaña o escribir la URL de `workers.dev`, y verlo con la barra del navegador ocupando pantalla.
Para algo que se consulta muchas veces al día, ese rozamiento cuenta. Instalada, la app tiene un
icono en la pantalla de inicio, se abre en un toque y ocupa la pantalla entera.

Es la Fase 1, cambio **1.3**, el último del MVP antes del hito `v0.1.0`.

## What Changes

- **Manifest** (`public/manifest.webmanifest`): nombre, `short_name`, `start_url: "/"`,
  `display: "standalone"`, idioma y colores de fondo y de tema de la paleta "olivar".
- **Iconos**: un monograma "N" sobre el verde olivo, en SVG fuente y en PNG de 192 y 512 px, un
  512 *maskable* con margen de seguridad, `apple-touch-icon` y favicon (hoy la pestaña no tiene).
- **`theme-color` que sigue al tema**: la barra de estado del móvil toma el color de fondo del tema
  pintado, también cuando se cambia a mano en **Más**.
- **Sin *service worker***, como decisión explícita (`design.md` D1). Chrome permite instalar desde
  el menú sin él desde la versión 108 en móvil, y para una app que no sirve de nada sin conexión
  (todo vive en D1, detrás de Access) solo añadiría riesgo: versiones viejas en caché y una
  sesión de Access caducada que el navegador nunca llega a ver.

### Fuera de alcance

- **Modo sin conexión** y caché de la shell (ver D1).
- **Notificaciones push web**: los avisos siguen por Telegram.
- **El aviso automático de instalación** de Chrome, que sí exige *service worker*: se instala desde
  el menú ⋮ › "Instalar aplicación" y solo hay una persona que instalarla.
- **iOS**: la persona dueña usa Android. Los `meta` de Apple se incluyen porque no cuestan nada,
  pero el login de Access dentro de una app instalada en iPhone no se verifica.

## Capabilities

### New Capabilities

- `installable-app`: lo que hace que Nexus se instale y se comporte como una app en el móvil:
  manifest, iconos, color de la barra de estado según el tema y la ausencia deliberada de
  *service worker*.

### Modified Capabilities

Ninguna. Las *safe areas* ya las respeta el shell desde `add-app-shell`.

## Impact

| Área | Impacto |
|---|---|
| Ficheros | `public/manifest.webmanifest`, `public/icons/*`, `public/favicon.svg`, `index.html` (`link` y `meta`), `src/lib/theme.ts` (`theme-color`) y `scripts/icons.mjs` para regenerar los PNG desde el SVG. |
| Worker, esquema, secretos | Ninguno. |
| Dependencias | Ninguna. Los PNG se generan con el Chromium que ya usa Playwright. |
| CSP | Ninguno: `default-src 'self'` ya cubre el manifest y los iconos. |
| Plan gratuito | Ninguno: son assets estáticos, que no invocan el Worker. |
| Docs | ADR-011 en `docs/ARCHITECTURE.md` (sin *service worker*), `docs/ROADMAP.md` (el texto de 1.3) y `docs/PROGRESS.md`. |
