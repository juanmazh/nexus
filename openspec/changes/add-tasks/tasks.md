# Tasks

## 0. Antes de tocar código

- [x] 0.1 Confirmar que `add-app-shell` está mergeado y archivado, y que `openspec/specs/app-shell/spec.md` existe. Si no lo está, **parar aquí** y avisar: es la dependencia de `design.md D1`.
- [x] 0.2 Delta de `app-shell` resuelto en la revisión: como un MODIFIED no puede eliminar el escenario "La barra de captura todavía no guarda nada", el requisito *Barra de captura* se retira (REMOVED) y se sustituye por *Barra de captura que crea tareas* (ADDED). Validado con `openspec validate add-tasks --strict` y con un archivado de prueba tras archivar `add-access-auth` y `add-app-shell`.
- [x] 0.3 `git switch -c change/add-tasks` desde `main` actualizado. Verificar con `git branch --show-current`.

## 1. Dependencias y esquema

- [x] 1.1 `pnpm add zod @hono/zod-validator date-fns @date-fns/tz`. Verificar que las cuatro aparecen en `package.json` y que `pnpm typecheck` sigue en verde.
- [x] 1.2 Declarar `tasks` en `worker/db/schema.ts` con los nueve campos y los dos índices de `design.md D2`. Verificar con `pnpm db:generate`, revisando que el SQL es solo `CREATE TABLE` más dos `CREATE INDEX`.
- [x] 1.3 `pnpm db:migrate:local` y después `pnpm db:generate` otra vez, para confirmar que el esquema está limpio y no genera una segunda migración. Verificar que `migrations/` ya no está vacío.

## 2. Capa compartida

- [x] 2.1 `shared/tasks.ts`: `createTaskSchema`, `updateTaskSchema`, `listTasksQuerySchema` (estricto, `status` y `overdue` con valores cerrados) y `taskIdParamSchema`, con los mensajes en español y los enums `TASK_STATUSES` / `TASK_PRIORITIES`. Verificar con los tests de 2.3.
- [x] 2.2 `shared/dates.ts`: `zonedDayStart`, `zonedDayNumber`, `dueDateToEpochMs`, `epochMsToDueDate` de `design.md D8`, puras y sin DOM.
- [x] 2.3 `shared/tasks.test.ts` y `shared/dates.test.ts`: título vacío y de 201 caracteres, propiedad desconocida, `status` y `overdue` inválidos, campo opcional ausente; y el día del cambio de hora de verano (29 de marzo de 2026), la ida y la vuelta de `dueDateToEpochMs`, y una tarea de hoy a las 18:00 que sigue siendo de hoy. Verificar con `pnpm test` en verde.

## 3. Servicio de tareas

- [x] 3.1 `worker/services/tasks.ts`: `listTasks` con **una** consulta y el `is null` explícito del orden de `design.md D7`, respetando los tres filtros.
- [x] 3.2 `worker/services/tasks.ts`: `createTask`, `updateTask` y `deleteTask`; `updateTaskStatus` como única escritura de `completed_at`, con el `CASE` y el `COALESCE` de `D11`.
- [x] 3.3 `worker/services/tasks.test.ts` contra el D1 real del pool de Cloudflare (el `env` de `cloudflare:test`, no `testEnv()`): orden con nulos al final, los tres filtros, completar dos veces no cambia el instante, deshacer limpia `completed_at`, `updateTask` no toca `completed_at` ni los campos ausentes, que `overdue` no incluye una tarea que vence hoy, que un `updateTask` con los mismos valores devuelve la fila (no "no existe"), y que `deleteTask` indica "no existía" si no hay fila (la ruta lo traduce a `404`). Verificar con `pnpm test` en verde y con la tabla vacía entre tests.

## 4. Rutas de la API

- [ ] 4.1 `worker/routes/tasks.ts` con los `validator` propios de `design.md D5` (json, query y param), `.route("/tasks", tasks)` en `worker/app.ts` y el `405` como `.use("*")` siguiendo el patrón de `health.ts`. Verificar que `AppType` sigue exponiendo la ruta nueva sin tocar nada más.
- [ ] 4.2 `worker/routes/tasks.test.ts`: `200` con lista vacía, `201` al crear con el título normalizado, `400` de validación con la forma `{ error: { code, message } }`, `401` sin sesión, `404` al editar o borrar algo inexistente, `405` con `Allow` en un método no admitido, y el contrato derivado de `AppType` como hace `me.test.ts`. Verificar con `pnpm test` en verde.

## 5. Front: capa de datos

- [ ] 5.1 `src/features/tasks/api.ts` con una función por endpoint sobre el cliente RPC y los tipos derivados con `InferResponseType` (ADR-007), sin tipos escritos a mano.
- [ ] 5.2 `src/features/tasks/group.ts` con `groupTasks(tasks, now, tz)` pura, en el orden Vencidas / Hoy / Próximas / Sin fecha, sin reordenar. Test en el mismo grupo (`group.test.ts`) con `now` fijo: día de hoy que ya pasó, día anterior, futuro, sin fecha, y completadas que no aparecen en ninguna sección.
- [ ] 5.3 `src/features/tasks/use-tasks.ts`: queries con `staleTime` acorde a `providers.tsx` y las mutaciones de crear, completar, editar y borrar con actualización optimista y rollback. Test (`use-tasks.test.tsx`) del rollback al fallar la creación y al completar.

## 6. Front: vista de lista

- [ ] 6.1 `src/features/tasks/task-row.tsx`: fila con `<button>` de abrir el detalle y `<button>` de completar de `size-11` separado, `min-w-0` y `truncate` en el texto, etiqueta de texto "Alta" para `high` y fecha corta con `tabular-nums`. Test que comprueba las clases táctiles y los `aria-label`.
- [ ] 6.2 `src/features/tasks/tasks-page.tsx`: `ViewHeader` con el recuento, `SkeletonList` cargando, error con reintento, `EmptyState` solo cuando no hay nada, y las secciones en el orden de `design.md D14`. Test de los tres estados con el cliente RPC mockeado como hace `health-panel.test.tsx`.
- [ ] 6.3 Interruptor `Hechas (N)` con `<button aria-pressed>`. Para saber N con el interruptor cerrado, la vista hace **dos** consultas al abrir `/tasks` (pendientes y `?status=done`), cada una con su índice; el interruptor solo muestra u oculta la segunda, deja las completadas al final y baja el contador al completar o borrar una de ellas. Test con `?status=done` mockeado.

## 7. Front: detalle y captura

- [ ] 7.1 `src/features/tasks/task-detail-sheet.tsx` sobre `ResponsiveDialog`: título, notas, prioridad y `<input type="date">`; errores junto al campo con `aria-invalid` y `aria-describedby`; acciones de guardar y borrar; confirmación de borrado explícita con el título de la tarea. Test de guardar con cambios, de guardar sin cambios, de título vacío y de cancelar el borrado.
- [ ] 7.2 `useCreateTask` conectado a los dos `CaptureBar` de `AppShell` (`design.md D10`), con `CaptureBar` capaz de reponer el texto y de marcar `aria-busy` sin bloquear el campo. Test de captura optimista, de reposición del texto al fallar y de envío en blanco.
- [ ] 7.3 `pnpm build` y anotar el tamaño del bundle de la vista de tareas. Verificar que la carga inicial sigue por debajo de 200 kB comprimidos (`docs/DESIGN.md §4`).

## 8. End-to-end y verificación manual

- [ ] 8.1 `e2e/fixtures.ts`: ramas por método y ruta para `/api/tasks`, con el array en memoria de `design.md D15`. Verificar que `pnpm test:e2e` deja `shell.spec.ts` en verde sin tocarlo.
- [ ] 8.2 `e2e/tasks.spec.ts`: crear desde la barra de captura, completar con el check, abrir el detalle como hoja inferior en móvil y como diálogo en escritorio, y borrar con confirmación. Con `expectNoHorizontalScroll` y `expectTactileTargets` en cada vista nueva, en los dos viewports. Verificar con `pnpm test:e2e` en verde.
- [ ] 8.3 Verificación manual de `docs/DESIGN.md §6`: 360, 390, 768 y 1280 px en DevTools, 320 px sin romperse, teclado virtual abierto en el detalle sin tapar el botón de guardar, modo claro y oscuro, y **un móvil real** sobre el despliegue (con `pnpm dev --host` la API responde `401`, porque el atajo local solo vale para `localhost`). Anotar el resultado en `docs/PROGRESS.md`.

## 9. Documentación y definición de hecho

- [ ] 9.1 Actualizar `docs/ARCHITECTURE.md` §2.1, §2.2 y §4 con lo realmente implementado (la tabla `tasks`, el segundo índice, `routes/tasks.ts`, `services/tasks.ts`, `shared/tasks.ts` y `shared/dates.ts`). Verificar que las tablas del documento coinciden con `worker/db/schema.ts`.
- [ ] 9.2 Revisar `AGENTS.md §2` para confirmar que las cuatro dependencias ya instaladas figuran como en el stack, y `docs/ROADMAP.md` para marcar `add-tasks` como entregado.
- [ ] 9.3 Definición de hecho de `AGENTS.md §9`: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` y `pnpm test:e2e` en verde, `pnpm db:migrate:local` aplicada, y `openspec validate add-tasks --strict` sin errores.
- [ ] 9.4 Auditoría de secretos y datos personales (`AGENTS.md §6.5`): `git grep` de `token`, `secret` y `password` sin resultados, ningún email real ni `chat.id` versionado, y los datos de ejemplo de `e2e/fixtures.ts` ficticios.
- [ ] 9.5 Commit por grupo de tareas, en inglés y con Conventional Commits (`feat(tasks): ...`, `test(tasks): ...`, `docs(tasks): ...`).

## Workflow follow-up

- Pasos manuales de la persona dueña, en este orden: `pnpm db:migrate:remote` **antes** del deploy, `pnpm deploy`, y comprobar en el despliegue real que `/tasks` carga, que crear desde la barra de captura funciona y que `GET /api/health` sigue en `200`.
- Abrir el PR, mergear a `main` y archivar con `/opsx-archive add-tasks`.
