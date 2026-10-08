# Spec Delta

> El requisito *Barra de captura* de `add-app-shell` decía que la barra "no persiste nada y no llama
> a la API". Con este cambio eso deja de ser cierto, y OpenSpec no permite que un MODIFIED elimine un
> escenario. Por eso el requisito antiguo se retira (REMOVED) y se sustituye por uno nuevo (ADDED)
> que conserva todos sus escenarios salvo el de "no guarda nada".

## REMOVED Requirements

### Requirement: Barra de captura

**Reason**: La barra deja de ser solo interfaz: con `add-tasks` crea tareas de verdad, así que el
escenario "La barra de captura todavía no guarda nada" ya no describe el sistema.

**Migration**: Sustituido por *Barra de captura que crea tareas*, que mantiene la posición, el atajo
`N` y las reglas táctiles del requisito anterior.

## ADDED Requirements

### Requirement: Barra de captura que crea tareas

La aplicación SHALL mantener una barra de captura visible en todo momento: encima de la barra de
pestañas por debajo de 1024 px y en la cabecera a partir de 1024 px, enfocable con la tecla `N`.
Enviar un texto SHALL crear una tarea con ese título, sin fecha y desde cualquier sección, con
actualización optimista y sin perder el texto si la API falla.

#### Scenario: La acción de capturar está al alcance del pulgar (360 px)

- **WHEN** la aplicación se abre a 360 px de ancho
- **THEN** el campo de captura y su botón son visibles sin hacer scroll
- **AND** el campo indica al teclado que la acción es enviar
- **AND** el botón mide al menos 44 × 44 px

#### Scenario: Capturar con el teclado en escritorio

- **WHEN** la aplicación se usa a 1280 px de ancho y se pulsa la tecla `N`
- **THEN** el foco pasa al campo de captura
- **AND** el texto escrito llega a ese campo

#### Scenario: La tecla N no interfiere al escribir

- **WHEN** el foco está en un campo de texto, un área de texto o un elemento editable, hay un
  overlay abierto, o la tecla `N` se pulsa junto con Ctrl, Cmd o Alt
- **THEN** el foco no se mueve a la barra de captura
- **AND** la pulsación conserva su comportamiento normal (por ejemplo, escribir una "n" o abrir una
  ventana nueva con Ctrl+N)

#### Scenario: Capturar una tarea desde cualquier sección

- **WHEN** se escribe un texto en la barra de captura y se envía
- **THEN** se crea una tarea con ese título y sin fecha de vencimiento
- **AND** la tarea aparece en la lista antes de que la API responda
- **AND** tras la respuesta la barra queda vacía

#### Scenario: La captura falla y no pierde el texto

- **WHEN** se envía un título desde la barra de captura y la API responde con error
- **THEN** la tarea desaparece de la lista y se avisa de que no se ha podido guardar
- **AND** el texto vuelve a estar en la barra de captura

#### Scenario: Enviar la barra vacía no hace nada

- **WHEN** se envía la barra de captura sin texto o solo con espacios
- **THEN** no se crea ninguna tarea y no se muestra ningún error
