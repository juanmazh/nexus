# Spec Delta

## MODIFIED Requirements

### Requirement: Envío periódico por Telegram

Un Cron Trigger SHALL ejecutar cada 5 minutos un job que tome, como máximo 20 cada vez, los
recordatorios pendientes cuyo instante ha llegado, empezando por el más antiguo, y los envíe por
Telegram. Un envío correcto de un recordatorio **puntual** SHALL marcar `sent` con su instante; uno
**periódico** SHALL reprogramarse a su siguiente repetición. Un fallo SHALL sumar un intento y guardar
el error; al tercer fallo, un puntual SHALL marcar `failed` y un periódico SHALL pasar a su siguiente
repetición.

#### Scenario: Envío correcto

- **WHEN** el job encuentra un recordatorio puntual vencido y Telegram lo acepta
- **THEN** el recordatorio queda `sent` con el instante del envío

#### Scenario: Fallo con reintento

- **WHEN** Telegram rechaza el envío por primera vez
- **THEN** el recordatorio sigue `pending` con un intento y el error guardado
- **AND** la siguiente ejecución lo vuelve a intentar

#### Scenario: Tercer fallo

- **WHEN** Telegram rechaza por tercera vez el envío de un recordatorio puntual
- **THEN** el recordatorio queda `failed` y no se vuelve a intentar

#### Scenario: Lote limitado

- **WHEN** hay 25 recordatorios vencidos
- **THEN** una ejecución envía los 20 más antiguos y deja 5 para la siguiente

#### Scenario: Recordatorio futuro o no pendiente

- **WHEN** un recordatorio no ha llegado a su hora, o está `cancelled`, `sent` o `failed`
- **THEN** el job no lo envía

## ADDED Requirements

### Requirement: Crear un recordatorio periódico

`POST /api/tasks/:id/reminders` SHALL aceptar además `repeat: { every, unit }`, con `unit` `hours` o
`days`, `every` entero entre 1 y 720 en horas y entre 1 y 30 en días. `remind_at` es la primera vez.
Las reglas de los puntuales (hora futura, tarea pendiente, máximo 10 pendientes) SHALL aplicarse
igual.

#### Scenario: Cada día desde mañana a las 9:00

- **WHEN** se crea un recordatorio con `remind_at` mañana a las 9:00 y `repeat` cada 1 día
- **THEN** la API responde `201` con el recordatorio, su primera vez y su repetición

#### Scenario: Intervalo fuera de rango

- **WHEN** `repeat.every` es 0, no es entero, pasa de 720 horas o de 30 días, o `unit` no es `hours` ni `days`
- **THEN** la API responde `400` con el código `validation_error`

### Requirement: Siguiente repetición

Tras cada envío de un recordatorio periódico, su siguiente instante SHALL ser el anterior más el
intervalo: en horas reales si la unidad es `hours`, y en días del reloj de Europe/Madrid si es `days`.
SHALL avanzarse hasta quedar en el futuro, sin enviar las repeticiones que se perdieran.

#### Scenario: Cada día conserva la hora en el cambio de hora

- **WHEN** un recordatorio diario a las 9:00 se envía el sábado 24 de octubre de 2026
- **THEN** su siguiente repetición es el domingo 25 de octubre a las 9:00 en Madrid

#### Scenario: Cada 2 horas son horas reales

- **WHEN** un recordatorio cada 2 horas se envía a las 18:00
- **THEN** su siguiente repetición es a las 20:00

#### Scenario: Sin ráfagas tras una parada

- **WHEN** un recordatorio horario lleva 5 horas vencido
- **THEN** se envía una vez y su siguiente repetición es la primera de su serie que aún no ha pasado

#### Scenario: Completar la tarea lo para

- **WHEN** se completa la tarea de un recordatorio periódico
- **THEN** el recordatorio pasa a `cancelled` y no vuelve a enviarse

### Requirement: Franja de silencio

Las repeticiones de un recordatorio periódico que caigan dentro de la franja de silencio SHALL
aplazarse al final de la franja. La franja SHALL ser de 23:00 a 8:00 en Europe/Madrid si no se ha
configurado, SHALL poder cruzar la medianoche y SHALL poder desactivarse. La primera vez de un
periódico y los recordatorios puntuales NO SHALL verse afectados.

#### Scenario: Repetición nocturna aplazada

- **WHEN** un recordatorio cada 2 horas se envía a las 22:00 con la franja de 23:00 a 8:00
- **THEN** su siguiente repetición es a las 8:00 del día siguiente

#### Scenario: Franja desactivada

- **WHEN** la franja está desactivada y un recordatorio cada 2 horas se envía a las 22:00
- **THEN** su siguiente repetición es a las 0:00

#### Scenario: Un puntual de madrugada

- **WHEN** se crea un recordatorio puntual para las 2:30
- **THEN** se envía a las 2:30 aunque caiga en la franja

### Requirement: Configurar la franja de silencio

`GET /api/settings/quiet-hours` SHALL responder `{ "start": "HH:mm", "end": "HH:mm" }` o `null` si
está desactivada. `PUT /api/settings/quiet-hours` SHALL guardar `{ start, end }` o desactivarla con
`null`, y responder `200` con el valor guardado. Una franja con `start` igual a `end` o con horas mal
formadas SHALL responder `400`. La sección **Más** SHALL permitir activarla, desactivarla y cambiar
sus horas.

#### Scenario: Valor por defecto

- **WHEN** nunca se ha configurado la franja
- **THEN** `GET` responde `{ "start": "23:00", "end": "08:00" }`

#### Scenario: Desactivar

- **WHEN** se envía `PUT` con `null`
- **THEN** `GET` responde `null` y las repeticiones ya no se aplazan

#### Scenario: Franja inválida

- **WHEN** se envía `{ "start": "08:00", "end": "08:00" }` o `{ "start": "25:00", "end": "08:00" }`
- **THEN** la API responde `400` con el código `validation_error`

### Requirement: Mensaje de un recordatorio periódico

El mensaje de un recordatorio periódico SHALL empezar por "🔁 No te olvides: " seguido del título,
SHALL incluir el vencimiento y la prioridad alta como los puntuales, y SHALL terminar con "Se repite
cada …" ("cada hora", "cada 2 h", "cada día", "cada 3 días").

#### Scenario: Cada 2 horas

- **WHEN** se envía la repetición de "Renovar el DNI", sin fecha, cada 2 horas
- **THEN** el mensaje es "🔁 No te olvides: Renovar el DNI" y "Se repite cada 2 h", en dos líneas

### Requirement: Repeticiones en el detalle de la tarea

El detalle de una tarea pendiente SHALL permitir añadir una repetición con un intervalo (número y
unidad) y una primera vez, con los errores junto al campo. La lista de pendientes SHALL distinguir los
periódicos e indicar cada cuánto se repiten y cuándo es la próxima.

#### Scenario: Añadir una repetición diaria

- **WHEN** se elige cada 1 día desde mañana a las 9:00 y se pulsa "Añadir repetición"
- **THEN** la lista muestra el aviso con "cada día" y su próxima vez

#### Scenario: Intervalo inválido

- **WHEN** se escribe 0 horas y se pulsa "Añadir repetición"
- **THEN** el mensaje de error aparece junto al campo y no se crea nada
