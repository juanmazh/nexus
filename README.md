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

> Disponible a partir del cambio `bootstrap-project` (fase 0).

```bash
pnpm install
cp .dev.vars.example .dev.vars   # y rellena los valores
pnpm db:migrate:local
pnpm dev
```

## Autor

**Juan Manuel Zafra (Juanma)** — desarrollador web.
