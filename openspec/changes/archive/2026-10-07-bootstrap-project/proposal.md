# Proposal

## Why

El repositorio tiene directrices, arquitectura y roadmap, pero **no hay una sola línea de código**: sin
`package.json`, sin Worker, sin SPA, sin CI. Todo lo que venga después (Access, shell mobile-first,
tareas, recordatorios) necesita una base sobre la que apoyarse: un Worker con static assets que
sirva la SPA y una API bajo `/api/*`, las herramientas de calidad (Biome, TypeScript estricto,
Vitest) y una CI que verifique cada PR.

Sin ese andamiaje, los cambios siguientes se construirían sobre convenciones improvisadas y cada PR
tendría que volver a decidir la estructura del proyecto. Además, un esqueleto desplegable pronto
permite comprobar que el presupuesto de 0 €/mes (plan gratuito de Cloudflare) es real antes de
escribir la primera funcionalidad.

## What Changes

- **Proyecto y toolchain**: `package.json` con pnpm, Node ≥ 20.19, `pnpm-lock.yaml`, `tsconfig.json`
  estricto (sin `any`), aliases `@/` y configuración de Biome (lint + formato) en modo compatible
  con Tailwind.
- **Worker**: un único Worker (`worker/index.ts` + `worker/app.ts`) con Hono montado en `/api/*`,
  static assets de Vite con `@cloudflare/vite-plugin` y fallback de SPA. Exporta `AppType` para que
  el front use el cliente RPC tipado. Incluye el manejador central de errores (`onError` y
  `notFound`) con la forma `{ error: { code, message } }`.
- **Endpoint observable**: `GET /api/health` devuelve `200` con `{ status: "ok" }`.
- **SPA**: React 19 + React Router + TanStack Query, con un cliente RPC de Hono (`src/lib/api.ts`) y
  una página mínima que consulta `/api/health` y muestra su resultado, con estados de carga y error.
- **Estilos**: Tailwind CSS v4 inicializado y shadcn/ui configurado (tokens y `cn` en
  `src/lib/utils.ts`). Sin dirección visual: solo la base necesaria para que las utilidades
  existan.
- **Datos**: Drizzle ORM configurado contra D1 (binding `DB`, base de datos `nexus-db`,
  `drizzle.config.ts`, `worker/db/schema.ts` y `worker/db/client.ts`). **Sin tablas todavía**.
- **Tests**: Vitest con dos entornos, `@cloudflare/vitest-pool-workers` para el Worker (prueba de
  `GET /api/health`) y entorno jsdom para la SPA. Sin `pnpm test:e2e` (llega con `add-app-shell`).
- **Configuración de Cloudflare**: `wrangler.jsonc` con assets, `run_worker_first: ["/api/*"]`, binding
  D1 con `database_id` como **placeholder marcado** y variables no secretas. La base de datos la
  crea el humano con `wrangler d1 create nexus-db`.
- **CI**: workflow de GitHub Actions que ejecuta install, lint, typecheck, test y build en cada PR
  (y en `main`). Sin despliegue.
- **Scripts**: todos los de `AGENTS.md §4` salvo `test:e2e`.
- **Documentación**: `.dev.vars.example` sin secretos nuevos, `README.md` actualizado con la puesta
  en marcha y el paso manual de crear la D1, y `docs/PROGRESS.md` marcando el cambio 0.1.

## Capabilities

### New Capabilities

- `api-health`: contrato del endpoint de salud del Worker (`GET /api/health`), accesible sin
  autenticación, que sirve tanto para comprobar el despliegue como para que la SPA valide que la API
  está viva.
- `app-bootstrap`: el proyecto vacío pero ejecutable: scripts de `AGENTS.md §4`, Worker con static
  assets y Hono en `/api/*`, SPA mínima que consulta la salud de la API, Drizzle contra D1 sin
  tablas, y CI con lint, typecheck, test y build.

### Modified Capabilities

Ninguna: `openspec/specs/` está vacío.

## Impact

- **Fase del roadmap**: fase 0 (Cimientos), cambio 0.1 — el primero de la fase.
- **Dependencias nuevas**: las del stack de `AGENTS.md §2` que este cambio usa de verdad (Vite, Hono,
  Drizzle, React, React Router, TanStack Query, Tailwind, shadcn/ui, Biome, Vitest, wrangler), más las
  piezas auxiliares imprescindibles para que funcionen, justificadas en `design.md §1`:
  `@vitejs/plugin-react`, `@tailwindcss/vite`, `jsdom` y Testing Library. Zod y `@hono/zod-validator`
  **no** se instalan todavía: llegan con el primer endpoint que valide entrada.
- **Bindings nuevos**: `DB` (D1). Ya previsto en `docs/ARCHITECTURE.md §2.3`.
- **Secretos nuevos**: ninguno. `.dev.vars.example` no cambia.
- **Límites del plan gratuito**: **ningún impacto**. El único endpoint hace una respuesta estática
  sin queries; los assets estáticos no cuentan como peticiones al Worker y `run_worker_first:
  ["/api/*"]` evita que el Worker atienda el tráfico de la SPA. El cron y las subpeticiones siguen
  sin usarse (no hay jobs).
- **Coste**: 0 €.
- **Riesgo de reversión**: el cambio es aditivo; se revierte borrando el andamiaje. La única
  dependencia del estado externo es la base de datos D1, que se crea manualmente y no se borra.