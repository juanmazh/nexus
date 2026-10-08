# reminders Specification

## Purpose
El recordatorio como dato y como comportamiento observable: cuándo se puede pedir un aviso para una
tarea y cómo se cancela, qué les pasa a los avisos cuando la tarea se completa o se borra, cómo se ve
el próximo aviso en la lista, y cómo y con qué garantías llega el mensaje a Telegram.

## Requirements

### Requirement: El recordatorio y sus campos

Un recordatorio SHALL pertenecer a una única tarea y tener un instante de aviso, un canal
(`telegram`), un estado (`pending`, `sent`, `failed` o `cancelled`), un número de intentos, el último
error de envío, el instante de envío y la marca de creación. Los instantes SHALL almacenarse y
devolverse en UTC como milisegundos desde la época. Un recordatorio nuevo SHALL estar `pending` con
cero intentos.

#### Scenario: Recordatorio recién creado

- **WHEN** se crea un recordatorio para una tarea pendiente
- **THEN** su estado es `pending`, su canal es `telegram` y sus intentos son cero
- **AND** no tiene instante de envío ni error

### Requirement: Crear un recordatorio

`POST /api/tasks/:id/reminders` SHALL recibir `{ "remind_at": "YYYY-MM-DDTHH:mm" }` como hora local
de Europe/Madrid, crear un recordatorio en el instante UTC equivalente y responder `201` con él.

#### Scenario: Hora futura válida

- **WHEN** se envía una hora que todavía no ha llegado para una tarea pendiente
- **THEN** la API responde `201` con el recordatorio
- **AND** su instante es el de esa hora en Europe/Madrid expresado en UTC

#### Scenario: Hora que ya ha pasado

- **WHEN** se envía una hora igual o anterior al momento actual
- **THEN** la API responde `400` con `{ "error": { "code": "validation_error", "message": "Esa hora ya ha pasado." } }`
- **AND** no se crea nada

#### Scenario: Formato inválido o propiedad desconocida

- **WHEN** `remind_at` falta, no tiene el formato `YYYY-MM-DDTHH:mm` o el cuerpo trae otra propiedad
- **THEN** la API responde `400` con el código `validation_error`

#### Scenario: Tarea inexistente

- **WHEN** el identificador no corresponde a ninguna tarea
- **THEN** la API responde `404` con el código `not_found`

#### Scenario: Tarea completada

- **WHEN** la tarea está en estado `done`
- **THEN** la API responde `409` con el código `task_completed` y no se crea nada

#### Scenario: Demasiados avisos pendientes

- **WHEN** la tarea ya tiene 10 recordatorios pendientes
- **THEN** la API responde `409` con el código `too_many_reminders` y no se crea nada

### Requirement: Horas locales en los cambios de hora

La conversión de la hora local SHALL hacerse en Europe/Madrid. Una hora que no existe por el adelanto
de marzo SHALL rechazarse con `400`. Una hora que se repite por el retraso de octubre SHALL
interpretarse como su primera aparición, en horario de verano.

#### Scenario: Hora que no existe

- **WHEN** se pide un aviso para el 29 de marzo de 2026 a las 02:30
- **THEN** la API responde `400` con el mensaje "Esa hora no existe ese día por el cambio de hora."

#### Scenario: Hora que se repite

- **WHEN** se pide un aviso para el 25 de octubre de 2026 a las 02:30
- **THEN** su instante es 2026-10-25T00:30:00Z, la primera vez que en Madrid son las 02:30

### Requirement: Listar los recordatorios pendientes de una tarea

`GET /api/tasks/:id/reminders` SHALL responder `200` con los recordatorios **pendientes** de la tarea
ordenados por instante ascendente, y `404` si la tarea no existe.

#### Scenario: Solo los pendientes y en orden

- **WHEN** una tarea tiene un aviso pendiente a las 18:00, otro a las 9:00 y uno ya enviado
- **THEN** la respuesta contiene los dos pendientes, primero el de las 9:00

#### Scenario: Tarea sin avisos

- **WHEN** la tarea existe y no tiene pendientes
- **THEN** la API responde `200` con una lista vacía

#### Scenario: Tarea inexistente

- **WHEN** el identificador no corresponde a ninguna tarea
- **THEN** la API responde `404` con el código `not_found`

### Requirement: Cancelar un recordatorio

`DELETE /api/reminders/:id` SHALL pasar a `cancelled` un recordatorio pendiente y responder `204`,
sin borrar la fila. SHALL ser idempotente sobre uno ya cancelado. SHALL responder `409` si ya se
envió o falló, y `404` si no existe.

#### Scenario: Cancelar un pendiente

- **WHEN** se cancela un recordatorio pendiente
- **THEN** la API responde `204` y el recordatorio deja de aparecer entre los pendientes de su tarea
- **AND** el job ya no lo envía

#### Scenario: Cancelar dos veces

- **WHEN** se cancela un recordatorio ya cancelado
- **THEN** la API responde `204` y nada cambia

#### Scenario: Cancelar uno ya enviado

- **WHEN** se cancela un recordatorio `sent` o `failed`
- **THEN** la API responde `409` con el código `reminder_not_pending`

#### Scenario: Recordatorio inexistente

- **WHEN** el identificador no corresponde a ningún recordatorio
- **THEN** la API responde `404` con el código `not_found`

### Requirement: Completar o borrar una tarea afecta a sus recordatorios

Completar una tarea SHALL cancelar sus recordatorios pendientes en la misma escritura. Deshacerla NO
SHALL reactivarlos. Borrar una tarea SHALL borrar todos sus recordatorios.

#### Scenario: Completar cancela los pendientes

- **WHEN** se completa una tarea con dos avisos pendientes y uno enviado
- **THEN** los dos pendientes pasan a `cancelled` y el enviado no cambia

#### Scenario: Deshacer no reactiva

- **WHEN** se vuelve a `todo` una tarea cuyos avisos se cancelaron al completarla
- **THEN** esos avisos siguen `cancelled`

#### Scenario: Borrar la tarea borra sus avisos

- **WHEN** se borra una tarea con recordatorios
- **THEN** ninguno de sus recordatorios existe ya

### Requirement: El próximo aviso en la lista de tareas

Cada tarea de `GET /api/tasks` SHALL incluir `next_reminder_at`: el instante UTC de su recordatorio
pendiente más próximo, o `null` si no tiene ninguno.

#### Scenario: Tarea con varios avisos

- **WHEN** una tarea tiene avisos pendientes a las 9:00 y a las 18:00
- **THEN** su `next_reminder_at` es el de las 9:00

#### Scenario: Tarea sin avisos pendientes

- **WHEN** una tarea no tiene avisos o todos están enviados o cancelados
- **THEN** su `next_reminder_at` es `null`

### Requirement: Envío periódico por Telegram

Un Cron Trigger SHALL ejecutar cada 5 minutos un job que tome, como máximo 20 cada vez, los
recordatorios pendientes cuyo instante ha llegado, empezando por el más antiguo, y los envíe por
Telegram. Un envío correcto SHALL marcar `sent` con su instante. Un fallo SHALL sumar un intento y
guardar el error; al tercer fallo SHALL marcar `failed`.

#### Scenario: Envío correcto

- **WHEN** el job encuentra un recordatorio vencido y Telegram lo acepta
- **THEN** el recordatorio queda `sent` con el instante del envío

#### Scenario: Fallo con reintento

- **WHEN** Telegram rechaza el envío por primera vez
- **THEN** el recordatorio sigue `pending` con un intento y el error guardado
- **AND** la siguiente ejecución lo vuelve a intentar

#### Scenario: Tercer fallo

- **WHEN** Telegram rechaza el envío por tercera vez
- **THEN** el recordatorio queda `failed` y no se vuelve a intentar

#### Scenario: Lote limitado

- **WHEN** hay 25 recordatorios vencidos
- **THEN** una ejecución envía los 20 más antiguos y deja 5 para la siguiente

#### Scenario: Recordatorio futuro o no pendiente

- **WHEN** un recordatorio no ha llegado a su hora, o está `cancelled`, `sent` o `failed`
- **THEN** el job no lo envía

### Requirement: Contenido del mensaje de aviso

El mensaje SHALL ser texto plano con el título de la tarea, su vencimiento en Europe/Madrid si lo
tiene ("Vence: hoy" o la fecha corta) y "Prioridad alta" solo si la prioridad es alta.

#### Scenario: Tarea con fecha y prioridad alta

- **WHEN** se envía el aviso de "Pagar el alquiler", que vence el viernes 9 de octubre con prioridad alta
- **THEN** el mensaje es "⏰ Pagar el alquiler", "Vence: vie 9 oct" y "Prioridad alta", en tres líneas

#### Scenario: Título con símbolos

- **WHEN** el título contiene `_`, `*` o `<`
- **THEN** el mensaje se envía igual, con el título tal cual

### Requirement: El token del bot nunca se expone

El token de Telegram NO SHALL aparecer en el error guardado de un recordatorio, en los registros del
Worker ni en ninguna respuesta de la API. El error guardado SHALL tener como máximo 500 caracteres.

#### Scenario: Error de red que incluye la URL

- **WHEN** el envío falla con un error cuyo texto contiene la URL de la Bot API con el token
- **THEN** el error guardado no contiene el token y tiene como máximo 500 caracteres

### Requirement: Sin configuración no se gastan intentos

Si falta `TELEGRAM_BOT_TOKEN` o `TELEGRAM_CHAT_ID`, el job NO SHALL enviar ni modificar ningún
recordatorio, y SHALL registrar qué secreto falta sin mostrar ningún valor.

#### Scenario: Token ausente

- **WHEN** el job se ejecuta sin `TELEGRAM_BOT_TOKEN` y hay recordatorios vencidos
- **THEN** ninguno cambia de estado ni de intentos

### Requirement: Aviso de prueba

`POST /api/telegram/test` SHALL enviar al momento un mensaje de prueba a Telegram y responder `204`.
SHALL responder `503` con el código `telegram_not_configured` si falta un secreto, y `502` con el
código `telegram_failed` y el error saneado si Telegram lo rechaza. La sección **Más** SHALL tener un
botón "Enviar aviso de prueba" que anuncie el resultado.

#### Scenario: Prueba correcta

- **WHEN** se pulsa "Enviar aviso de prueba" con la configuración completa
- **THEN** llega un mensaje a Telegram y la aplicación muestra "Aviso enviado. Revisa Telegram."

#### Scenario: Configuración incompleta

- **WHEN** se pulsa el botón y falta un secreto
- **THEN** la API responde `503` y la aplicación muestra el mensaje de error

### Requirement: Avisos en el detalle de la tarea

El detalle de una tarea pendiente SHALL tener una sección "Recordatorios" con atajos de al menos
44 px, un selector nativo de fecha y hora para cualquier otra, la lista de pendientes con su hora en
Europe/Madrid y una línea que diga que llegan en los 5 minutos siguientes. Los atajos cuya hora esté
a 5 minutos o menos NO SHALL mostrarse.

#### Scenario: Atajos de la tarde

- **WHEN** se abre el detalle a las 16:00
- **THEN** se ofrecen "En 1 h", "Esta tarde 18:00" y "Mañana 9:00"

#### Scenario: Atajo que ya ha pasado

- **WHEN** se abre el detalle a las 18:30
- **THEN** no se ofrece "Esta tarde 18:00"

#### Scenario: Atajo del día de vencimiento

- **WHEN** la tarea vence pasado mañana
- **THEN** se ofrece además "El día que vence 9:00"

#### Scenario: Añadir con un atajo

- **WHEN** se toca "Mañana 9:00"
- **THEN** el aviso aparece en la lista de pendientes del detalle

#### Scenario: Hora rechazada

- **WHEN** se elige en el selector una hora que la API rechaza
- **THEN** su mensaje aparece junto al selector y no se añade nada

#### Scenario: Tarea completada

- **WHEN** se abre el detalle de una tarea completada
- **THEN** la sección no ofrece crear avisos

### Requirement: Cancelar un aviso desde el detalle con confirmación

Cancelar un aviso desde el detalle SHALL pedir una confirmación que nombre su fecha y hora, sin abrir
un segundo overlay. Hasta que se confirma, el aviso NO SHALL cancelarse.

#### Scenario: Confirmar

- **WHEN** se pulsa "Cancelar" en un aviso y después "Cancelar aviso"
- **THEN** el aviso desaparece de la lista y se anuncia "Recordatorio cancelado"

#### Scenario: Mantener

- **WHEN** se pulsa "Cancelar" en un aviso y después "Mantener"
- **THEN** el aviso sigue en la lista y no se envía ninguna petición

### Requirement: Campana en la fila de la tarea

Una tarea con un aviso pendiente SHALL mostrar en su fila una campana y la hora del próximo aviso:
solo la hora si es hoy y la fecha corta con la hora si no. Si el aviso es hoy SHALL destacarse con el
color reservado para "hoy". Completar la tarea SHALL quitar la campana.

#### Scenario: Aviso de hoy

- **WHEN** una tarea tiene su próximo aviso hoy a las 18:00
- **THEN** su fila muestra la campana y "18:00"

#### Scenario: Aviso de otro día

- **WHEN** el próximo aviso es el viernes 9 de octubre a las 9:00
- **THEN** su fila muestra la campana y "vie 9 oct 9:00"

#### Scenario: Completar quita la campana

- **WHEN** se completa una tarea con un aviso pendiente
- **THEN** su fila deja de mostrar la campana
