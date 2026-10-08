# Proposal

## Why

Nexus ya guarda tareas, pero no avisa de ninguna: para acordarse de llamar al taller a las 18:00 hay
que abrir la app a las 18:00, que es justo lo que una herramienta de tareas debería evitar. El
objetivo de la Fase 1 en `docs/ROADMAP.md` es "usar Nexus a diario para las tareas y recibir avisos
por Telegram", y sin este cambio la mitad de ese objetivo no existe.

Este cambio es la Fase 1, cambio **1.2**. Es el primero que **sale** de la aplicación (manda mensajes a
un servicio externo), el primero con **secretos** propios y el primero con **cron**.

## What Changes

- **Tabla `reminders`** con el modelo de `docs/ARCHITECTURE.md §4`: un recordatorio pertenece a una
  tarea, tiene un instante en UTC, un canal (`telegram`), un estado (`pending`, `sent`, `failed`,
  `cancelled`), un contador de intentos, el último error y el instante de envío.
- **API de recordatorios:**
  - `GET /api/tasks/:id/reminders` devuelve los pendientes de una tarea;
  - `POST /api/tasks/:id/reminders` crea uno a partir de una hora local de Madrid
    (`YYYY-MM-DDTHH:mm`);
  - `DELETE /api/reminders/:id` lo cancela.
- **Reglas sobre las tareas:**
  - completar una tarea cancela sus recordatorios pendientes en la misma escritura;
  - deshacerla **no** los reactiva;
  - borrarla borra sus recordatorios;
  - `GET /api/tasks` informa de la hora del próximo recordatorio pendiente de cada tarea.
- **Job de avisos** disparado por un Cron Trigger cada 5 minutos:
  - lee como máximo 20 recordatorios vencidos y los envía por Telegram;
  - guarda los resultados en una sola escritura por lotes;
  - reintenta hasta 3 veces y después marca `failed`.
- **Aviso de prueba** en la sección **Más**: un botón que manda un mensaje a Telegram al momento,
  para comprobar la configuración sin esperar al cron (`POST /api/telegram/test`).
- **Interfaz:**
  - **En el detalle de la tarea**, una sección "Recordatorios" con:
    - atajos grandes ("En 1 h", "Esta tarde 18:00", "Mañana 9:00" y, si la tarea tiene fecha, "El
      día que vence 9:00");
    - un selector nativo de fecha y hora;
    - la lista de pendientes, que se cancelan **con confirmación**.
  - **En la fila de la lista**, una campana con la hora del próximo aviso.
- **Secretos nuevos:** `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` (`wrangler secret put`). En local,
  en `.dev.vars`, que ya los declara vacíos en `.dev.vars.example`.
- **Configuración nueva:** `"triggers": { "crons": ["*/5 * * * *"] }` en `wrangler.jsonc` y el
  manejador `scheduled` en `worker/index.ts`.

### Fuera de alcance

- **Email y cualquier otro canal.** El canal se guarda para que añadir uno no exija migrar
  (`add-email-channel`, 3.3), pero hoy solo existe `telegram`.
- **Recordatorios recurrentes** ("cada lunes") y **recordatorios sin tarea**.
- **Editar la hora** de un recordatorio. Se cancela y se crea otro.
- **Recordatorio automático** al poner fecha a una tarea. Siempre se crean a mano.
- **Historial** de enviados, fallidos y cancelados en la interfaz. La tabla lo guarda, pero la vista
  solo muestra los pendientes.
- **Reactivar** recordatorios al deshacer una tarea completada.
- **Notificaciones push del navegador** (llegarán, si llegan, con `add-pwa`).

## Capabilities

### New Capabilities

- `reminders`: el recordatorio como dato y como comportamiento observable. Cubre:
  - su API y sus reglas de alta y cancelación;
  - el efecto de completar y borrar una tarea sobre sus recordatorios;
  - el próximo aviso en la lista;
  - el envío periódico por Telegram con reintentos;
  - el aviso de prueba;
  - la interfaz en el detalle y en la fila.

### Modified Capabilities

Ninguna. Las reglas que tocan a las tareas (cancelar al completar, borrar al borrar, el campo
`next_reminder_at` en la lista) viven en `reminders`, que es la capacidad que las introduce. Así
`tasks` sigue describiendo la tarea sin saber que existen avisos, y cada regla está en un solo sitio.

## Impact

| Área | Impacto |
|---|---|
| Esquema | Tabla `reminders` con dos índices: `(status, remind_at)` para el cron y `(task_id, status, remind_at)` para el detalle y el próximo aviso. Clave foránea a `tasks` con `ON DELETE CASCADE`. Migración no destructiva (`CREATE TABLE` y `CREATE INDEX`). |
| Worker | `worker/services/reminders.ts`, `worker/routes/reminders.ts`, `worker/routes/telegram.ts`, `worker/jobs/reminders.ts`, `worker/integrations/telegram.ts`, `scheduled` en `worker/index.ts`. `services/tasks.ts` cambia en completar, borrar y listar. `validated` y `onlyMethods` se sacan de `routes/tasks.ts` a un módulo común. |
| Compartido | `shared/reminders.ts` (esquemas) y `localDateTimeToEpochMs` en `shared/dates.ts`. |
| Front | Sección de recordatorios en `task-detail-sheet.tsx`, campana en `task-row.tsx`, botón de prueba en `more-page.tsx`, hooks y llamadas en `src/features/reminders/`. |
| Configuración | Un Cron Trigger (1 de los 5 de la cuenta) y dos secretos. Ninguna variable ni binding nuevo. |
| Dependencias | Ninguna. `fetch` basta para la Bot API de Telegram. |
| Tests | Servicio y rutas contra D1, job con Telegram simulado, fechas en los dos cambios de hora, componentes y e2e en los dos viewports. |
| Plan gratuito | 288 invocaciones de cron al día (0,3 % de las 100.000). Cada una hace como máximo 1 lectura, 20 `fetch` y 1 escritura por lotes: 22 de 50 subpeticiones. La lista de tareas sigue siendo **una** consulta. Detalle en `design.md`. |
| Docs | `docs/ARCHITECTURE.md` §2.1, §3.3 y §4; `docs/PROGRESS.md`. |
| Tamaño | Unas 750 líneas de código de producto, por encima de las ~600 orientativas. La persona dueña decidió **no** dividirlo: detrás de Access no hay forma de crear un recordatorio sin la interfaz, así que la mitad del backend sola no entregaría nada usable. Se commitea por grupos para revisarlo en tramos. |
