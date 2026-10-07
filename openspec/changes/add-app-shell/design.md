# Design

## Context

Estado actual del front, verificado en el código de `main`:

- `src/app/router.tsx` declara **una** ruta (`/`) que renderiza `HealthPage`; no hay layout, ni
  navegación, ni outlet.
- `src/index.css` tiene los tokens del tema por defecto de shadcn (escala de grises) y un comentario
  que dice explícitamente que la dirección "olivar" "llega con `add-app-shell`". La fuente es
  `@fontsource-variable/geist` y `--font-heading` es un alias de `--font-sans`, porque no hay
  tipografía de títulos.
- shadcn está configurado con el estilo **`base-nova`** (`components.json`), que se apoya en
  **`@base-ui/react` 1.8.0**, no en Radix. Ya hay un componente generado (`button.tsx`) y ese paquete
  ya incluye los primitivos `drawer` y `toast`.
- Vitest tiene dos proyectos (`worker` con `@cloudflare/vitest-plugin` y `web` con jsdom); el de web
  incluye `src/**/*.test.{ts,tsx}` y `@testing-library/react` ya está instalado.
- `e2e/` está vacío y reservado. `AGENTS.md §4` avisa de que `pnpm test:e2e` todavía no existe.
- La CI (`.github/workflows/ci.yml`) tiene un único job `verify` con lint, typecheck, test y build, y
  no despliega.
- `tsc -b` agrega tres proyectos: `tsconfig.app.json` (`src` y `shared`), `tsconfig.worker.json` y
  `tsconfig.node.json` (los ficheros de configuración). Los ficheros de Playwright y `e2e/` no están
  en ninguno de los tres.
- La CSP de la SPA vive en `public/_headers` y es restrictiva; `script-src` **no** admite
  `'unsafe-inline'` (`docs/ARCHITECTURE.md §3.2`).

Restricciones que condicionan el diseño: la CSP anterior (no se puede inyectar un script en línea
para decidir el tema antes del primer pintado), `AGENTS.md §6.5` (ningún dato real en el repo, así que
los fixtures de las pruebas llevan un email ficticio), y el presupuesto de ≤ 200 KB de JS comprimido
en la carga inicial (`docs/DESIGN.md §4`).

## Goals / Non-Goals

**Goals:**

- Un shell que se pueda ampliar sin reescribirlo: añadir una sección es un elemento en una lista y
  una ruta más.
- Que el móvil sea el diseño base y el escritorio la ampliación, con un único `<Outlet />` en el medio
  en lugar de dos maquetaciones.
- Cero dependencias nuevas de producción y una sola de desarrollo.
- Que las reglas de `docs/DESIGN.md §4` y `§6` sean comprobables, no declarativas.

**Non-Goals (de diseño, no de producto):**

- No se diseña un sistema de secciones configurable por la persona usuaria; la navegación es una
  constante de código.
- No se construye un `Sheet` propio ni una abstracción de "overlay" por encima de `Drawer`/`Dialog`:
  la abstracción es exactamente "móvil o escritorio", que es la única diferencia real.
- No se optimiza el bundle con una estrategia de carga por ruta más allá de `lazy()` en las cuatro
  rutas: medir antes de inventar.

## Layout móvil (360 px, diseño base)

El shell es un contenedor de **altura fija con scroll interno**, no una página que hace scroll. Eso
es lo que garantiza que la barra de captura y la tab bar estén siempre al alcance del pulgar y que
`document.documentElement.scrollWidth` nunca supere el ancho de la ventana.

```text
┌────────────────────────────────┐  ← env(safe-area-inset-top)
│ Hoy                       ⚙    │  barra de vista: título + 1 acción
│ miércoles 7 oct                │
├────────────────────────────────┤
│                                │
│                                │
│  contenido con scroll          │  flex-1 + overflow-y-auto
│  (listas en filas, no tablas)  │
│                                │
│                                │
├────────────────────────────────┤
│ [+ Añadir tarea…            ↑ ] │  barra de captura (sombra, la única que flota)
├────────────────────────────────┤
│   Hoy    Tareas    Notas    Más │  tab bar, 44 px de alto mínimo
└────────────────────────────────┘  ← env(safe-area-inset-bottom)
```

Reparto de alturas: `h-dvh` en la raíz del shell, cabecera y barra inferior con `shrink-0`, y el
`<main>` con `flex-1 min-h-0 overflow-y-auto`. `min-h-0` es obligatorio: sin él, un `flex-1` no baja
de su altura de contenido y el scroll se sale al documento.

A **320 px** no cambia nada del reparto: el contenido tiene `min-w-0`, las listas son filas de ancho
completo y ninguna barra tiene una anchura fija.

## Ampliación a escritorio (≥ 1024 px)

```text
┌────────────┬────────────────────────────────────────────────┐
│ Nexus      │ Hoy · miércoles 7 oct          [+ Añadir tarea… ↑]│
│            ├────────────────────────────────────────────────┤
│  Hoy       │                                                │
│  Tareas    │   contenido con ancho máximo legible           │
│  Notas     │   (columna centrada, máx. ~42rem)                │
│  Más       │                                                │
└────────────┴────────────────────────────────────────────────┘
```

- La tab bar (`< lg`) y la barra lateral (`lg:`) viven en **componentes distintos**, no en uno con
  clases condicionadas: cada uno se renderiza solo en su rango de viewport, así que no hay dos
  árboles de navegación en el DOM ni dos conjuntos de puntos de foco.
- La barra de captura **no se duplica**: es un solo componente que se coloca en la cabecera por
  posición dentro del layout de cada tamaño.
- El contenido mantiene un ancho máximo legible (`max-w-2xl mx-auto`): una lista estirada a 1.900 px no
  se lee (`docs/DESIGN.md §3`).
- A 768 px (`md`) no hay barra lateral todavía; la tab bar sigue abajo. Es deliberado: 768 px es
  "móvil en horizontal", y en horizontal no hay pulgar abajo (`docs/DESIGN.md §2`).

## Decisions

### D1 · El shell es una ruta de layout de React Router

`createBrowserRouter` declara una ruta raíz sin `path` cuyo elemento es `<AppShell/>` y que anida las
cuatro secciones como hijos, cada una renderizando su página dentro del `<Outlet />` del shell.

- **Por qué:** el shell sobrevive a las transiciones de ruta sin remontarse, así que el estado de la
  barra de captura y el scroll no se pierden al navegar; y el orden de montaje del `ToastHost` queda
  por encima de cualquier página.
- **Alternativa descartada:** componer el shell como envoltorio de `<RouterProvider />` en
  `main.tsx`. Funciona, pero obliga a que cada página se renderice a través de `children` en vez de
  `Outlet`, y es la forma que menos se parece a lo que hará el resto de la aplicación.
- **Consecuencia:** las cuatro páginas se cargan con `lazy()`, y `router.tsx` declara también la ruta
  `*` para el estado de página no encontrada.

### D2 · Una lista de navegación, dos componentes de navegación

`src/app/navigation.ts` exporta `NAV_ITEMS` (`{ to, label, icon }` para Hoy, Tareas, Notas y Más) con
los iconos de `lucide-react`, que ya es dependencia. `TabBar` y `Sidebar` recorren **la misma lista**;
la sección activa se calcula con el hook de React Router, no con `useLocation` comparando cadenas.

- **Por qué:** una lista única hace imposible que la tab bar y la barra lateral se desincronicen, que
  es el fallo clásico de este patrón.
- **Alternativa descartada:** detectar el viewport en JS y elegir un componente u otro
  (`ResponsiveNavigation`). Mezcla dos esquemas de renderizado y complica los tests; dos componentes
  con una lista compartida son más aburridos y más fáciles de probar.
- La sección activa se marca con `aria-current="page"`, para que no dependa solo del color.

### D3 · `ResponsiveDialog` decide con `matchMedia`, y monta un componente u otro

`src/components/responsive-dialog.tsx` decide con un hook propio
(`src/lib/use-media-query.ts`, sobre `useSyncExternalStore`) si el viewport es de escritorio y monta
el `Drawer` de shadcn por debajo de 1024 px o el `Dialog` a partir de 1024 px. Ambos exponen la misma
interfaz: `open`, `onOpenChange`, `title`, `description`, `children`, `actions`.

- **Por qué** un hook y no CSS: `Drawer` y `Dialog` son primitivos distintos de Base UI, cada uno con
  su propia gestión del foco. Ocultar uno con `hidden` dejaría **dos** trampas de foco en el DOM, y
  la de la pieza oculta seguiría reclamando el foco.
- **Por qué** un hook propio y no `unstable_use_media_query` de `@base-ui/react`: el prefijo
  `unstable` en código de producción es una dependencia de una API que puede cambiar sin aviso, y el
  hook son unas diez líneas con `useSyncExternalStore`, sin listener manual ni re-render fuera de
  fase.
- **Consecuencia asumida:** si la ventana cruza 1024 px con un overlay abierto, React desmonta una
  pieza y monta la otra. El estado `open` vive en el padre, así que el overlay **sigue abierto**; lo
  que se pierde es el estado interno del formulario que contenga. Es un caso límite aceptable.
- El `Drawer` y el `Dialog` se añaden con `pnpm exec shadcn add drawer dialog`; `dialog` ya viene como
  dependencia de registro del propio `drawer`. Ninguna vista los usa directamente: eso lo convierte en
  una regla, y la regla se puede comprobar buscando imports en el pull request.

### D4 · Los avisos usan el primitivo `toast` de Base UI, no `sonner`

`pnpm exec shadcn add toast` aporta el componente sobre `@base-ui/react/toast`, que ya está instalado.

- **Por qué:** evita una dependencia de producción nueva (`sonner`) y, sobre todo, evita mantener dos
  sistemas de avisos, porque el `ToastProvider` del shell es el único punto de entrada.
- **Alternativa descartada:** `sonner`, que es lo que sugiere shadcn en otros estilos: una dependencia
  más por una función que Base UI ya resuelve.
- La posición (arriba en móvil, abajo a la derecha en escritorio) se fija en `src/index.css` con las
  clases de posición del componente, no con estilos en línea.

### D5 · El tema lo decide JavaScript, sin script en línea, por la CSP

`src/lib/theme.ts` tiene una función pura `resolveTheme(stored, prefersDark)` y un
`ThemeProvider` que: aplica la clase `dark` o `light` en `<html>`, escucha los cambios de
`prefers-color-scheme` **mientras no haya elección manual**, y guarda la elección en `localStorage` bajo
`nexus:theme`. `main.tsx` llama a `applyTheme()` **antes** de `createRoot(...).render()`.

- **Por qué no un `<script>` en línea en `index.html`:** es la solución habitual contra el destello de
  tema, pero `public/_headers` fija una CSP sin `'unsafe-inline'` en `script-src` (`AGENTS.md §6.6`).
  Añadir un `'sha256-…'` al CSP es posible, pero ata `index.html` y `public/_headers` byte a byte:
  un espacio en blanco cambia el hash y rompe la aplicación en producción sin que ninguna otra
  comprobación se entere. Para una app personal, esa fragilidad no compensa.
- **Mitigación del destello:** `color-scheme: light dark` en `:root` hace que el lienzo del navegador
  ya siga al sistema antes de que corra JavaScript, y los tokens son los únicos que pintan el fondo.
  El riesgo residual está en los `dark:` de los componentes internos de shadcn durante el primer
  pintado; se documenta en Riesgos.
- **CSS sin duplicar bloques:** los tokens claros viven en `:root` y los oscuros en `.dark`, que es el
  sistema que ya espera `@custom-variant dark (&:is(.dark *))`. Se descarta `light-dark()` porque
  resolvería los tokens sin JavaScript, pero **no** activaría los `dark:` de los componentes de
  shadcn, que sí existen.
- **Almacenamiento:** `localStorage` puede lanzar en modo privado; el acceso va envuelto en `try/catch`
  y el fallo degrada a "seguir al sistema", nunca a una pantalla rota.

### D6 · Tokens "olivar" tal cual, en hexadecimal, dentro de `src/index.css`

Los valores de `docs/DESIGN.md §5` se copian tal cual a los tokens existentes de shadcn
(`--background`, `--foreground`, `--primary`, `--accent`, `--muted`, `--destructive`, …) en los dos
bloques, sin renombrar nada: los componentes generados por shadcn siguen funcionando porque consumen
los mismos nombres.

- **Por qué hexadecimal y no OKLCH:** el documento da hexadecimales y convertirlos a mano introduce
  un error que no se ve. La regla de `AGENTS.md §5` prohíbe colores literales **en los componentes**;
  los tokens son precisamente donde vive el color.
- `docs/DESIGN.md §5` no fija `muted-foreground`, `border`, `ring` ni `sidebar-*`: se derivan de la
  paleta y se documentan en el propio fichero para que la próxima persona no tenga que adivinar.
  Piedra para superficies y bordes, y `muted-foreground` = **tinta al 70 %** sobre cal: `#5F635A` en
  claro y `#A8ABA1` en oscuro. Al 55 % daría 3,6:1 en claro y 3,1:1 sobre piedra, por debajo de AA
  (contraste calculado en la revisión de esta propuesta).
- **El aceite claro no sirve como línea ni como punto.** `#C9A227` sobre cal da **2,25:1**: vale como
  **relleno con texto tinta encima** (6,6:1), pero no como marcador gráfico sobre el fondo, porque WCAG
  1.4.11 pide 3:1 a los elementos gráficos que transmiten información. Se añade
  `--accent-strong`: `#A8841A` en claro (3,3:1 sobre cal) e igual a `--accent` en oscuro (9,4:1), y el
  marcador de "ahora" usa `accent-strong`. Además, el marcador nunca depende solo del color: lleva
  forma o texto (`docs/DESIGN.md §5`).
- Los pares de contraste se comprueban con un test (`src/lib/contrast.test.ts`) que lee los tokens de
  `src/index.css` con `?raw`: si alguien cambia un color y rompe AA, falla `pnpm test`, no la vista.
- `accent` (aceite) queda reservado para "ahora"; hasta que exista la vista **Hoy** con contenido real
  (`add-home-dashboard`), el aceite solo aparece en el marcador de hoy del propio shell.

### D7 · Fuentes: las dos de `docs/DESIGN.md`, self-hosted, y se quita Geist

`pnpm add @fontsource-variable/bricolage-grotesque @fontsource-variable/atkinson-hyperlegible-next` y
`pnpm remove @fontsource-variable/geist`. `--font-heading` pasa a ser Bricolage Grotesque y
`--font-sans` Atkinson Hyperlegible Next, importadas en `src/index.css` igual que hoy Geist.

- **Por qué Fontsource:** sirve los `.woff2` desde el propio origen, con `font-display: swap` y
  subconjuntos por rango Unicode. Una web de fuentes de terceros enviaría una petición a Google por
  visita y filtraría la IP de quien usa la app.
- **Alternativa descartada:** `next/font` no aplica (no hay Next); `@font-face` a mano sobre ficheros
  alojados en R2 añadiría un paso de build y un asset más que servir.
- Coste: son subconjuntos variables, así que **dos** ficheros por familia y peso, no uno por peso.

### D8 · Playwright sin credenciales: se sirve lo construido y se intercepta la API

`playwright.config.ts` declara dos proyectos —`mobile` 360 × 780 y `desktop` 1280 × 800— con
`webServer` levantando `pnpm build` y `pnpm exec vite preview --port 4173 --strictPort`
(`reuseExistingServer: !process.env.CI`). Las peticiones a `**/api/**` se interceptan con
`page.route` y se responden con fixtures.

- **Por qué `preview` y no `dev`:** `preview` sirve exactamente los assets que se despliegan, con el
  gestor de assets real, que es donde viven las cabeceras de `public/_headers`. Un fallo de CSP o de
  `base` solo aparece ahí.
- **Por qué interceptar y no autenticar:** en la CI no hay `ACCESS_AUD` ni aplicación de Access. Las
  alternativas eran escribir un valor en `.dev.vars` (prohibido por `AGENTS.md §6.1`, aunque el valor
  no sea secreto) o exponer el atajo local a cualquier entorno. Interceptar hace que la suite dependa
  de menos piezas y que el shell se pueda probar sin Access en un equipo nuevo.
- **Lo que sí llega al Worker:** la carga inicial de `/` la resuelve el gestor de assets sin pasar por
  el middleware de Access (que solo se aplica a `/api/*`, `wrangler.jsonc` → `run_worker_first`), así
  que la suite funciona contra `wrangler.jsonc` tal cual.
- **Comprobación de áreas táctiles:** se mide `boundingBox()` de los elementos interactivos
  seleccionados por rol y se compara con 44 px **con una tolerancia de 0,5 px**, porque los
  navegadores devuelven fracciones y un `>= 44` estricto produce fallos intermitentes.
- **Fallback documentado:** si `vite preview` resultara incompatible con el plugin de Cloudflare, se
  cambia el `webServer` a `pnpm dev`. Es una línea de configuración, no un rediseño; por eso hay una
  tarea temprana que lo verifica.

### D9 · `e2e/` entra en la comprobación de tipos con su propio proyecto de TypeScript

Se crea `tsconfig.e2e.json` (lib `es2022` + `dom`, tipos de `@playwright/test` y de Node) referenciado
desde `tsconfig.json`, y `playwright.config.ts` se añade al `include` de `tsconfig.node.json`.

- **Por qué:** sin esto, los tests de navegador no se comprobarían en `pnpm typecheck` y un error de
  tipos solo aparecería en la CI, con el mensaje de Playwright en lugar del de TypeScript.
- Biome aplica su conjunto de reglas a `e2e/` como al resto; en particular
  `noNonNullAssertion` está en `error`, así que el código de Playwright no puede usar `!`.

### D10 · La CI gana un job `e2e` aparte

El job `verify` no cambia. Se añade un job `e2e` que hace `pnpm install`, `pnpm build`,
`pnpm exec playwright install --with-deps chromium` y `pnpm test:e2e`.

- **Por qué un job y no un paso:** el fallo de un test responsive se lee en un job que se llama
  "responsive", no dentro de un job llamado "lint, typecheck, test and build"; y los dos jobs corren
  en paralelo, así que la CI no crece de forma lineal.
- **Por qué `--with-deps chromium`:** en `ubuntu-latest` las librerías de sistema que necesita Chromium
  no están todas, y sin ellas el arranque falla en la CI y no en local. Solo Chromium: añadir Firefox
  o WebKit multiplicaría el tiempo sin encontrar hoy ningún bug real.

### D11 · `/api/me` solo se consulta en la vista Más

La sesión se pide con `useQuery` desde un hook `useSession()` que **solo** monta la vista Más.

- **Por qué:** el límite del plan es de 100.000 peticiones al día y el proyecto paga por no gastar de
  más (`providers.tsx` ya desactiva el refetch al recuperar el foco por esto). Consultar la sesión en
  cada carga de la aplicación sería gastar una invocación del Worker en cada apertura para mostrar un
  dato que casi nadie mira.

## Esquema de datos

**Ninguno.** No hay tablas, columnas, índices ni migraciones en este cambio. No se toca
`worker/db/schema.ts`, `pnpm db:generate` no debe generar ningún `.sql` y `pnpm db:migrate:*` no se
ejecuta. La tabla `tasks` llega con `add-tasks` (1.1).

## Coste en el plan gratuito

| Recurso | Consumo |
|---|---|
| Filas leídas en D1 | 0 |
| Filas escritas en D1 | 0 |
| Invocaciones del Worker por carga de la aplicación | 0 (los assets no cuentan) |
| Invocaciones del Worker por acción | 1 al abrir **Más** (`GET /api/me`), 1 por comprobación manual de salud |
| Subpeticiones por invocación del cron | sin cambios: este cambio no toca el cron |
| CPU | sin cómputo nuevo en el Worker |
| Peticiones al día | irrelevante a esta escala, y sin bucles ni polling |

## Estructura de ficheros resultante

```text
src/
  app/
    navigation.ts            # NAV_ITEMS: to, label, icon
    router.tsx               # layout + 4 secciones + ruta "*"
    layout/
      app-shell.tsx          # h-dvh, cabecera, <Outlet/>, barra inferior
      view-header.tsx        # título de la vista (+ acción)
      capture-bar.tsx        # interfaz pura; sin persistencia
      tab-bar.tsx            # < lg
      sidebar.tsx            # >= lg
      not-found-view.tsx
  components/
    responsive-dialog.tsx    # Drawer o Dialog según viewport
    empty-state.tsx          # estado vacío reutilizable
    skeleton.tsx             # esqueleto con la forma del contenido
    theme-provider.tsx
    theme-toggle.tsx
  features/
    today/today-page.tsx
    tasks/tasks-page.tsx     # marcador de posición
    notes/notes-page.tsx     # marcador de posición
    more/more-page.tsx       # sesión + comprobación de la API
    health/health-panel.tsx  # lo que era HealthPage
  lib/
    theme.ts                 # resolveTheme puro + applyTheme
    use-media-query.ts
e2e/
  fixtures.ts                # stubs de /api/*
  shell.spec.ts              # las tres comprobaciones por ruta
playwright.config.ts
tsconfig.e2e.json
```

`HealthPage` deja de ser una página (`health-page.tsx` y su test se convierten en `health-panel.tsx` y
su test) porque deja de ser la raíz de la aplicación.

## Tests

**Vitest (rápidos, en `src/`):** `resolveTheme` con las cuatro combinaciones de preferencia y elección;
`use-media-query` con `matchMedia` simulado; `ResponsiveDialog` monta `Drawer` a 360 px y `Dialog` a
1280 px, cierra con `Escape` y devuelve el foco; `CaptureBar` no llama a la API ni persiste y expone
`enterkeyhint="send"`; la navegación marca `aria-current`; la vista Más muestra los estados de carga y
de error de la sesión.

**Playwright (barato de escribir, caro de saltarse):** para cada ruta y en los dos proyectos, sin
scroll horizontal, acción principal visible sin desplazamiento, elementos interactivos de 44 px, barra
de captura visible sin desplazamiento y presencia de la navegación correcta (tab bar en móvil, barra
lateral en escritorio).

## Riesgos y mitigaciones

- **Destello de tema en el primer pintado** → `color-scheme: light dark` en `:root` para que el fondo
  del navegador siga al sistema antes de JavaScript, y el riesgo residual (los `dark:` internos de
  shadcn) está acotado a unos milisegundos. Si resulta visible en un móvil real, la alternativa es el
  script en línea con su `'sha256-'` en la CSP y un test que recalcule el hash, lo que evita que se
  rompa en silencio.
- **`vite preview` puede no encajar con `@cloudflare/vite-plugin`** → tarea temprana que lo verifica
  levantando el build; el plan B es una línea (`command` del `webServer` a `pnpm dev`).
- **Falsos positivos en la comprobación de 44 px** → tolerancia de 0,5 px y medición por rol sobre
  elementos concretos, no sobre todos los interactivos del documento.
- **Duplicación de la navegación si los dos componentes se montan a la vez** → cada uno se renderiza
  solo en su rango, comprobado con un test que afirme que en 360 px no existe la barra lateral y a
  1280 px no existe la tab bar.
- **El bundle crece por `drawer`, `dialog`, `toast` e iconos** → se mide el JS comprimido de la carga
  inicial antes de dar el cambio por terminado; si se pasa de 200 KB, se recorta entrando por
  `lazy()` en las rutas y no reduciendo el shell.
- **`localStorage` no disponible** → acceso envuelto; degrada a "seguir al sistema".
- **Revisar en horizontal (768 px) muestra la tab bar abajo y sin la barra lateral** → decisión
  deliberada, documentada más arriba.

## Migración y reversión

- **Migración de datos:** ninguna. **Pasos manuales de despliegue:** ninguno más allá de
  `pnpm deploy`, porque no hay secretos, bindings, migraciones ni cron nuevos.
- **Reversión:** revertir el pull request. No queda estado en D1 ni en el navegador más allá de la
  clave `nexus:theme` en `localStorage`, que una versión anterior simplemente ignora. La única
  consecuencia de no revertir es que la raíz deja de mostrar la comprobación de la API.
- **En cada equipo de desarrollo:** `pnpm exec playwright install chromium`, y añadirlo a la sección
  "Preparar un equipo nuevo" de `docs/PROGRESS.md`.

## ADR y documentación

- **ADR-010 (nueva) · El tema se resuelve en JavaScript y sin script en línea, por la CSP.** La CSP
  restrictiva de `docs/ARCHITECTURE.md §3.2` descarta el script en línea; el coste —un posible
  destello mínimo al cargar— se acepta frente a atar `index.html` y `public/_headers` byte a byte.
- **ADR-008 (enmienda) · La verificación responsive se ejecuta sin credenciales.** Playwright entra en
  la CI interceptando `**/api/*` con `page.route` contra los assets construidos, sin `ACCESS_AUD`,
  sin `ACCESS_DEV_BYPASS` y sin escribir nada en `.dev.vars`.
- `docs/ARCHITECTURE.md §2.2` suma las piezas nuevas del front y su regla de un solo overlay.
- `docs/DESIGN.md §5` deja de decir "pendiente de validar" cuando la dirección visual se haya visto en
  pantalla.
- `AGENTS.md §4` deja de avisar de que `pnpm test:e2e` no existe.

## Open Questions

Diferibles sin tocar la spec, el enfoque ni el reparto de tareas:

- Si la barra lateral de escritorio debería poder plegarse. Hoy es fija; plegarla es una mejora
  opcional que no cambia ningún comportamiento especificado.
- Si el atajo `N` debe aceptarse también con un teclado externo en móvil. Hoy se documenta solo para
  escritorio, que es donde tiene sentido.
