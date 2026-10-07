# Proposal

## Why

Hoy la SPA es una única página que consulta `GET /api/health`: no hay navegación, ni barra de
captura, ni overlays, ni tema propio, ni forma automática de comprobar que nada se rompe en el
móvil. Ese shell es exactamente lo que necesita **cada** funcionalidad que viene detrás
(`add-tasks`, `add-reminders`, `add-notes`, `add-pwa`) y, si se construye junto con la primera
funcionalidad, se acaba construyendo cinco veces y ninguno queda pensado para 360 px.

Construirlo ahora tiene un segundo motivo, menos visible pero más caro de arreglar después: hoy
las reglas mobile-first de `docs/DESIGN.md` son una promesa escrita que nadie comprueba. Sin una
suite de Playwright con viewport de móvil y de escritorio, un layout roto llega a producción y se
descubre en el móvil, que es donde se usa Nexus. Es además la última pieza de la fase 0 y la que
valida en pantalla la dirección visual "olivar" de `docs/DESIGN.md §5`, que sigue marcada como
"pendiente de validar".

## What Changes

- **Shell de navegación** (`src/app/layout/`): en móvil, barra superior mínima con el título de la
  vista y tab bar inferior (**Hoy, Tareas, Notas, Más**); en escritorio (≥ 1024 px), la tab bar se
  convierte en barra lateral. Ambas navegaciones marcan la sección activa con `aria-current`.
- **Barra de captura**: siempre visible y al alcance del pulgar, encima de la tab bar en móvil y en
  la cabecera en escritorio, donde se enfoca con la tecla `N`. **Solo la interfaz**: ni persiste ni
  llama a la API. `add-tasks` la conecta.
- **Rutas vacías por sección** con su estado vacío, cada una con su título y su subtítulo. El
  navegador hace scroll al título de la vista al cambiar de sección.
- **`ResponsiveDialog`**: un único componente de overlay para toda la aplicación — *bottom sheet*
  (`Drawer`) por debajo de 1024 px y `Dialog` centrado por encima. Ninguna vista usará `Dialog` ni
  `Drawer` directamente.
- **Host de avisos (toasts)**: único en la aplicación, **arriba** en móvil para no tapar la tab bar
  ni la barra de captura, y abajo a la derecha en escritorio.
- **Tema "olivar"**: tokens de color de `docs/DESIGN.md §5` (olivo, aceite, piedra, granada) en
  claro y oscuro, conmutador que **sigue al sistema** por defecto y que recuerda la elección
  manual, radios con jerarquía y escala tipográfica. Solo tokens: ningún `#hex` en componentes.
- **Fuentes propias**: Bricolage Grotesque (variable) para títulos y Atkinson Hyperlegible Next para
  la interfaz, self-hosted y con `font-display: swap`. Sustituyen a Geist.
- **Indicador de sesión en "Más"**: muestra el email de `GET /api/me` con sus estados de carga y de
  error. Cierra el contrato que `add-access-auth` dejó entregado y sin consumidor.
- **Comprobación de la API en "Más"**: la consulta a `GET /api/health` y su reintento se mudan de la
  raíz a la vista "Más", donde pasan a ser una comprobación de diagnóstico.
- **Verificación responsive automática**: Playwright con dos proyectos (**móvil 360 × 780** y
  **escritorio 1280 × 800**) y, para cada ruta, las tres comprobaciones de `docs/DESIGN.md §6`: sin
  scroll horizontal, acción principal visible sin hacer scroll y áreas interactivas de 44 px o
  más. El job nuevo entra en la CI.

### Decisiones tomadas en la revisión humana de esta propuesta

- **Un solo cambio**, tal y como define `docs/ROADMAP.md` para el 0.3. Se asume que superará las
  ~600 líneas de producto orientativas de `openspec/config.yaml`: partirlo dejaría el shell —que
  solo tiene sentido entero— en piezas que nadie puede revisar por separado.
- **Indicador de sesión en "Más"**, no repartido por el shell.
- **Las fuentes de `DESIGN.md` sustituyen a Geist** en este cambio.

## Capabilities

### New Capabilities

- `app-shell`: estructura de la aplicación (barra de vista, navegación, barra de captura), estados
  vacío y de carga de cada sección, reglas táctiles y de viewport del shell, y el indicador de
  sesión.
- `responsive-overlays`: el componente `ResponsiveDialog` como única forma de overlay (sheet en
  móvil, diálogo en escritorio) y el host único de avisos.
- `visual-theme`: tokens del tema "olivar" en claro y oscuro, conmutador que sigue al sistema,
  tipografía self-hosted y radios con jerarquía.
- `responsive-verification`: la suite de Playwright con viewports móvil y escritorio, las tres
  comprobaciones obligatorias por ruta y su ejecución en la CI.

### Modified Capabilities

- `app-bootstrap`: la raíz de la SPA deja de ser la página de comprobación de la API y pasa a ser la
  vista "Hoy" del shell; la comprobación de salud se traslada a "Más"; `e2e/` deja de estar vacío;
  y la CI pasa a ejecutar también la suite responsive.
- `api-health`: la comprobación desde la SPA deja de estar en la página inicial y pasa a la vista
  "Más". El endpoint en sí no cambia.

## Fuera de alcance

- **Lógica de tareas, notas o enlaces.** Las rutas existen con su estado vacío y nada más. La barra
  de captura no persiste nada.
- **Recordatorios y Telegram** (`add-reminders`), que añadirán la tabla `reminders` y el cron.
- **PWA**: manifest, iconos y service worker (`add-pwa`, 1.3).
- **Inicio con resumen** de tareas y recordatorios (`add-home-dashboard`, 2.3). La vista "Hoy" es un
  hueco reservado, no un panel.
- **Entrada propia de menú lateral** más allá de las cuatro secciones, y customizing del shell por
  el usuario.
- **Animaciones** más allá de abrir y cerrar overlays, siempre respetando
  `prefers-reduced-motion`.
- **Cambios en el Worker**: ni rutas, ni esquema, ni migraciones, ni secretos nuevos. `/api/me` ya
  existe.

## Impact

- **Fase del roadmap**: **0.3** (`add-app-shell`), la última de la fase 0 y requisito de la 1.1
  (`add-tasks`).
- **Dependencias nuevas**:
  - `@playwright/test` (Apache-2.0, solo desarrollo). Ya decidido en ADR-008 y en
    `docs/ROADMAP.md` 0.3; en la CI solo Chromium.
  - `@fontsource-variable/bricolage-grotesque` y `@fontsource-variable/atkinson-hyperlegible-next`
    (SIL Open Font License 1.1). Self-hosted, sin peticiones a terceros ni datos de uso.
  - **Se elimina** `@fontsource-variable/geist`.
  - `drawer` y `toast` de shadcn/ui **no añaden nada**: el estilo `base-nova` del proyecto se apoya
    en `@base-ui/react`, que ya está instalado y ya incluye ambos primitivos.
- **Secretos y bindings**: **ninguno nuevo**. Los tests de Playwright interceptan `**/api/*` con
  `page.route`, así que la CI **no** necesita `ACCESS_AUD` ni el atajo local `ACCESS_DEV_BYPASS`, y
  no se escribe ningún valor en `.dev.vars`.
- **Esquema de datos**: **ningún cambio**. Cero filas leídas y cero escritas en D1.
- **Límites del plan gratuito**: sin impacto. Los assets estáticos no cuentan como peticiones al
  Worker; la única llamada a la API que hace el shell es `GET /api/me`, y solo cuando se abre la
  vista "Más", no en cada carga de la aplicación.
- **Riesgo de rotura**: la raíz `/` cambia de contenido (de la comprobación de la API a la vista
  "Hoy"), y con ella cambia el aspecto de toda la aplicación. Es el objetivo del cambio, y se
  revierte revirtiendo el PR: no hay migraciones ni datos de los que dependa.
- **Presupuesto de bundle**: la carga inicial mantiene la techo de **≤ 200 KB de JS comprimido**
  (`docs/DESIGN.md §4`). Las fuentes no cuentan para ese número, pero sí para el peso total.
- **Tamaño del PR**: por encima de las ~600 líneas orientativas, por decisión explícita en la
  revisión de esta propuesta.

### Documentación que este cambio actualiza

- `docs/ARCHITECTURE.md §2.2` (piezas nuevas del front) y `docs/DESIGN.md §5`, que deja de decir
  "pendiente de validar" en cuanto la dirección visual se vea en pantalla.
- `AGENTS.md §4`, porque `pnpm test:e2e` pasa a existir, y `docs/PROGRESS.md` con el estado real.
