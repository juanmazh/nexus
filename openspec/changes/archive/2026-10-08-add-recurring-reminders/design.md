# Design

## Context

- `reminders` guarda avisos puntuales: el job los envía y los marca `sent`, o `failed` tras 3 fallos.
  `next_reminder_at` (la campana) es el mínimo de los pendientes; completar una tarea cancela sus
  pendientes; la interfaz lista los pendientes con cancelación confirmada.
- La persona dueña fijó antes de esta propuesta:
  - por tarea y hasta completarla;
  - "cada N horas o días", con un mínimo de 1 hora;
  - varios por tarea;
  - franja de silencio configurable.

## Decisions

### D1 · Un recordatorio periódico es un recordatorio que se reprograma

`reminders` gana dos columnas nulas: `repeat_every` (entero) y `repeat_unit` (`hours` | `days`). Un
aviso con ellas es periódico. Al enviarse **no** pasa a `sent`: su `remind_at` avanza a la siguiente
repetición, `sent_at` guarda el último envío y `attempts` vuelve a 0. Todo lo demás se reutiliza tal
cual: la campana, la lista del detalle, cancelar y que completar la tarea los cancele. Se pierde el
historial de cada envío individual, que la interfaz no muestra.

Validación:
- `repeat_every` entre 1 y 720 si es en horas, y entre 1 y 30 si es en días (mínimo de 1 hora y
  máximo de 30 días);
- las dos columnas van juntas, o ninguna.

### D2 · La siguiente repetición, en una función pura

`nextOccurrence({ from, every, unit, now, tz, quiet })` en `shared/recurrence.ts`:

1. **Horas:** `from + every × 1 h` en instantes. "Cada 2 h" son 2 horas reales, haya cambio de hora o
   no.
2. **Días:** se suman días **al reloj de Madrid**. "Cada día a las 9:00" sigue a las 9:00 en marzo y
   en octubre, aunque ese día dure 23 o 25 horas. La conversión usa `localDateTimeToEpochMs`, que ya
   resuelve la hora inexistente y la repetida. Si la hora no existiera ese día (solo pasaría con una
   repetición entre 2:00 y 2:59 en marzo), se usa la siguiente hora válida.
3. **Sin ráfagas:** se avanza hasta superar `now`. Si el job estuvo parado, se envía una vez y se
   salta a la siguiente repetición futura.
4. **Franja de silencio:** si el resultado cae dentro, se mueve al final de la franja. Las
   siguientes repeticiones se cuentan desde ahí: con "cada 2 h" y silencio de 23:00 a 8:00, las
   horas son 8, 10, …, 22 y otra vez 8.

### D3 · La franja de silencio

Tabla `settings` con una sola fila (`id = 1`) y dos columnas texto, `quiet_start` y `quiet_end`
(`HH:mm`), nulas cuando el silencio está desactivado. Si no hay fila, se aplica el valor por defecto
de 23:00 a 8:00.

- **Franjas que cruzan la medianoche:** si `start > end` (23:00 → 8:00), el silencio va de `start`
  hasta medianoche y de medianoche a `end`.
- **API:**
  - `GET /api/settings/quiet-hours` responde `{ start, end }` o `null`;
  - `PUT` con `{ start, end }` la guarda, y con `null` la desactiva;
  - `start == end` es un `400`.
- **Solo afecta a las repeticiones.** Un aviso puntual o la **primera** vez de un periódico suenan a
  la hora elegida: la persona la ha escrito a propósito.

### D4 · El job

La consulta ya trae el aviso unido a su tarea; ahora trae también `repeat_every` y `repeat_unit`. La
franja se lee en la **misma** consulta (un `LEFT JOIN` a `settings`), para no gastar otra
subpetición. Por cada resultado:

- puntual: igual que ahora;
- periódico con éxito: `remind_at = next`, `sent_at = now`, `attempts = 0`, `last_error = NULL`;
- periódico que falla:
  - `attempts + 1` y `last_error`;
  - al tercer fallo, esa repetición se da por perdida: `remind_at = next` y `attempts = 0`, con el
    error guardado.

  Una caída de Telegram no mata una repetición para siempre.

### D5 · Mensaje

```
🔁 No te olvides: Renovar el DNI
Vence: vie 9 oct
Se repite cada 2 h
```

"cada 2 h", "cada hora", "cada día", "cada 3 días". Vencimiento y prioridad como en los puntuales.

### D6 · Interfaz

En la sección "Recordatorios" del detalle, debajo de "Otra hora", un bloque **"Repetir"**:

- "Cada" con un número (1–720) y un `select` horas/días;
- "Desde", un `datetime-local` con el mismo `min`;
- el botón "Añadir repetición";
- errores junto al campo, como el resto de formularios.

La lista de pendientes muestra en los periódicos "🔁 cada 2 h · próximo vie 9 oct, 9:00". Cancelar
pide la misma confirmación.

En **Más**, una sección **"Silencio nocturno"**:
- un interruptor (`<input type="checkbox" role="switch">`);
- dos `<input type="time">` (Desde, Hasta);
- "Guardar", con el resultado anunciado en un `toast`.

## Coste en el plan gratuito

| Operación | Cambio |
|---|---|
| Cron | La misma lectura, con un `LEFT JOIN` a una tabla de una fila. Mismas ≤ 22 subpeticiones. |
| Avisos periódicos | Uno horario son ≤ 24 envíos al día; diez a la vez, 240 `fetch` al día. Despreciable frente al límite. |
| Settings | 1 lectura al abrir Más y 1 escritura al guardar. |

## Riesgos / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Cálculo de fechas con DST y franjas** | Función pura con tests de los dos domingos de cambio, franjas que cruzan medianoche y saltos de varias repeticiones. Se prueban en UTC, como el Worker. |
| **Avisos que no paran** si la tarea no se completa | Es el comportamiento pedido; cancelar o completar los para. El límite de 10 pendientes por tarea sigue aplicando. |

## Migration Plan

1. `pnpm db:generate`: `ALTER TABLE reminders ADD COLUMN` ×2 y `CREATE TABLE settings`.
2. Pasos de la persona dueña:
   1. `pnpm db:migrate:remote` **antes** del deploy;
   2. `pnpm deploy`;
   3. crear una repetición "cada 1 h" desde dentro de pocos minutos y recibir dos avisos;
   4. comprobar la franja en Más;
   5. completar la tarea y ver que paran.
