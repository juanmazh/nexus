# Design

## Context

- `add-tasks` dejó la tabla `tasks`, su servicio (`worker/services/tasks.ts`), sus rutas, los
  esquemas compartidos (`shared/tasks.ts`) y la única regla de fechas del proyecto
  (`shared/dates.ts`, `Europe/Madrid`). `updateTaskStatus` es la única escritura de `completed_at`.
- `worker/jobs/` y `worker/integrations/` existen vacíos (`.gitkeep`). `worker/index.ts` solo exporta
  `fetch`, y `wrangler.jsonc` reserva con un comentario el sitio de `triggers`.
- `.dev.vars.example` ya declara vacíos `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`. El bot existe
  (paso S4 de `docs/PROGRESS.md`).
- `docs/ARCHITECTURE.md §3.3` fija el algoritmo del cron: lote de 20, un único `db.batch()`, 3
  intentos y semántica **al menos una vez**.
- La persona dueña fijó en la conversación previa a la propuesta:
  - atajos fijos más el del día de vencimiento;
  - campana en la fila;
  - cancelar con confirmación y sin editar la hora;
  - deshacer una tarea no reactiva sus avisos;
  - botón de prueba en Más;
  - mensaje con título, vencimiento y prioridad alta;
  - sin recordatorio automático;
  - un solo cambio.

## Goals / Non-Goals

**Goals**
- Que un aviso pedido para una hora llegue a Telegram en los 5 minutos siguientes, y que no se pierda
  si Telegram falla una vez.
- Que el token del bot no pueda acabar en la base de datos, en un log ni en una respuesta de la API.
- Que crear un aviso desde el móvil sea un toque en el caso común.
- No gastar más de lo que el plan gratuito da, con margen de órdenes de magnitud.

**Non-Goals**
- Exactitud al minuto: el cron va cada 5 minutos, y eso se dice en la interfaz.
- Entrega exactamente una vez (ver D9).
- Otros canales, recurrencia, edición de la hora o historial en la vista (ver `proposal.md`).

## Decisions

### D1 · Esquema: una tabla y dos índices

`reminders` con las columnas de `docs/ARCHITECTURE.md §4`. Hay dos índices porque hay dos accesos:

- `(status, remind_at)`: lo usa el cron ("pendientes con `remind_at <= now`, por `remind_at`").
- `(task_id, status, remind_at)`: lo usan el detalle (pendientes de **una** tarea, ordenados) y el
  próximo aviso de la lista (D6).

`task_id` lleva `REFERENCES tasks(id) ON DELETE CASCADE`. **Aun así, borrar una tarea borra sus
recordatorios explícitamente** en el mismo `batch` (D5). La cascada en SQLite depende de que
`PRAGMA foreign_keys` esté activo en la conexión. No hay que hacer depender de un `PRAGMA` una regla
que la spec promete; la cascada queda como segunda red.

`channel` es texto con el único valor `telegram`. Existe para que `add-email-channel` no necesite
migrar la tabla.

### D2 · La hora llega como hora local, y la convierte `shared/dates.ts`

`<input type="datetime-local">` devuelve `YYYY-MM-DDTHH:mm`, una hora **sin zona**. Igual que con
`due_date`, la API recibe ese texto y la conversión a UTC la hace una función pura nueva,
`localDateTimeToEpochMs(value, tz)`, junto a `dueDateToEpochMs`.

Los dos cambios de hora tienen una regla explícita:

- **Hora que no existe** (último domingo de marzo, de 02:00 a 02:59): se detecta convirtiendo y
  volviendo a formatear. Si el resultado no coincide con lo que llegó, la hora no existe y la API
  responde `400` con "Esa hora no existe ese día por el cambio de hora."
- **Hora que se repite** (último domingo de octubre, de 02:00 a 02:59): se toma **la primera vez**,
  en horario de verano. Es lo que entiende cualquiera que pide "a las 2:30", y el test lo fija.

El cliente calcula los atajos en hora local (D10) y envía el mismo formato. Así solo hay un camino
de entrada.

### D3 · Reglas de alta, con los códigos de error del proyecto

`POST /api/tasks/:id/reminders` comprueba, en este orden:

1. el formato y que la hora exista: `400 validation_error`;
2. que esté en el futuro respecto al reloj del Worker: `400 validation_error`, "Esa hora ya ha
   pasado.";
3. que la tarea exista: `404 not_found`;
4. que la tarea esté pendiente: `409 task_completed`, "La tarea ya está hecha: no se le pueden
   poner avisos.";
5. que tenga menos de **10** pendientes: `409 too_many_reminders`.

El límite de 10 no es de negocio. Es un freno contra un bucle o un doble envío del formulario, y no
molesta a nadie que use la app con normalidad.

Las comprobaciones 3, 4 y 5 salen de **una** consulta (la tarea con un `count` correlacionado de sus
pendientes), seguida del `INSERT`.

### D4 · Cancelar es un `DELETE` que no borra

`DELETE /api/reminders/:id` cambia el estado a `cancelled` y responde `204`. Se mantiene la fila
porque es historial (aunque la vista no lo muestre) y porque el job no debe enviar un aviso que se
borra a la vez que se procesa:

- cancelar uno ya cancelado responde `204` (idempotente, como el `PATCH` de tareas);
- cancelar uno `sent` o `failed` responde `409 reminder_not_pending`;
- uno inexistente responde `404`.

Es una sola consulta: `UPDATE … WHERE id = ? AND status IN ('pending','cancelled') RETURNING`. Solo
si no devuelve fila se pregunta si existe, para distinguir `404` de `409`.

### D5 · Completar y borrar una tarea tocan sus recordatorios en la misma escritura

- **Completar** (`updateTaskStatus` a `done`): un `db.batch()` con el `UPDATE` de la tarea más
  `UPDATE reminders SET status = 'cancelled' WHERE task_id = ? AND status = 'pending'`. D1 ejecuta el
  `batch` como una transacción, así que no hay estado intermedio en el que la tarea esté hecha y un
  aviso siga vivo.
- **Deshacer** no reactiva nada, por decisión de la persona dueña. La regla es predecible: si quieres
  otro aviso, lo creas.
- **Borrar**: `batch` con el `DELETE` de los recordatorios y el de la tarea (D1).

`updateTaskStatus` sigue siendo la única escritura de `completed_at`. Solo crece en un statement.

### D6 · El próximo aviso viaja en la lista de tareas, en la misma consulta

La campana de la fila necesita, para cada tarea, la hora de su próximo aviso pendiente. Pedirlo
aparte serían N peticiones o un segundo endpoint para una sola etiqueta. `listTasks` añade una
columna calculada:

```sql
(SELECT min(remind_at) FROM reminders r
 WHERE r.task_id = tasks.id AND r.status = 'pending') AS next_reminder_at
```

La resuelve el índice `(task_id, status, remind_at)` con una búsqueda por tarea. La lista sigue
siendo **una** consulta y **una** subpetición. El tipo del cliente se deriva solo, por `AppType`.

### D7 · El job: una lectura, envíos en paralelo, una escritura

`worker/jobs/reminders.ts`, `runReminders(env, now)`:

1. Si falta `TELEGRAM_BOT_TOKEN` o `TELEGRAM_CHAT_ID`: `console.error` con el nombre de lo que falta
   (nunca su valor) y fin. **No** se toca `attempts`; si no, una configuración incompleta mataría
   todos los avisos en 15 minutos.
2. Una consulta: hasta 20 `pending` con `remind_at <= now`, por `remind_at`, unidos a su tarea
   (título, `due_at`, prioridad).
3. `Promise.allSettled` de los envíos. Esperar a una respuesta de red no consume CPU, y en paralelo
   la invocación dura lo que el envío más lento, no la suma.
4. Un `db.batch()` con un `UPDATE` por recordatorio:
   - éxito → `sent` + `sent_at`;
   - fallo → `attempts + 1` y `last_error`, y `failed` si `attempts + 1 >= 3`.

En total, 1 lectura, como máximo 20 `fetch` y 1 escritura: **22 de 50** subpeticiones.

`scheduled` llama a `ctx.waitUntil(runReminders(env, Date.now()))`. `now` entra como parámetro para
que los tests fijen el reloj.

### D8 · Telegram: texto plano y el token fuera de todo

`worker/integrations/telegram.ts` expone `sendTelegramMessage(config, text)`.

- **Petición:** `POST https://api.telegram.org/bot<token>/sendMessage` con
  `{ chat_id, text, link_preview_options: { is_disabled: true } }`.
- **Sin `parse_mode`.** Con Markdown o HTML, un título con `_`, `*` o `<` hace que Telegram responda
  `400`, y ese aviso no saldría nunca. El texto plano no tiene nada que escapar.
- **Qué es un fallo:** cualquier respuesta no 2xx, o un cuerpo con `ok: false`, o un error de red.
  Un `429` también cuenta como intento. Con 3 intentos separados 5 minutos, un límite de ritmo
  puntual no hace perder el aviso, y distinguirlo no compensa el código.
- **El token nunca sale de la función.** El mensaje de error se construye con el código y la
  `description` de Telegram, se le quita cualquier aparición del token (por si un error de red
  incluye la URL) y se recorta a 500 caracteres. Hay un test que lo comprueba con un `fetch` que
  falla incluyendo la URL completa.

El mensaje del aviso se compone en una función pura: título, vencimiento si lo hay y "Prioridad alta"
solo si lo es:

```
⏰ Pagar el alquiler
Vence: vie 10 oct
Prioridad alta
```

Para "Vence" se usa `formatShortDate`, que pasa de `src/features/tasks/format.ts` a
`shared/format.ts` porque ahora la necesitan el Worker y la SPA. Si vence hoy, dice "Vence: hoy".

### D9 · Al menos una vez, y por qué basta

Si Telegram acepta un mensaje pero el `batch` posterior falla, el aviso sigue `pending` y se reenvía
5 minutos después. Lo mismo si dos ejecuciones se solapan, que con 20 envíos en paralelo no debería
pasar. Para una persona, un aviso duplicado es una molestia; uno perdido es el fallo que este cambio
existe para evitar. Ya está escrito en `docs/ARCHITECTURE.md §3.3`.

### D10 · Atajos calculados en el cliente, en una función pura

`reminderShortcuts(now, dueAt, tz)` en `src/features/reminders/shortcuts.ts` devuelve
`{ label, value }[]`, donde `value` es el texto local que se envía a la API:

| Atajo | Hora | Aparece si |
|---|---|---|
| En 1 h | ahora + 60 min, redondeado **hacia arriba** al múltiplo de 5 | siempre |
| Esta tarde 18:00 | hoy a las 18:00 | faltan más de 5 min para las 18:00 |
| Mañana 9:00 | mañana a las 9:00 | siempre |
| El día que vence 9:00 | el día de `due_at` a las 9:00 | la tarea tiene fecha, esa hora está a más de 5 min y no coincide con otro atajo |

Redondear "En 1 h" hace que la hora que se lee sea limpia (18:35, no 18:33) y nunca menos de una
hora. El margen de 5 minutos evita ofrecer un atajo que la API rechazaría por estar en el pasado
cuando llegue la petición.

### D11 · Interfaz: dentro del detalle, debajo del formulario

La sección "Recordatorios" va dentro del `ResponsiveDialog`, **fuera** del `<form>` de la tarea y
debajo de él. Sus acciones son inmediatas (crear o cancelar un aviso no espera a "Guardar tarea"), y
meterlas en el formulario mezclaría dos ciclos de guardado. Su contenido:

1. Los atajos, como botones de 44 px en una fila que se parte en varias líneas (`flex-wrap`), nunca
   con scroll horizontal.
2. "Otra hora": un `datetime-local` con `min` = ahora, y un botón "Añadir aviso". El error de la API
   aparece junto al campo con `aria-describedby`, como en el resto de formularios.
3. La lista de pendientes, con la fecha y la hora en `tabular-nums` y un botón "Cancelar" de 44 px.
   Al pulsarlo, la fila se sustituye por la confirmación "¿Cancelar el aviso del vie 10 oct a las
   18:00?", con "Cancelar aviso" y "Mantener". Es el mismo patrón que el borrado de la tarea, sin un
   segundo overlay.
4. Una línea de ayuda: "Llegan por Telegram en los 5 minutos siguientes a la hora."
5. Estados: esqueleto al cargar, error con "Reintentar" y "Sin avisos" si no hay ninguno.

**Campana en la fila:** si `next_reminder_at` no es nulo, la línea de metadatos de `TaskRow` añade
un icono de campana (`aria-hidden`) y la hora: "18:00" si es hoy y "vie 10 oct 9:00" si no. El texto
para lectores de pantalla es "Aviso: …". Si es hoy, va en el color `accent` "aceite", el que
`docs/DESIGN.md` reserva para "recordatorio inminente" y "hoy".

Crear o cancelar un aviso invalida la consulta de los avisos de esa tarea y las listas de tareas,
para que la campana se actualice. No hay actualización optimista: el servidor puede rechazar la hora
(D3), y mostrar un aviso que luego desaparece es peor que esperar unos cientos de milisegundos con el
botón en estado de carga. Completar una tarea sí es optimista (ya lo era) y además limpia su
`next_reminder_at` en la caché, porque el servidor cancela sus avisos (D5).

### D12 · Aviso de prueba

`POST /api/telegram/test` envía "✅ Nexus: aviso de prueba. Si lees esto, los recordatorios llegarán
aquí." por el mismo `sendTelegramMessage`. Respuestas:

- `204` si se ha enviado;
- `503 telegram_not_configured` si falta un secreto;
- `502 telegram_failed` con el error ya saneado (D8) si Telegram lo rechaza.

No escribe nada en la base de datos.

En **Más**, una sección "Avisos" con el botón "Enviar aviso de prueba" (44 px). El resultado se
anuncia con el `toast` del proyecto: "Aviso enviado. Revisa Telegram." o el mensaje de error.

### D13 · Utilidades de ruta compartidas

`validated` y `onlyMethods` viven hoy dentro de `worker/routes/tasks.ts`. Con tres ficheros de rutas
que los necesitan, se mueven a `worker/middleware/validation.ts` sin cambiar su comportamiento. Los
tests de `tasks` siguen pasando sin tocarlos, y eso es la prueba de que el movimiento es neutro.

## Coste en el plan gratuito

| Operación | Queries | Subpeticiones | Escrituras |
|---|---|---|---|
| Cron (cada 5 min, 288/día) | 1 lectura + 1 `batch` | ≤ 22 | ≤ 20 filas |
| `GET /api/tasks` | 1 (con subconsulta por índice) | 1 | 0 |
| `GET /api/tasks/:id/reminders` | 1 (2 si está vacía, para el `404`) | ≤ 2 | 0 |
| `POST /api/tasks/:id/reminders` | 2 | 2 | 1 |
| `DELETE /api/reminders/:id` | 1 (2 en el caso de error) | ≤ 2 | ≤ 1 |
| Completar o borrar una tarea | 1 `batch` | 1 | 1 + nº de avisos |
| `POST /api/telegram/test` | 0 | 1 `fetch` | 0 |

288 invocaciones del cron al día son el 0,3 % de las 100.000. Sin avisos vencidos, cada una es una
lectura por índice que no devuelve filas: 288 lecturas al día de 5 millones. CPU: construir 20
mensajes y un `batch` está muy por debajo de los 10 ms. Se usa **1** de los 5 Cron Triggers de la
cuenta.

## Riesgos / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Se filtra el token** en `last_error`, en un log o en una respuesta | D8: el error se construye sin la URL y se sanea igualmente; test específico; nunca se registra el valor de un secreto, solo su nombre. |
| **Configuración incompleta mata los avisos** | D7: sin secretos, el job no toca `attempts`. El botón de prueba (D12) lo hace visible el mismo día del deploy. |
| **Avisos duplicados** | Asumido (D9) y documentado. |
| **Retraso de hasta 5 minutos** | Lo dice la interfaz (D11). Un cron más frecuente cuesta invocaciones sin necesidad. |
| **Cambio de hora** | D2 con tests de los dos domingos de 2026. |
| **La campana engorda la lista** | Una subconsulta por índice por tarea (D6). Con ~300 tareas siguen siendo lecturas despreciables frente al límite diario. |
| **El cambio supera las ~600 líneas** | Decisión de la persona dueña (`proposal.md`). Se commitea por grupos (`tasks.md`). |

## Migration Plan

1. `worker/db/schema.ts` y `pnpm db:generate`. El SQL debe ser `CREATE TABLE reminders` con la FK y
   dos `CREATE INDEX`. `pnpm db:migrate:local` y otro `db:generate` para confirmar que queda limpio.
2. Implementación y verificación completa de `AGENTS.md §9`.
3. **Pasos manuales de la persona dueña**, en este orden:
   1. `pnpm wrangler secret put TELEGRAM_BOT_TOKEN` y `pnpm wrangler secret put TELEGRAM_CHAT_ID`.
   2. `pnpm db:migrate:remote`, **antes** del deploy.
   3. `pnpm deploy`. Comprobar en el panel de Cloudflare que el Worker tiene el Cron Trigger.
   4. En el móvil, sobre el despliegue: "Enviar aviso de prueba" en Más y recibirlo; crear un aviso
      "En 1 h" o a pocos minutos con "Otra hora" y recibirlo; cancelar otro; completar una tarea con
      un aviso y comprobar que la campana desaparece.
   5. `/opsx-archive add-reminders` **en la misma rama, antes del merge**.

**Reversión.** Revertir el PR quita el cron y el código. La tabla puede quedarse: nadie la lee sin el
código. Los secretos se pueden borrar con `wrangler secret delete`.

## Open Questions

Ninguna. Las decisiones de producto están cerradas (ver *Context*).
