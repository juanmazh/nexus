# Tasks

## 1. Esquema y capa compartida

- [x] 1.1 Declarar `reminders` en `worker/db/schema.ts` con la FK `ON DELETE CASCADE` y los dos índices de `design.md D1`. `pnpm db:generate`: el SQL es `CREATE TABLE` más dos `CREATE INDEX`. `pnpm db:migrate:local` y otro `db:generate` sin cambios.
- [x] 1.2 `shared/dates.ts`: `localDateTimeToEpochMs(value, tz)`, que distingue "formato inválido" de "hora inexistente" y toma la primera aparición de una hora repetida (`D2`), y `epochMsToLocalDateTime` para el `min` del selector. Tests de los dos domingos de 2026.
- [x] 1.3 `shared/reminders.ts`: `createReminderSchema` (estricto, `remind_at` con formato) y `reminderIdParamSchema`. Tests.
- [x] 1.4 `formatShortDate` pasa a `shared/format.ts` (`D8`), con `formatReminderTime` ("18:00" si es hoy, "vie 9 oct 9:00" si no). Los imports del front se actualizan y sus tests siguen en verde.

## 2. Servicios

- [x] 2.1 `worker/services/reminders.ts`: `listPendingReminders`, `createReminder` (reglas y orden de `D3`, con una consulta más el `INSERT`) y `cancelReminder` (`D4`). Resultados como unión discriminada para que la ruta traduzca a `404`/`409` sin lanzar.
- [x] 2.2 `worker/services/tasks.ts`: completar cancela los pendientes y borrar borra los avisos, cada uno en un `db.batch()` (`D5`); `listTasks` añade `next_reminder_at` (`D6`).
- [x] 2.3 Tests contra D1: cada regla de alta; cancelar pendiente, cancelado, enviado e inexistente; completar cancela solo los pendientes; deshacer no reactiva; borrar la tarea borra sus avisos; `next_reminder_at` con varios, ninguno y solo enviados.

## 3. Rutas

- [x] 3.1 `validated` y `onlyMethods` a `worker/middleware/validation.ts` (`D13`) sin tocar los tests de tareas.
- [x] 3.2 `worker/routes/reminders.ts` (`GET`/`POST /api/tasks/:id/reminders`, `DELETE /api/reminders/:id`) montado en `worker/app.ts`, con `405` y `Allow`.
- [x] 3.3 Tests de rutas: `201`, cada `400`, `404`, `409`, `204`, `401` sin sesión y `405`.

## 4. Telegram y cron

- [x] 4.1 `worker/integrations/telegram.ts`: `sendTelegramMessage` en texto plano, fallo en no 2xx, en `ok: false` y en error de red, y error saneado sin el token y recortado a 500 (`D8`). `buildReminderMessage` puro.
- [x] 4.2 `worker/jobs/reminders.ts`: `runReminders(env, now)` con una lectura, `Promise.allSettled` y un `db.batch()` (`D7`); sin secretos, no toca nada.
- [x] 4.3 `worker/index.ts` exporta `scheduled` con `ctx.waitUntil`; `wrangler.jsonc` declara `"triggers": { "crons": ["*/5 * * * *"] }`; tipos de los secretos: `wrangler types` ya los genera desde `.dev.vars.example`, y el job y la ruta los declaran opcionales en su propio tipo estructural (pueden faltar en producción). Verificado en local con `wrangler dev --test-scheduled` y `/cdn-cgi/handler/scheduled`.
- [x] 4.4 `worker/routes/telegram.ts`: `POST /api/telegram/test` con `204`, `503` y `502` (`D12`).
- [x] 4.5 Tests con `fetch` simulado: éxito, fallo con reintento, tercer fallo a `failed`, lote de 20 sobre 25, futuros y no pendientes ignorados, secretos ausentes, `last_error` sin el token, texto del mensaje con y sin fecha y prioridad, y las tres respuestas del aviso de prueba.

## 5. Front

- [x] 5.1 `src/features/reminders/`: `api.ts` con tipos derivados del cliente RPC, `use-reminders.ts` (consulta por tarea, crear y cancelar invalidando avisos y listas, toasts) y `shortcuts.ts` con `reminderShortcuts` (`D10`) y sus tests.
- [x] 5.2 `reminders-section.tsx` dentro del detalle, fuera del formulario (`D11`): atajos de 44 px que se parten en líneas, selector `datetime-local` con `min`, error junto al campo, lista con confirmación de cancelado, línea de ayuda y los tres estados. Sin sección de crear en tareas completadas. Tests.
- [x] 5.3 Campana en `task-row.tsx` con la hora y el color `accent` si es hoy; `useSetTaskStatus` limpia `next_reminder_at` al completar. Tests.
- [x] 5.4 Sección "Avisos" en `more-page.tsx` con "Enviar aviso de prueba" y el resultado por `toast`. Tests.

## 6. End-to-end

- [x] 6.1 `e2e/fixtures.ts`: avisos en memoria por tarea, `next_reminder_at` en la lista, `DELETE /api/reminders/:id` y `POST /api/telegram/test`.
- [x] 6.2 `e2e/reminders.spec.ts` en los dos viewports: añadir con un atajo, ver la campana en la fila, cancelar con confirmación, enviar el aviso de prueba; sin scroll horizontal y con objetivos de 44 px en el detalle. Más un caso de detalle largo que destapó un bug previo: el diálogo de escritorio recortaba el contenido en vez de hacer scroll (corregido en `responsive-dialog.tsx`), y la confirmación de cancelar se va a la vista si queda por debajo.

## 7. Documentación y definición de hecho

- [x] 7.1 `docs/ARCHITECTURE.md` §2.1 (piezas nuevas), §2.3 (`triggers`), §3.3 (lo implementado) y §4 (segundo índice, regla de completar y borrar); `docs/PROGRESS.md`.
- [x] 7.2 Definición de hecho de `AGENTS.md §9`: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, `pnpm db:migrate:local` y `openspec validate add-reminders --strict` en verde. Presupuesto de la carga inicial ≤ 200 kB.
- [x] 7.3 Auditoría de secretos: ningún token ni `chat_id` real versionado; los de los tests y fixtures son ficticios.
- [x] 7.4 Pasos manuales para la persona dueña en `docs/PROGRESS.md`, en el orden de `design.md` (*Migration Plan*).
