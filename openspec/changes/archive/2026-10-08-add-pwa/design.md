# Design

## Context

- El shell ya respeta las *safe areas* (`env(safe-area-inset-*)` en la cabecera, la barra de
  pestañas, la barra lateral y el pie del drawer) y declara `viewport-fit=cover`.
- `index.html` no tiene manifest, iconos ni favicon. `src/lib/theme.ts` pinta `light`/`dark` en
  `<html>` antes del primer render y cuando se cambia en **Más**.
- La CSP de `public/_headers` es `default-src 'self'`, sin `manifest-src` ni `worker-src` propios.
- Toda la app está detrás de Cloudflare Access, y la API vive en D1: sin red no hay datos.
- La persona dueña instala en Android (Chrome). El ROADMAP pedía un *service worker* con caché de la
  shell y aviso de "Hay una versión nueva"; en la conversación previa a esta propuesta se cuestionó
  si hacía falta, y la respuesta es D1.

## Goals / Non-Goals

**Goals**
- Instalable en Android desde el menú de Chrome, con icono propio y a pantalla completa.
- Que una versión desplegada se vea al abrir la app, sin pasos extra.
- Barra de estado del color del tema pintado.

**Non-Goals**
- Funcionar sin conexión, notificaciones push o el aviso automático de instalación.

## Decisions

### D1 · Sin *service worker*

**Qué.** Manifest e iconos, y ningún *service worker* registrado.

**Por qué.** Lo que un *service worker* aportaría aquí, y lo que costaría:

| Aporta | Cuesta |
|---|---|
| Abrir la shell sin conexión | Sin conexión no hay datos: la shell abriría para enseñar errores. |
| Arranque algo más rápido | Los assets ya salen del borde de Cloudflare con *hash* en el nombre; la ganancia es pequeña. |
| El aviso automático de instalación | Solo hay una persona que instalarla, y el menú basta. |
| | **Versiones viejas**: la shell en caché sigue sirviéndose después de un deploy hasta que el *service worker* se actualiza. Eso obliga a un flujo de "Hay una versión nueva". |
| | **Access invisible**: si la navegación la sirve la caché, la petición nunca llega a Cloudflare. Con la sesión caducada, Access no puede redirigir al login, y la app se queda pidiendo `/api` y recibiendo errores. |

Sin *service worker*, abrir la app instalada es exactamente abrir la URL: Access hace su trabajo y
siempre se carga la última versión. Chrome lo permite instalar desde el menú desde la versión 108 en
móvil ("Revisiting Chrome's installability criteria", developer.chrome.com). Si algún día hiciera
falta trabajar sin conexión, sería un cambio propio con su diseño de caché y de sesión.

### D2 · Manifest

```json
{
  "id": "/",
  "name": "Nexus",
  "short_name": "Nexus",
  "description": "Tareas y avisos personales",
  "lang": "es",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#f6f7f2",
  "theme_color": "#f6f7f2",
  "icons": [ 192, 512 y 512 maskable ]
}
```

**El manifest se pide con credenciales** (`<link rel="manifest" crossorigin="use-credentials">`).
Por defecto el navegador lo pide **sin cookies**; detrás de Cloudflare Access eso devuelve la página
de login en vez del JSON, y Chrome solo ofrece "Añadir a pantalla de inicio" como acceso directo. Se
descubrió al probarlo en el móvil, y un e2e que simula a Access lo cubre.

`background_color` y `theme_color` son los de `--background` del tema claro: el manifest solo admite
un valor, y es el que se ve en la pantalla de arranque. Mientras la app corre, `theme-color` lo
gobierna el `meta` (D4). Un test comprueba que estos colores coinciden con los de `src/index.css`.

### D3 · Iconos: un SVG fuente y PNG generados

`public/icons/icon.svg` es la fuente: una "N" geométrica (polígono, sin depender de una fuente) en
`--primary-foreground` sobre `--primary` del tema claro. `scripts/icons.mjs` la rasteriza con el
Chromium que ya tiene Playwright y escribe:

- `icon-192.png`, `icon-512.png`: el monograma con las esquinas redondeadas;
- `icon-maskable-512.png`: fondo a sangre y la letra dentro del 80 % central, la zona segura de los
  iconos adaptables de Android;
- `apple-touch-icon.png` (180 px) y `public/favicon.svg`.

Los PNG se versionan, porque son los que se sirven. El script solo hace falta para regenerarlos si
cambia el diseño. Un test lee la cabecera de cada PNG y comprueba sus dimensiones.

### D4 · `theme-color` sigue al tema pintado

`index.html` lleva un `<meta name="theme-color">`, y `applyTheme` le pone el color de fondo del tema
resuelto cada vez que pinta. Como `main.tsx` llama a `applyTheme` antes del primer render, la barra
de estado nunca enseña el color equivocado más que un instante. Los dos colores viven en
`THEME_COLORS` en `src/lib/theme.ts`, y el test de D2 los compara con `src/index.css`.

## Riesgos / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Chrome cambia los criterios de instalación** | El manifest cumple también los criterios antiguos salvo el *service worker*; añadirlo sería un cambio aislado. |
| **Los iconos se desincronizan del SVG** | El script los regenera todos a la vez; el test de dimensiones detecta un PNG ausente o roto. |
| **iOS** | Fuera de alcance (no se usa). Los `meta` de Apple no afectan a Android. |

## Migration Plan

Sin migración ni secretos. Pasos de la persona dueña:

1. `pnpm deploy`.
2. En el móvil: abrir la URL en Chrome → ⋮ → "Instalar aplicación" (o "Añadir a pantalla de
   inicio").
3. Abrir desde el icono:
   - va a pantalla completa, sin barra de URL;
   - la barra de estado tiene el color del tema, y cambia al cambiar de tema en **Más**;
   - nada queda bajo la cámara ni bajo la barra de gestos.
4. `/opsx-archive add-pwa` en la rama, antes del merge (la CI ya lo exige).

**Reversión.** Quitar el `link` del manifest. La app instalada sigue siendo un acceso directo a la
URL, sin nada en caché que limpiar: esa es otra ventaja de D1.

## Open Questions

Ninguna.
