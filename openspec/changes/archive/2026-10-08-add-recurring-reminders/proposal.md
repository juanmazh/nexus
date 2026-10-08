# Proposal

## Why

Un aviso puntual sirve para "llama al taller a las 18:00". No sirve para lo que se olvida aunque se
sepa: "no te olvides de renovar el DNI" mientras la tarea siga ahí. La persona dueña lo pidió al
probar el MVP: avisos que se repitan cada cierto tiempo, configurables, hasta hacer la tarea.

Es un ajuste de la fase 1 surgido del uso. `add-reminders` lo dejó fuera de alcance de forma
explícita ("recordatorios recurrentes").

## What Changes

- **Recordatorios periódicos de una tarea:** "cada N horas" o "cada N días", desde una primera hora
  que se elige. Una tarea puede tener varios, y conviven con los puntuales.
- **Se repiten hasta que la tarea se completa o hasta cancelarlos.** Completar cancela todos los
  pendientes, también los periódicos, como ya hacía con los puntuales.
- **Franja de silencio configurable** en **Más**, por defecto de 23:00 a 8:00 y desactivable. Una
  repetición que caería dentro se aplaza al final de la franja.
- **En el detalle**, una forma de añadir la repetición ("Repetir cada [N] [horas|días] desde
  [fecha y hora]"), y la lista de avisos indica cuáles se repiten y cada cuánto.
- **Mensaje propio:** "🔁 No te olvides: …" con "Se repite cada 2 h".

### Fuera de alcance

- Repeticiones por días de la semana ("lunes y jueves").
- Recordatorios periódicos sin tarea.
- Editar una repetición: se cancela y se crea otra, igual que los avisos puntuales.
- Aplicar la franja de silencio a los avisos puntuales: su hora la elige la persona a propósito.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `reminders`:
  - cambia *Envío periódico por Telegram*: un aviso periódico se reprograma en vez de quedar `sent`;
  - se añaden requisitos para crear repeticiones, calcular la siguiente, la franja de silencio y su
    configuración, el mensaje y la interfaz.

## Impact

| Área | Impacto |
|---|---|
| Esquema | `reminders` gana `repeat_every` y `repeat_unit` (nulos en los puntuales). Tabla nueva `settings` de una fila con la franja de silencio. Migración no destructiva. |
| Worker | `shared/recurrence.ts` (siguiente repetición, pura), `services/reminders.ts` (crear con repetición), `jobs/reminders.ts` (reprogramar), `routes/settings.ts` (`GET`/`PUT /api/settings/quiet-hours`). |
| Front | Formulario de repetición en `reminders-section.tsx`, etiqueta "cada N" en la lista, sección "Silencio nocturno" en **Más**. |
| Dependencias, secretos | Ninguno. |
| Plan gratuito | El job lee además la fila de `settings` en la misma consulta. Sigue en ≤ 22 subpeticiones. Un aviso horario son 24 envíos al día como mucho. |
