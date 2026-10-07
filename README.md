# Nexus

**Mi suite personal en el edge:** tareas, recordatorios, notas y, pronto, un blog. Pensada para
usarse **desde el móvil primero** (instalable como app), en un único Cloudflare Worker protegido
con Zero Trust y con un coste de **0 €/mes**.

> 🚧 En construcción. El progreso real está en [`docs/PROGRESS.md`](docs/PROGRESS.md).

---

## ¿Por qué existe?

Quería un "centro de operaciones" propio en lugar de repartir mi día entre cinco apps distintas,
y usarlo de excusa para practicar arquitectura serverless y **desarrollo guiado por especificaciones con agentes de IA**.

## Stack

| Capa | Tecnología |
|---|---|
| Runtime | Cloudflare Workers (static assets + API en un solo Worker) |
| API | Hono · Zod · cliente RPC tipado de extremo a extremo |
| Datos | Cloudflare D1 (SQLite) · Drizzle ORM |
| Frontend | React 19 · TypeScript · TanStack Query · Tailwind · shadcn/ui |
| Auth | Cloudflare Access (Zero Trust) + validación del JWT en el Worker |
| Avisos | Cron Triggers → bot de Telegram |
| Calidad | Vitest · Playwright (móvil y escritorio) · Biome · GitHub Actions |

## Arquitectura

```text
Navegador ─► Cloudflare Access ─► Worker "nexus"
                                    ├─ /*      SPA React (static assets)
                                    ├─ /api/*  Hono ─► Drizzle ─► D1
                                    └─ cron    recordatorios ─► Telegram
```

Detalles, modelo de datos y decisiones (ADRs) en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Funcionalidades

- [ ] Fase 0 — Cimientos: Worker, CI, autenticación con Access y shell mobile-first
- [ ] Fase 1 — Tareas, recordatorios por Telegram e instalación como app (PWA)
- [ ] Fase 2 — Notas, enlaces rápidos y página de inicio
- [ ] Fase 3 — Dominio propio y blog público
- [ ] Fase 4 — Finanzas y gráficas
- [ ] Fase 5 — Calendario

Detalle en [`docs/ROADMAP.md`](docs/ROADMAP.md). Principios de diseño en [`docs/DESIGN.md`](docs/DESIGN.md).

## Cómo se construye

Este proyecto se desarrolla con **spec-driven development**:

1. Cada funcionalidad empieza como una propuesta de [OpenSpec](https://github.com/Fission-AI/OpenSpec) (`openspec/changes/`): propuesta, requisitos con escenarios, diseño y tareas.
2. Yo reviso y apruebo la propuesta antes de que exista una sola línea de código.
3. Un agente de IA (OpenCode) implementa las tareas siguiendo [`AGENTS.md`](AGENTS.md).
4. Reviso el PR, la CI valida y, al archivar, las specs vivas de `openspec/specs/` reflejan lo que hace el sistema.

El proceso completo está en [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

## Desarrollo local

Requiere **Node ≥ 20.19** y **pnpm** (`corepack enable` si Node ≤ 24; con Node ≥ 25, `npm i -g pnpm`).

```bash
pnpm install
pnpm dev
```

`pnpm dev` levanta a la vez el servidor de Vite y el Worker con la **D1 local** de Miniflare, así que
la SPA y la API quedan disponibles en el mismo origen (`http://localhost:5173`).

`/api/*` **exige una sesión de Cloudflare Access**; la única excepción es `GET /api/health`. Como en
local no hay Access delante, se puede activar el atajo de desarrollo poniendo `ACCESS_DEV_BYPASS=1` en
`.dev.vars`: solo sirve si además la petición viene de `localhost`, así que en un despliegue denegaría
igual (ver [`docs/ARCHITECTURE.md` ADR-009](docs/ARCHITECTURE.md)). Para tocar rutas autenticadas de
verdad, deja el atajo desactivado y pega en `.dev.vars` el **AUD tag** de la aplicación de Access
(`ACCESS_AUD`).

### Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor local (Vite + Worker + D1 local) |
| `pnpm build` | Build de producción |
| `pnpm typecheck` | `tsc` en modo estricto, sin emitir |
| `pnpm lint` / `pnpm format` | Biome (check / write) |
| `pnpm test` | Vitest (proyectos `worker` y `web`) |
| `pnpm test:e2e` | Playwright (proyectos móvil 360 px y escritorio 1280 px) |
| `pnpm db:generate` | Genera la migración SQL desde `worker/db/schema.ts` |
| `pnpm db:migrate:local` | Aplica migraciones en la D1 local |
| `pnpm db:migrate:remote` | Aplica migraciones en producción (**solo la persona propietaria**) |
| `pnpm cf-typegen` | `wrangler types`: regenera los tipos de `Env` |
| `pnpm deploy` | Despliegue (**solo la persona propietaria o la CI**) |

`pnpm test:e2e` levanta por su cuenta el build con `vite preview` e intercepta las peticiones a
`/api/*`, así que no necesita `ACCESS_AUD` ni nada escrito en `.dev.vars`. La primera vez en cada
equipo hay que instalar el navegador: `pnpm exec playwright install chromium`.

### Despliegue

La base de datos D1 de producción (`nexus-db`) ya está creada y su `database_id` está en
`wrangler.jsonc`. En local se usa siempre la D1 de Miniflare.

```bash
pnpm wrangler secret put ACCESS_AUD   # AUD tag de la aplicación de Access; solo la persona propietaria
pnpm deploy                           # hace el build y despliega; solo la persona propietaria
```

Después del primer despliegue hay que comprobar a mano, en el dominio real:

- `GET /api/health` → `200` **sin** sesión.
- `GET /api/me` → `401` sin sesión y `200` con la sesión del navegador.
- La SPA carga **sin violaciones de CSP** en la consola del navegador.

Ningún paso de despliegue lo hace el agente: `opencode.json` los bloquea a propósito.

## Autor

**Juan Manuel Zafra (Juanma)** — desarrollador web.
