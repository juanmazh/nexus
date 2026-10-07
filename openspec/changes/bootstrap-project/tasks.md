# Tasks

## 1. Herramientas y proyecto base

- [ ] 1.1 Comprobar que pnpm está disponible (`pnpm -v`). Si no lo está, **parar y pedírselo al
  humano**: `corepack enable` (Node ≤ 24) o `npm i -g pnpm` (Node ≥ 25 ya no trae corepack). Anotar
  en el `README` el método que funcionó.
- [ ] 1.2 Crear `package.json` con `name: "nexus"`, `private: true`, `type: "module"`,
  `packageManager: "pnpm@<versión instalada>"`, `engines.node: ">=20.19"` y los scripts de
  `AGENTS.md §4` salvo `test:e2e`; verificar que `pnpm run` lista los once scripts.
- [ ] 1.3 Instalar dependencias con las versiones fijadas en `design.md §1` (sin `zod`,
  `@hono/zod-validator` ni `vite-tsconfig-paths`) y verificar
  `pnpm install` sin avisos de peer dependency (en especial Vitest 4 junto a
  `@cloudflare/vitest-plugin`).
- [ ] 1.4 Añadir `.npmrc` con `engine-strict=true` para que un Node antiguo falle en el `install` en
  lugar de en la CI; verificar que `pnpm install` sigue terminando con código `0`.
- [ ] 1.5 Crear la estructura de carpetas de `AGENTS.md §3` (`worker/{middleware,routes,services,db,jobs,integrations}`,
  `shared/`, `src/{app,features,components/ui,lib}/`, `e2e/`, `migrations/`, `.github/workflows/`) con
  `.gitkeep` en las vacías y verificar con `git status` que aparecen sin romperse.

## 2. TypeScript y Biome

- [ ] 2.1 Crear `tsconfig.json` (`references` + `paths`), `tsconfig.app.json`,
  `tsconfig.worker.json` y `tsconfig.node.json` según `design.md §5`, sin `baseUrl` y con `paths`
  relativos al tsconfig.
- [ ] 2.2 Verificar la red de seguridad de tipos: un parámetro sin tipo en `src/` hace fallar
  `pnpm typecheck` (`noImplicitAny`), y un `any` **explícito** hace fallar `pnpm lint` (Biome
  `noExplicitAny`; `tsc` no detecta los `any` explícitos). Después dejar el fichero limpio.
- [ ] 2.3 Verificar el aislamiento del Worker: escribir temporalmente un `document.getElementById`
  en `worker/` y confirmar que `pnpm typecheck` falla por no encontrar `document` (el `lib` del Worker
  no incluye DOM); después borrarlo.
- [ ] 2.4 Crear `biome.json` con `css.parser.tailwindDirectives: true`,
  `linter.domains.tailwind: "all"`, `assist.actions.source.organizeImports` y formato con comillas
  dobles y tabulación, y verificar con `pnpm lint` y `pnpm format` que no cambia nada en seco.

## 3. Configuración de Cloudflare y Vite

- [ ] 3.1 Crear `wrangler.jsonc` según `design.md §2`: nombre `nexus`, `main: "./worker/index.ts"`,
  `compatibility_date` de la fecha del cambio, `assets.not_found_handling:
  "single-page-application"`, `run_worker_first: ["/api/*"]`, `d1_databases` con el placeholder UUID
  de ceros y su comentario `TODO(setup)`, y `vars.APP_TIMEZONE`.
- [ ] 3.2 Crear `vite.config.ts` con `react()`, `tailwindcss()` y `cloudflare()`, y `resolve.alias`
  (`@/` → `src/`, `@shared/` → `shared/`); verificar con `pnpm dev` que Vite arranca sin errores de
  configuración.
- [ ] 3.3 Ejecutar `pnpm cf-typegen` y verificar que se genera `worker-configuration.d.ts` con el
  binding `DB` y el tipo `Env`; el fichero se commitea (`design.md §5`).
- [ ] 3.4 Crear `drizzle.config.ts` (`dialect: "sqlite"`, `schema: "./worker/db/schema.ts"`,
  `out: "./migrations"`) y `worker/db/schema.ts` con el esquema vacío comentado; verificar con
  `pnpm db:generate` que no genera migración ni modifica ficheros.

## 4. Worker: `/api/health`

- [ ] 4.1 Crear `worker/middleware/errors.ts` con `onError` (500) y `notFound` (404), ambos con
  `{ error: { code, message } }` y sin stack trace; crear `worker/app.ts` con Hono en
  `basePath: "/api"` registrando los dos manejadores.
- [ ] 4.2 Crear `worker/routes/health.ts` con `GET /` que responde `200 { status: "ok" }` sin tocar
  D1 y un `.all("/")` posterior que responde `405` con `Allow: GET` y la forma de error; montarlo en
  `app.ts` exportando `AppType` como el tipo de la cadena de rutas; crear `worker/index.ts`
  exportando `{ fetch: app.fetch }`.
- [ ] 4.3 Añadir `worker/db/client.ts` con `createDb(env)` sobre `drizzle(env.DB)` y el tipo
  `NexusDb`; verificar que el fichero compila con `pnpm typecheck` aunque todavía no se use.

## 5. SPA mínima

- [ ] 5.1 Crear `index.html` con el `meta viewport` exacto de `docs/DESIGN.md §4`
  (`width=device-width, initial-scale=1, viewport-fit=cover`), el título en español y
  `<div id="root">`; verificar que no contiene `maximum-scale` ni `user-scalable`.
- [ ] 5.2 Inicializar Tailwind v4 con `src/index.css` (`@import "tailwindcss";` + los tokens por
  defecto de shadcn, sin inventar colores) y verificar que `pnpm build` genera un CSS con las
  utilidades de Tailwind.
- [ ] 5.3 Ejecutar `pnpm dlx shadcn@latest init` y `pnpm dlx shadcn@latest add button`; verificar que
  existen `components.json`, `src/lib/utils.ts` y `src/components/ui/button.tsx`, y que no han
  pisado el `meta viewport` ni el `@import` de Tailwind (revisar `git diff`).
- [ ] 5.4 Crear `src/lib/api.ts` con `hc<AppType>("/")` y `src/app/providers.tsx` con
  `QueryClientProvider`; crear `src/app/router.tsx` con una sola ruta y `src/main.tsx` que monta
  `RouterProvider`; verificar que la SPA compila.
- [ ] 5.5 Crear `src/features/health/api.ts` (llamada al RPC), `use-health.ts` (hook con
  `queryKey: ["health"]`) y `health-page.tsx` con estados de carga, éxito y error, botón
  «Comprobar de nuevo» con área de 44 px, sin estilos de `hover`, y `padding-bottom:
  env(safe-area-inset-bottom)`; verificar a 360 px que no hay scroll horizontal.

## 6. Tests

- [ ] 6.1 Crear `vitest.config.ts` (raíz con `test.projects`), `vitest.worker.config.ts` (con
  `cloudflareTest()` y `wrangler.configPath: "./wrangler.jsonc"`) y `vitest.web.config.ts` (jsdom,
  `@testing-library/jest-dom` y los mismos `resolve.alias` que `vite.config.ts`).
- [ ] 6.2 Escribir `worker/routes/health.test.ts` cubriendo `200 { status: "ok" }`, `POST` → `405` y
  `GET /api/no-existe` → `404` con la forma de error y cuerpo no HTML; verificar que `pnpm test` los
  pasa con el binding `DB` presente en el entorno.
- [ ] 6.3 Escribir `src/features/health/health-page.test.tsx` con el cliente RPC simulado: éxito
  cuando responde, error y reintento cuando la llamada falla; verificar que ambos proyectos de
  Vitest pasan.
- [ ] 6.4 Ejecutar `pnpm test` a secas y verificar que la salida nombra los dos proyectos (`worker` y
  `web`) y que el código de salida es `0`.

## 7. CI

- [ ] 7.1 Crear `.github/workflows/ci.yml` con `pull_request` (`opened`, `synchronize`, `reopened`) y
  `push` a `main`: `pnpm/action-setup`, `actions/setup-node` con Node 22 y `cache: pnpm`,
  `pnpm install --frozen-lockfile` y cuatro pasos separados (`lint`, `typecheck`, `test`, `build`);
  verificar que el YAML es válido y que **no** hay paso de despliegue ni secretos.
- [ ] 7.2 Abrir un push de prueba o dejar la rama lista para que la CI se dispare al abrir el PR;
  verificar que los cuatro pasos aparecen en verde en GitHub Actions.

## 8. Documentación

- [ ] 8.1 Corregir `AGENTS.md §2`: `@cloudflare/vitest-pool-workers` → `@cloudflare/vitest-plugin`;
  corregir `AGENTS.md §4` para marcar que `test:e2e` no existe todavía y llega con `add-app-shell`;
  añadir en `AGENTS.md §6.3` la excepción de `/api/health` (`design.md §10`).
- [ ] 8.2 Actualizar `docs/ARCHITECTURE.md §2.3` con la configuración real (placeholder del
  `database_id`, sin cron) y anotar que el cron único se añade con `add-reminders`; verificar que no
  queda ningún `triggers` en el ejemplo.
- [ ] 8.3 Actualizar `README.md` con la puesta en marcha (`pnpm install`, `pnpm dev`, comandos) y el
  paso manual de crear la D1; actualizar `docs/PROGRESS.md` con el cambio 0.1 y el siguiente paso
  exacto.
- [ ] 8.4 Revisar que ningún fichero versionado contiene secretos, emails reales ni el valor de
  `.dev.vars`; verificar con `git grep -iE "(token|secret|password)\s*[:=]\s*['\"][^'\"]{8}"` que solo
  aparecen nombres de variables.

## 9. Verificación final

- [ ] 9.1 Ejecutar `pnpm typecheck && pnpm lint && pnpm test && pnpm build` y dejar constancia del
  resultado en el PR.
- [ ] 9.2 Ejecutar `pnpm dev`, abrir la SPA en el navegador y comprobar a mano que el estado de éxito
  aparece, que a 360 px no hay scroll horizontal, que el zoom del navegador funciona y que pulsar
  «Comprobar de nuevo» vuelve a consultar la API.
- [ ] 9.3 Ejecutar `pnpm db:generate` y verificar que no se crea ningún fichero en `migrations/`.
- [ ] 9.4 Ejecutar `openspec validate bootstrap-project --strict` y confirmar que pasa sin errores.
- [ ] 9.5 Comprobar la definición de hecho de `AGENTS.md §9`, salvo el punto de `test:e2e`, que no
  aplica en este cambio por decisión de alcance, y dejar constancia de esa excepción en el PR.