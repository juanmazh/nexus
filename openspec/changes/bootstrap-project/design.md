# Design

## Context

El repositorio solo tiene documentación. Hay que crear el andamiaje completo sin poder ejecutar
`pnpm install` todavía en este equipo (pnpm no está instalado; se resuelve en la tarea 0 del plan de
tareas, con `corepack enable` documentado). Todo lo que sigue se apoya en las versiones **actuales**
de las herramientas del stack cerrado de `AGENTS.md §2`, no en memoria.

Dos hechos del panorama actual condicionan el diseño y se resolvió con el dueño de este cambio:

1. Cloudflare renombró `@cloudflare/vitest-pool-workers` a **`@cloudflare/vitest-plugin`** (v1.3.7).
   Misma API (`cloudflareTest`), pero la documentación oficial ya solo cubre el nombre nuevo e
   incluye un codemod de migración. **Decisión del dueño: usar el nombre nuevo y corregir `AGENTS.md`.**
2. `typescript@latest` es **7.0.2**, el compilador nativo en Go: elimina `baseUrl`, `preserveConstEnums`
   y la API programática estable. **Decisión del dueño: fijar `typescript@5.9.3`**, la estable más
   probada por el ecosistema.

## Goals / Non-Goals

**Goals:**

- `pnpm install && pnpm dev` levanta Worker + SPA + D1 local en un solo proceso y en un solo origen.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` y `pnpm build` en verde, y una CI que los ejecute en cada PR.
- La SPA llama a la API por el cliente RPC tipado de Hono: si el contrato cambia, el typecheck del
  front falla (ADR-007).
- La estructura de carpetas de `AGENTS.md §3` existe completa, aunque la mayoría esté vacía.
- Coste 0 €: cero consultas a D1 por petición y el Worker solo atiende `/api/*`.

**Non-Goals:**

- Autenticación, cabeceras de seguridad, `GET /api/me`, el cron y los jobs: son `add-access-auth` y
  `add-reminders`.
- Cualquier tabla de negocio o migración D1.
- Layout, tema "olivar", shell, `ResponsiveDialog`, Playwright (`test:e2e`): es `add-app-shell`.
- Despliegue automático. El despliegue es manual hasta `add-home-dashboard` (2.3).

## Decisions

### 1. Versiones fijadas

Todas las versiones se ciñen a lo publicado hoy y se fijan con `^` en `package.json`, salvo casos
señalados. No se usa ninguna dependencia fuera de `AGENTS.md §2`.

| Paquete | Versión | Nota |
|---|---|---|
| `typescript` | `^5.9.3` | Decisión del dueño. Sin `baseUrl` ni opciones de TS 7. |
| `vite` | `^8.3.3` | Requisito de `@cloudflare/vite-plugin` y `@vitejs/plugin-react` 6. |
| `@cloudflare/vite-plugin` | `^1.63.0` | Peer: `wrangler ^4.148.0` → `wrangler@^4.148.0`. |
| `@vitejs/plugin-react` | `^6.1.2` | Peer: `vite ^8`. Los peers opcionales (oxc, react-compiler) no se instalan. |
| `react` / `react-dom` | `^19.3.0` | `react-router@8` exige `react >= 19.2.7`. |
| `react-router` | `^8.4.0` | Router en modo `createBrowserRouter`; una sola ruta por ahora. |
| `@tanstack/react-query` | `^5.104.1` | |
| `hono` | `^4.13.13` | |
| `drizzle-orm` | `^0.45.3` | |
| `drizzle-kit` | `^0.31.11` | Sin peers. |
| `tailwindcss` / `@tailwindcss/vite` | `^4.3.3` | v4: CSS-first, sin `tailwind.config.js`. |
| `shadcn` (CLI) | `^4.21.3` | Se ejecuta una vez con `dlx`; queda como devDependency para reproducibilidad. |
| `vitest` | `^4.1.11` | **No** 5.x: el peer de `@cloudflare/vitest-plugin` es `^4.1.0`. |
| `@vitest/runner`, `@vitest/snapshot` | `^4.1.11` | Peers obligatorios del plugin, a la misma versión que Vitest. |
| `@cloudflare/vitest-plugin` | `^1.3.7` | Sustituye a `vitest-pool-workers`. |
| `jsdom` | `^30.1.2` | Entorno del proyecto de tests del front. |
| `@testing-library/react` | `^16.3.3` | + `@testing-library/jest-dom` `^7.0.1` y `@testing-library/user-event` `^14.6.7`. |
| `@biomejs/biome` | `^2.5.15` | |
| `wrangler` | `^4.148.0` | |

**Descartado**: `vitest@5` junto a `@cloudflare/vitest-plugin` (peer incompatible; habría avisos de
peer y riesgo de fallo en runtime de `workerd`).

**Aplazado**: `zod` y `@hono/zod-validator`. `/api/health` no recibe entrada, así que se instalarán con
el primer endpoint que valide datos. **Descartado** `vite-tsconfig-paths`: los alias se declaran una
vez en `resolve.alias` de Vite (ver §2), sin dependencia extra.

**Dependencias auxiliares** (no figuran en `AGENTS.md §2` porque son parte de las piezas que sí
figuran): `@vitejs/plugin-react` (React en Vite), `@tailwindcss/vite` (Tailwind v4 en Vite), `jsdom` y
Testing Library (tests de la SPA con Vitest) y `@types/node` (tipos de `tsconfig.node.json`).

### 2. Configuración de Vite y del Worker

`vite.config.ts` declara `plugins: [react(), tailwindcss(), cloudflare()]`. El plugin de Cloudflare
crea un entorno de Vite para el Worker (`nexus`) además del entorno `client` de la SPA. Los alias se
declaran **una sola vez** en `resolve.alias`, que aplica a los dos entornos: `@/` → `src/` y
`@shared/` → `shared/`. Los mismos alias se repiten en los `paths` de los tsconfig (§5). No hace
falta configuración específica bajo `environments.nexus`.

`wrangler.jsonc`:

- `assets.not_found_handling: "single-page-application"` + `run_worker_first: ["/api/*"]`: el
  navegador recibe `index.html` para cualquier ruta y las peticiones a `/api/*` llegan al Worker.
  Con `compatibility_date` de 2026 las peticiones de navegación no invocan el Worker, así que la
  carga de la SPA no consume invocaciones.
- `d1_databases`: `binding: "DB"`, `database_name: "nexus-db"`, `migrations_dir: "migrations"` y
  `database_id` con un **placeholder**:
  ```jsonc
  // TODO(setup): sustituye este UUID por el que devuelva
  //   pnpm wrangler d1 create nexus-db
  // Until entonces, `pnpm dev` usa la D1 local de Miniflare y funciona igual.
  "database_id": "00000000-0000-0000-0000-000000000000"
  ```
  Un UUID con la forma correcta (todo ceros) es necesario: Miniflare valida el formato, así que una
  cadena tipo `<id>` rompe el arranque local. La D1 local de `.wrangler/` se crea sola, por eso
  `pnpm dev` funciona sin el paso manual.
- `vars`: solo `APP_TIMEZONE: "Europe/Madrid"`. `ACCESS_TEAM_DOMAIN` **no** se declara todavía: la
  usa el middleware de Access, que es de `add-access-auth`, y un valor inventado sería un
  placeholder más que mantener.
- **Sin `triggers.crons`**: no hay jobs todavía. El cron único `*/5 * * * *` se añade con
  `add-reminders` (`docs/ARCHITECTURE.md §2.3` lo describe como parte de la plantilla, pero la
  funcionalidad no existe aún y un cron vacío ocuparía uno de los 5 Cron Triggers de la cuenta sin
  hacer nada).

`main: "./worker/index.ts"`, que exporta `fetch` (la app de Hono) y un `scheduled` **no** se exporta
todavía. Se deja constancia en `design.md` de que se añade con `add-reminders`.

### 3. Estructura y separación de responsabilidades

`AGENTS.md §3` se crea tal cual, incluyendo `e2e/` (vacía, con un `.gitkeep`) y `migrations/`, para que
los cambios siguientes no empiecen moviendo ficheros. Los ficheros con contenido real son pocos:

```text
worker/index.ts          # export default { fetch: app.fetch }
worker/app.ts            # Hono, monta /api/*, exporta AppType
worker/middleware/errors.ts   # onError (500) y notFound (404) → { error: { code, message } }
worker/routes/health.ts  # GET / → 200 { status: "ok" }; resto de métodos → 405 + Allow: GET
worker/db/schema.ts      # vacío (solo el comentario de "fuente única")
worker/db/client.ts      # createDb(env): DrizzleD1Database<typeof schema>
shared/                  # vacío; placeholder .gitkeep
src/main.tsx, src/app/{providers,router}.tsx
src/features/health/{api.ts,use-health.ts,health-page.tsx}
src/lib/api.ts           # hc<AppType>('/')
src/lib/utils.ts         # cn() para shadcn
```

El manejador de errores entra ya en este cambio (no en `add-access-auth`) porque el requisito de
`{ error: { code, message } }` es parte del contrato de `/api/health` y sin él el `404` de
`/api/no-existe` devolvería el HTML de la SPA. Es middleware de la **capa HTTP**, no lógica de
negocio: `AGENTS.md §3` lo ubica en `worker/middleware/`.

Dos detalles de Hono que hay que cubrir de forma explícita (comprobados con `hono@4.13`):

- `app.onError` **no** captura las rutas inexistentes: sin `app.notFound(...)`, Hono responde `404`
  en `text/plain`. Por eso `errors.ts` exporta los dos manejadores y `app.ts` registra ambos.
- Un `POST` a una ruta que solo define `GET` devuelve `404`, no `405`. La ruta de salud declara
  `.get("/", ...)` y después `.all("/", ...)` que responde `405` con `Allow: GET` y la forma de error.

`AppType` se exporta como el tipo del resultado **encadenado** (`const routes = app.route("/health",
health); export type AppType = typeof routes`), que es lo que necesita `hc` para inferir las rutas.

`worker/app.ts` monta Hono con `basePath: "/api"`, y `worker/index.ts` devuelve el `fetch` de Hono
como `{ fetch }`. El cliente del front apunta a `hc<AppType>("/")`: como el prefijo vive en el
servidor y forma parte de `AppType`, la llamada en el front es `client.api.health.$get()`.

### 4. Vitest con dos proyectos

Vitest 4 (`vitest@4.1.11`, no 5, por el peer del plugin) con `test.projects` y **dos ficheros de
configuración**, no dos objetos inline:

- `vitest.worker.config.ts` → `defineProject` + `plugins: [cloudflareTest()]` +
  `test.name: "worker"`, `include: ["worker/**/*.test.ts"]`, tipos de `@cloudflare/vitest-plugin/types`.
  Lee `wrangler.jsonc` (`wrangler: { configPath: "./wrangler.jsonc" }`) para el `main`, la
  `compatibility_date` y los bindings, de modo que el test ve el mismo `env` que el Worker.
- `vitest.web.config.ts` → `defineProject` + `plugins: [react()]` y los mismos `resolve.alias` que
  `vite.config.ts`,
  `test.name: "web"`, `environment: "jsdom"`, `setupFiles` con `@testing-library/jest-dom`,
  `include: ["src/**/*.test.{ts,tsx}"]`.
- `vitest.config.ts` → raíz con `test.projects: ["./vitest.worker.config.ts", "./vitest.web.config.ts"]`.
  Los nombres de fichero siguen el patrón `vitest.<name>.config.ts` que Vitest 4 acepta.

Se eligen ficheros separados porque el plugin de Cloudflare debe vivir en el `plugins` del proyecto
que lo usa, y los proyectos inline heredan plugins de la raíz de forma distinta entre versiones. Con
ficheros, cada entorno es explícito y no depende de cómo se resuelve la herencia.

Tests que se escriben:

- `worker/routes/health.test.ts` (`cloudflare:test`): `200` con `{ status: "ok" }`; `POST` devuelve
  `405`; `GET /api/no-existe` devuelve `404` con la forma de error y **no** HTML.
- `src/features/health/health-page.test.tsx` (jsdom): con `client.api.health.$get` simulado, la página
  muestra éxito; si la promesa rechaza, muestra error y el botón de reintentar dispara otra consulta.

El test del Worker no toca D1: `/api/health` no lee la base de datos, así que el binding `DB` está
presente pero sin usar. Cuando haya tablas, las migraciones se aplicarán en un `setupFiles` con
`readD1Migrations("migrations")` + `applyD1Migrations`.

### 5. TypeScript: cuatro tsconfig

`tsc` en modo estricto sobre un proyecto con front, Worker, tests y ficheros de configuración
necesita proyectos separados, cada uno con sus tipos. Cada test vive en el proyecto del código que
prueba, para que tenga los tipos correctos (DOM en el front, `Env` y `cloudflare:test` en el Worker):

- `tsconfig.json`: `files: []`, `references` a los otros tres y **`compilerOptions.paths`** con los
  alias. El CLI de shadcn lee los alias del `tsconfig.json` raíz; sin `paths` ahí, `shadcn init`
  falla con "No import alias found".
- `tsconfig.app.json`: `src/**` y `shared/**`. `jsx: "react-jsx"`, `types: ["vite/client"]`,
  `moduleResolution: "bundler"`, `module: "esnext"`, `target: "es2022"`, `strict: true`,
  `noUncheckedIndexedAccess: true`, `noUnusedLocals`, `noUnusedParameters`,
  `verbatimModuleSyntax: true`, `paths: { "@/*": ["./src/*"], "@shared/*": ["./shared/*"] }` **sin
  `baseUrl`** (relativo al tsconfig, que es lo que TS 5 entiende igual que TS 7). Incluye los
  `src/**/*.test.tsx` con `types: ["vite/client", "@testing-library/jest-dom"]`.
- `tsconfig.worker.json`: `worker/**` (tests incluidos) y `shared/**`,
  `types: ["./worker-configuration.d.ts", "@cloudflare/vitest-plugin/types"]`, `lib: ["es2022"]`
  **sin DOM** (el Worker no tiene `document`), para que un `document` accidental sea un error de tipos.
  `worker-configuration.d.ts` lo genera `pnpm cf-typegen` y **se commitea**, para que la CI pueda
  hacer el typecheck sin credenciales de Cloudflare.
- `tsconfig.node.json`: los ficheros de configuración que se ejecutan en Node (`vite.config.ts`,
  `vitest*.config.ts`, `drizzle.config.ts`), con `types: ["node"]`. Sin él, esos ficheros no se
  comprobarían nunca.

`pnpm typecheck` = `tsc -b` desde el `tsconfig.json` raíz (build de
proyectos, sin emitir: los tres proyectos llevan `noEmit`). Un proyecto no puede referenciar a otro
con `noEmit` en TS < 5.6; con 5.9 está permitido, y así los tres se comprueban con un solo comando.

### 6. Tailwind v4 + shadcn/ui

Tailwind v4 es CSS-first: se inicializa `src/index.css` con `@import "tailwindcss";` y, en el
`index.html`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
No hay `tailwind.config.js` ni `@tailwind base/components/utilities`.

shadcn/ui se inicializa con `pnpm dlx shadcn@latest init` (Vite) y se ejecuta
`shadcn add button` para tener un componente real en `src/components/ui/button.tsx` y `cn` en
`src/lib/utils.ts`. Se añade **solo** `button`: es lo mínimo que demuestra que el sistema funciona
y lo reutilizará el shell. La dirección visual "olivar" y el conmutador de tema son de
`add-app-shell`.

**No** se inventa ningún token de color aquí. `index.css` deja el tema por defecto de shadcn (los
`--background`, `--foreground`, etc. en `:root` y `.dark`) que el shell sustituye después.

Biome necesita `css.parser.tailwindDirectives: true` para parsear las directivas v4 de Tailwind, y
`linter.domains.tailwind: "all"` para activar `noTailwindRawColors` y `useTailwindShorthandClasses`
en el futuro. Biome **no** ordena clases de Tailwind; el orden de clases queda a mano y `pnpm format`
no las reordena, así que no hay conflicto con el estilo de shadcn.

### 7. La página inicial y su test

`src/features/health/health-page.tsx` es la única vista. Móvil primero (`docs/DESIGN.md §4`):

```text
360 px                          ≥ lg
┌──────────────────────┐   ┌────────────────────────────┐
│ Nexus                │   │ Nexus                      │
│                      │   │ ┌────────────────────────┐ │
│ ┌──────────────────┐ │   │ │                        │ │
│ │ Comprobando…     │ │   │ │  Comprobando… / ok /   │ │
│ └──────────────────┘ │   │ │  error                 │ │
│                      │   │ │                        │ │
│ ┌──────────────────┐ │   │ └────────────────────────┘ │
│ │ API: ok           │ │   │                            │
│ └──────────────────┘ │   │ (centrado, máx. legible)   │
│                      │   │                            │
│ [ Comprobar de nuevo ]│   │                            │
└──────────────────────┘   └────────────────────────────┘
```

- Sin `hover`: el botón usa `:active`, no `hover:`. Regla de `docs/DESIGN.md §4`.
- El botón tiene `min-height` de 44 px y margen inferior `env(safe-area-inset-bottom)`.
- Sin estado vacío: no hay datos, hay un resultado. Los tres estados exigidos por `AGENTS.md §5` para
  vistas con datos son carga, éxito y error.
- Textos en español, identificadores en inglés.

La query va con TanStack Query (`useQuery` con `queryKey: ["health"]`) sobre el cliente RPC, no con
`fetch` suelto ni con estado duplicado en `useState`.

### 8. CI

`.github/workflows/ci.yml`: `pull_request` (tipos `opened`, `synchronize`, `reopened`) y `push` a
`main`. Un solo job en `ubuntu-latest`:

1. `pnpm/action-setup` (lee la versión del `packageManager` de `package.json`),
2. `actions/setup-node@v4` con Node 22 y `cache: pnpm`,
3. `pnpm install --frozen-lockfile`,
4. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` en pasos separados, para que el log diga
   cuál falló.

`pnpm-lock.yaml` se commitea, así que `--frozen-lockfile` es seguro. **No** hay paso de despliegue ni
secretos: `CLOUDFLARE_API_TOKEN` no se usa hasta `add-home-dashboard` (2.3).

Windows: el `.gitattributes` fuerza LF y los scripts de `pnpm` son los mismos, así que la CI en Linux
es representativa del despliegue.

### 9. Estimación de coste en el plan gratuito

| Recurso | Consumo de este cambio |
|---|---|
| Peticiones al Worker | 1 por carga de página, **solo** la llamada a `/api/health`. Los assets no cuentan y las navegaciones no invocan el Worker. |
| CPU por invocación | Nula: respuesta estática, sin parseo ni cripto. Margen enorme frente a 10 ms. |
| Subpeticiones | 0. `/api/health` no consulta D1. |
| Filas leídas / escritas en D1 | 0. Sin tablas y sin queries. |
| Cron Triggers | 0 de 5 (no se declara cron). |
| Coste | 0 €. |

### 10. Documentación que hay que corregir en este cambio

El andamiaje obliga a tocar tres documentos para que no describan algo que ya no es cierto:

- **`AGENTS.md §2`**: `@cloudflare/vitest-pool-workers` → `@cloudflare/vitest-plugin`.
- **`AGENTS.md §4`**: marcar que `test:e2e` **no existe todavía** (llega con `add-app-shell`); hasta
  entonces, el requisito de responsive verificado de §9 no aplica en el andamiaje.
- **`AGENTS.md §6.3`**: añadir la excepción que ya prevé `docs/ROADMAP.md` (cambio 0.2): `/api/health`
  es la única ruta de `/api/*` que no pasa por el middleware de Access, porque no devuelve ningún dato.
  Hoy `AGENTS.md` dice "toda ruta" y el roadmap dice "salvo `/api/health`": hay que alinearlos.
- **`docs/ARCHITECTURE.md §2.3`**: el bloque `jsonc` de ejemplo pasa a reflejar la configuración real
  (placeholder del `database_id`, sin cron todavía) y se anota que el cron se añade con
  `add-reminders`.
- **`docs/PROGRESS.md`**: cambio 0.1 en curso o hecho, con el paso manual de crear la D1.
- **`README.md`**: puesta en marcha y enlace a `docs/PROGRESS.md`.

**ADR**: ninguna decisión nueva que registrar en `docs/ARCHITECTURE.md §6`. Se confirma ADR-001 (un
único Worker con static assets) y ADR-003 (D1 + Drizzle); lo único que cambia es la versión de un
paquete ya decidido en ADR-003, no la decisión.

## Risks / Trade-offs

| Riesgo | Impacto | Mitigación |
|---|---|---|
| `vitest@4` en vez de `5` (el `latest`) | Se pierde la versión mayor de Vitest durante un tiempo | El peer de `@cloudflare/vitest-plugin` es `^4.1.0`; subir a 5 exige que Cloudflare lo soporte. Se anota como deuda técnica menor. |
| `typescript@5.9.3` en vez de `7` | No se aprovecha el compilador 10× más rápido | Decisión explícita del dueño. Subirlo es un PR trivial y medible. |
| Placeholder de `database_id` con UUID de ceros | Un despliegue sin sustituirlo fallaría al enlazar D1 | El comentario `TODO(setup)` en el fichero y el paso manual en `docs/PROGRESS.md` y en el `README`. El fallo sería inmediato y visible en el primer `pnpm deploy`, que hace el dueño. |
| El test del Worker lee `wrangler.jsonc` con un `database_id` inválido | `miniflare` podría rechazar la config | Se usa la D1 local (Miniflare no valida el `database_id` remoto para el binding local) y, si hiciera falta, `wrangler.configPath` se combina con `miniflare.d1Databases`. Se verifica en la tarea de tests. |
| `jsx: "react-jsx"` con `@vitejs/plugin-react` 6 (oxc) | Desajuste de transformación de JSX | `plugin-react` y TS usan la misma especificación (`react-jsx`); se comprueba con el test de la página en jsdom y con `pnpm build`. |
| Sin `test:e2e`, la CI no ve regresiones responsive | Un layout roto llega a producción | Fuera de alcance por decisión (`add-app-shell` introduce Playwright). No hay layout en este cambio, así que el riesgo es nulo hoy. |
| shadcn CLI reescribe `components.json` y `index.css` | Puede pisar el `meta viewport` o el `@import "tailwindcss"` | El `index.html` y `index.css` se escriben **después** del `init`, y `pnpm lint` + `pnpm build` lo verifican. |

**Cómo se revierte**: todo es aditivo. Se borra el andamiaje y se vuelve al estado documental. La
única dependencia del estado externo es la base de datos D1, que crea el dueño y no se borra (está
vacía). No hay migraciones que deshacer, ni cambios de esquema, ni secretos que revocar.