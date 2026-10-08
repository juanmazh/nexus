# Proposal

## Why

Hoy Nexus es un shell: navega, muestra estados vacíos y comprueba que la API vive, pero no guarda
nada. La primera funcionalidad que la persona necesita a diario es poder apuntar una tarea en la
calle y ver la cola del día, y eso exige almacenamiento: hasta que no exista, el proyecto no puede
cumplir su regla de oro de `docs/ROADMAP.md` ("no se empieza una fase hasta que la anterior está
desplegada y usándose") y el aviso por Telegram de `add-reminders` no tiene sobre qué aplicarse.

Este cambio es la Fase 1 (cambio **1.1**), la primera tabla real, la primera migración y el primer
CRUD completo de la aplicación.

## What Changes

- **Tabla `tasks`** en D1 con el modelo de `docs/ARCHITECTURE.md §4`: `id` (uuid), `title`,
  `notes`, `status` (`todo`/`done`), `priority` (`low`/`medium`/`high`), `due_at`, `completed_at`,
  `created_at` y `updated_at`, todos los instantes como `integer` epoch ms UTC. Índice `(status, due_at)`.
- **CRUD `/api/tasks`** con `GET` (filtros `status` y `overdue`, orden por `due_at` con los nulos al
  final), `POST`, `PATCH /api/tasks/:id` y `DELETE /api/tasks/:id`. Pasar a `done` rellena
  `completed_at`; volver a `todo` lo limpia. Validación con Zod en `shared/`, reutilizada por el front.
- **Vista de lista en `/tasks`** con secciones **Vencidas / Hoy / Próximas / Sin fecha**, sobre el
  `ViewHeader`, `SkeletonList` y `EmptyState` que ya existen. Las completadas están ocultas por
  defecto detrás de un interruptor "Hechas (N)" que además permite deshacerlas.
- **La barra de captura crea tareas.** Es la interacción firma de `docs/DESIGN.md §5`: título y
  nada más (la fecha se añade después, desde el detalle), con actualización optimista y rollback.
- **Detalle de tarea en `ResponsiveDialog`** (bottom sheet en móvil, diálogo en escritorio) para
  editar título, notas, prioridad y fecha con `input` nativo de tipo `date`. Completar con un toque
  en el *check* de la fila; borrar desde el detalle, con confirmación explícita.
- **Dependencias nuevas:** `zod` y `@hono/zod-validator` (ya fijados en `AGENTS.md §2`, pero nunca
  instalados porque hasta ahora no había nada que validar) y `date-fns` + `@date-fns/tz` (idem:
  están en el stack documentado y son la capa de fechas acordada).

### Dependencia previa (bloqueante)

`add-tasks` **no puede aplicarse hasta que `add-app-shell` esté mergeado y archivado**. Este cambio
modifica el requisito *Barra de captura* de la capacidad `app-shell`, que hoy dice "no persiste
nada y no llama a la API"; esa capacidad solo existe en `openspec/specs/` cuando su cambio se
archiva, y `AGENTS.md §7.4` prohíbe editar las specs principales a mano. Ver `design.md §1`.

### Fuera de alcance

- **La vista Hoy.** `/` sigue con su estado vacío y su marcador de "ahora"; el resumen de hoy es
  `add-home-dashboard` (2.3), que reutilizará los filtros `status`/`overdue` de la API.
- **Recordatorios.** Tabla `reminders`, cron, Telegram y los chips de aviso en el detalle son
  `add-reminders` (1.2).
- **Controles de filtro en la interfaz.** La API soporta `status` y `overdue` y los cubre con tests,
  pero la vista no muestra chips todavía: solo el interruptor de "Hechas" que se ha decidido aquí.
- **Etiquetas, subtareas, repetición y tareas recurrentes** (backlog de `docs/ROADMAP.md`).
- **Borrado lógico.** No hay columna `deleted_at` en el modelo: borrar es borrar.
- **PWA** (`add-pwa`, 1.3) y cualquier ajuste del shell que no sea conectar la barra de captura.

## Capabilities

### New Capabilities

- `tasks`: la tarea como dato y como comportamiento observable — persistencia, el contrato CRUD de
  `/api/tasks` con sus filtros, su orden y su semántica de completar, y la vista de lista con
  secciones, el interruptor de completadas y el detalle en *sheet*/*diálogo*.

### Modified Capabilities

- `app-shell`: el requisito *Barra de captura* deja de ser "solo interfaz" y pasa a crear una tarea
  real desde cualquier sección, con actualización optimista. El resto del shell no cambia.
  **Este delta solo se puede escribir cuando `add-app-shell` esté archivado** (ver *Dependencia
  previa*).

## Impact

| Área | Impacto |
|---|---|
| Esquema | Nueva tabla `tasks` + índice `(status, due_at)`. **Primera migración** del proyecto: `migrations/` deja de estar vacío. No es destructiva (solo un `CREATE TABLE`). |
| Worker | `worker/routes/tasks.ts`, `worker/services/tasks.ts`, `shared/tasks.ts`, `.route("/tasks", tasks)` en `worker/app.ts`. |
| Front | `src/features/tasks/` (api, hooks, `tasks-page`, `task-list`, `task-row`, `task-detail-sheet`, `task-done-toggle`), `onSubmit` en `capture-bar.tsx` y en `app-shell.tsx`. |
| Configuración | Ningún binding ni var nuevo. Ningún secreto nuevo (los de `add-reminders` no se tocan). |
| Dependencias | +4: `zod`, `@hono/zod-validator`, `date-fns`, `@date-fns/tz`. Todas ya nombradas en `AGENTS.md §2`; justificación en `design.md §3`. |
| Tests | ~30 tests de Vitest nuevos (servicio, rutas, hooks, vista) y ~8 de Playwright en los dos viewports. `e2e/fixtures.ts` necesita una rama que sirva `/api/tasks`. |
| Plan gratuito | 1 query por lectura de lista, 1 escritura por mutación. Con ~100 peticiones/día de un único usuario quedan ~4 órdenes de magnitud de margen (presupuesto: 100.000/día). Detalle en `design.md §6`. |
| Docs | `docs/ARCHITECTURE.md` §2.2 y §4 se actualizan al archivar; `docs/PROGRESS.md` marca el cambio. |
