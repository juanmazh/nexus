# Tasks

## 1. Esquema y lógica pura

- [ ] 1.1 `repeat_every` y `repeat_unit` en `reminders`, tabla `settings` de una fila; `pnpm db:generate` (solo `ALTER TABLE … ADD COLUMN` y `CREATE TABLE`) y `db:migrate:local`.
- [ ] 1.2 `shared/recurrence.ts`: `nextOccurrence` (`design.md D2`), `isQuiet`, `describeInterval`. Tests de horas y días, los dos cambios de hora, franja que cruza medianoche, desactivada y saltos de varias repeticiones, en UTC.
- [ ] 1.3 `shared/reminders.ts`: `repeat` opcional en `createReminderSchema` con sus límites; `quietHoursSchema`. Tests.

## 2. Worker

- [ ] 2.1 `services/reminders.ts` crea con repetición; `services/settings.ts` lee y guarda la franja con su valor por defecto.
- [ ] 2.2 `routes/settings.ts` (`GET`/`PUT /api/settings/quiet-hours`) y montaje en `app.ts`.
- [ ] 2.3 `jobs/reminders.ts` reprograma los periódicos con la franja leída en la misma consulta (`D4`) y el mensaje de `D5`.
- [ ] 2.4 Tests: crear con repetición y sus `400`; settings `GET`/`PUT` y sus `400`; job con éxito, tercer fallo, franja, sin ráfaga y tarea completada.

## 3. Front

- [ ] 3.1 Bloque "Repetir" en el detalle y etiqueta "🔁 cada …" en la lista (`D6`). Tests.
- [ ] 3.2 "Silencio nocturno" en **Más**. Tests.

## 4. End-to-end y cierre

- [ ] 4.1 Stub y e2e: añadir una repetición, verla en la lista con su etiqueta, configurar la franja; sin scroll horizontal y con 44 px.
- [ ] 4.2 `docs/ARCHITECTURE.md` §3.3 y §4, `docs/PROGRESS.md`. Definición de hecho de `AGENTS.md §9`.
