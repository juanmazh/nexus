# tasks Specification

## Purpose

La tarea como dato y como comportamiento observable: qué se guarda de ella y en qué zona horaria,
el contrato CRUD de `/api/tasks` con sus filtros y su orden, la semántica de completarla y
borrarla, y la vista de lista con sus secciones, el interruptor de completadas y el detalle en
*bottom sheet* o diálogo. Es la primera funcionalidad que guarda algo, así que fija las reglas que
después reutilizarán los recordatorios y el panel de inicio.

## Requirements

### Requirement: La tarea y sus campos

La tarea SHALL tener un identificador único, un título obligatorio de entre 1 y 200 caracteres, unas
notas opcionales, un estado `todo` o `done`, una prioridad `low`, `medium` o `high`, una fecha de
vencimiento opcional, un instante de completado y las marcas de creación y modificación. El estado
inicial SHALL ser `todo` y la prioridad inicial SHALL ser `medium`. Los instantes SHALL almacenarse y
devolverse en UTC como milisegundos desde la época; la fecha de vencimiento MAY ser nula.

#### Scenario: Tarea recién creada

- **WHEN** se crea una tarea indicando solo el título
- **THEN** su estado es `todo` y su prioridad es `medium`
- **AND** no tiene fecha de vencimiento ni instante de completado
- **AND** sus marcas de creación y de modificación existen

#### Scenario: Título vacío o demasiado largo

- **WHEN** se intenta crear o editar una tarea cuyo título está en blanco o tiene más de 200 caracteres
- **THEN** la API responde `400` y la tarea no se crea ni se modifica

### Requirement: Crear una tarea

`POST /api/tasks` SHALL crear una tarea a partir de un título obligatorio y opcionalmente de notas,
prioridad y fecha de vencimiento, y SHALL responder `201` con la tarea creada. La respuesta SHALL
llevar la tarea ya normalizada, nunca el texto tal como llegó.

#### Scenario: Crear desde la barra de captura

- **WHEN** se envía un título por la barra de captura
- **THEN** la API responde `201` y la tarea aparece en la lista
- **AND** su título no tiene espacios sobrantes al principio ni al final

#### Scenario: Crear con fecha de vencimiento

- **WHEN** se crea una tarea indicando una fecha de vencimiento
- **THEN** la respuesta incluye esa fecha de vencimiento
- **AND** la tarea queda en la sección que le corresponde por esa fecha

### Requirement: Validación de la entrada

Toda entrada de la API de tareas —cuerpo, parámetros de ruta y parámetros de consulta— SHALL
validarse antes de llegar a la lógica de la tarea. Ningún campo desconocido SHALL aceptarse en el
cuerpo de una creación o una edición, y un campo opcional ausente SHALL conservar su valor
anterior en lugar de borrarse.

#### Scenario: Campo desconocido en el cuerpo

- **WHEN** se envía un cuerpo con una propiedad que no corresponde a la tarea
- **THEN** la API responde `400` y no crea ni modifica nada

#### Scenario: Prioridad o estado con un valor no previsto

- **WHEN** se envía una prioridad o un estado que no está entre los previstos
- **THEN** la API responde `400` e indica cuál de los dos valores no es válido

#### Scenario: Nota opcional ausente en una edición

- **WHEN** se edita el título de una tarea que ya tenía notas, sin incluir las notas
- **THEN** las notas se conservan
- **AND** para vaciarlas hay que enviarlas explícitamente

### Requirement: Listar tareas

`GET /api/tasks` SHALL devolver una lista JSON de tareas: por defecto, las pendientes ordenadas por
vencimiento con las que no tienen fecha al final. SHALL admitir los filtros `status` (`todo` o `done`)
y `overdue` (pendientes de un día anterior al de hoy en `Europe/Madrid`).

#### Scenario: Lista por defecto

- **WHEN** se pide la lista sin filtros
- **THEN** devuelve solo las tareas pendientes
- **AND** vienen ordenadas por fecha de vencimiento, primero las más próximas, y las que no tienen
  fecha al final

#### Scenario: Filtro de estado

- **WHEN** se pide la lista con `status=done`
- **THEN** devuelve solo las tareas completadas
- **AND** con `status=todo` devuelve solo las pendientes

#### Scenario: Filtro de vencidas

- **WHEN** se pide la lista con `overdue=true`
- **THEN** devuelve solo las pendientes cuyo día de vencimiento es anterior al de hoy en
  `Europe/Madrid`
- **AND** una tarea pendiente que vence hoy no aparece en ese resultado
- **AND** una tarea completada nunca aparece en ese resultado aunque su fecha haya pasado

#### Scenario: Filtro con valor no previsto

- **WHEN** se pide la lista con un `status` que no es `todo` ni `done`, o con un `overdue` que no es
  `true` ni `false`
- **THEN** la API responde `400`

#### Scenario: No hay tareas

- **WHEN** se pide la lista y no hay ninguna tarea que encaje
- **THEN** la API responde `200` con una lista vacía, no con un error

### Requirement: Editar una tarea

`PATCH /api/tasks/:id` SHALL actualizar solo los campos presentes en el cuerpo y SHALL responder
`200` con la tarea ya actualizada. Editar título, notas, prioridad o fecha de vencimiento SHALL NOT
cambiar el estado ni el instante de completado.

#### Scenario: Editar la fecha de vencimiento

- **WHEN** se cambia la fecha de vencimiento de una tarea pendiente
- **THEN** la respuesta la refleja y la tarea pasa a la sección que le corresponde

#### Scenario: Quitar la fecha de vencimiento

- **WHEN** se edita una tarea indicando explícitamente que no tiene fecha de vencimiento
- **THEN** la tarea pasa a la sección de tareas sin fecha

#### Scenario: Editar una tarea que no existe

- **WHEN** se edita un identificador que no corresponde a ninguna tarea
- **THEN** la API responde `404` y no crea ninguna tarea nueva

### Requirement: Completar y deshacer una tarea

Cambiar el estado de una tarea a `done` SHALL registrar el instante de completado y cambiarla a
`todo` SHALL limpiarlo. Las dos operaciones SHALL ser reversibles una sobre la otra y SHALL NOT
alterar el resto de campos de la tarea.

#### Scenario: Completar una tarea

- **WHEN** se cambia el estado de una tarea pendiente a completada
- **THEN** la respuesta incluye el instante de completado
- **AND** la tarea desaparece de la lista de pendientes

#### Scenario: Completar una tarea ya completada

- **WHEN** se vuelve a completar una tarea que ya estaba completada
- **THEN** el instante de completado no cambia

#### Scenario: Deshacer una tarea completada

- **WHEN** se cambia el estado de una tarea completada a pendiente
- **THEN** el instante de completado queda vacío
- **AND** la tarea vuelve a la lista de pendientes

### Requirement: Borrar una tarea

`DELETE /api/tasks/:id` SHALL eliminar la tarea de forma permanente y SHALL responder `204` sin
cuerpo. No SHALL quedar ningún rastro de ella en la lista ni en las consultas posteriores. El
borrado SHALL ser definitivo: no existe una forma de recuperar una tarea borrada.

#### Scenario: Borrar una tarea existente

- **WHEN** se borra una tarea que existe
- **THEN** la API responde `204` sin cuerpo
- **AND** ya no aparece en la lista ni al consultarla

#### Scenario: Borrar una tarea que no existe

- **WHEN** se borra un identificador que no corresponde a ninguna tarea
- **THEN** la API responde `404`

### Requirement: Forma de los errores de la API de tareas

Toda respuesta de error de la API de tareas SHALL tener su estado HTTP correcto y un cuerpo JSON con
la forma `{ "error": { "code": string, "message": string } }`. El mensaje SHALL estar redactado para
quien usa la aplicación y SHALL NOT incluir trazas de pila. `/api/tasks` SHALL exigir una sesión de
Access válida, como el resto de la API salvo la comprobación de salud.

#### Scenario: Sin sesión válida

- **WHEN** se llama a cualquier ruta de `/api/tasks` sin una sesión válida
- **THEN** la respuesta es `401` con la forma de error
- **AND** no se crea, modifica ni devuelve ninguna tarea

#### Scenario: Método no permitido

- **WHEN** se usa un método que la ruta de tareas no admite, por ejemplo `PUT` en `/api/tasks`
- **THEN** la respuesta es `405` e indica los métodos admitidos

#### Scenario: Error inesperado

- **WHEN** la API de tareas falla por una causa no prevista
- **THEN** la respuesta es `500` con la forma de error
- **AND** el cuerpo no contiene trazas de pila ni nombres de ficheros internos

### Requirement: Fechas de vencimiento en UTC y mostradas en Europe/Madrid

Las fechas de vencimiento y los instantes SHALL almacenarse y devolverse en UTC como milisegundos
desde la época, y SHALL presentarse a la persona en `Europe/Madrid`. Una tarea SHALL considerarse
vencida cuando su día en `Europe/Madrid` sea anterior al día actual, y SHALL seguir en el día de hoy
durante toda la jornada aunque su hora haya pasado. La pertenencia a un día SHALL calcularse al
mostrar la lista, sin depender del momento en que se guardó la tarea.

#### Scenario: Una tarea de hoy sigue siendo de hoy al caer la tarde

- **WHEN** una tarea vence hoy a las 09:00 y se consulta la lista a las 18:00 de `Europe/Madrid`
- **THEN** la tarea aparece en el día de hoy y no como vencida

#### Scenario: Cambio de horario de verano

- **WHEN** se consulta la lista en el día en que cambia la hora de verano en `Europe/Madrid`
- **THEN** cada tarea sigue en el día que le corresponde según el reloj de `Europe/Madrid`

#### Scenario: Tarea creada con una fecha ya pasada

- **WHEN** se crea o se edita una tarea con una fecha de vencimiento anterior al momento actual
- **THEN** la API la acepta
- **AND** la lista la muestra como vencida

#### Scenario: Solo fecha, sin hora

- **WHEN** se elige únicamente una fecha en el detalle de una tarea
- **THEN** la tarea vence al comienzo de ese día en `Europe/Madrid`
- **AND** aparece en ese día durante toda la jornada

### Requirement: Secciones de la lista de tareas

La lista de tareas SHALL agruparse en secciones en este orden: **Vencidas**, **Hoy**, **Próximas** y
**Sin fecha**. Cada sección SHALL mostrar solo tareas pendientes y SHALL omitirse cuando no tenga
ninguna. Las secciones SHALL tener un encabezado visible. Las completadas SHALL NOT aparecer en
ninguna de ellas.

#### Scenario: Lista con tareas en varias secciones

- **WHEN** hay tareas vencidas, de hoy, futuras y sin fecha
- **THEN** aparecen las cuatro secciones en ese orden
- **AND** cada tarea aparece exactamente en una

#### Scenario: Sección sin tareas

- **WHEN** no hay ninguna tarea pendiente con fecha de vencimiento pasada
- **THEN** la sección Vencidas no aparece

#### Scenario: Las completadas no están en ninguna sección

- **WHEN** hay una tarea completada con fecha de vencimiento pasada
- **THEN** no aparece en la sección Vencidas ni en ninguna otra

### Requirement: Vista de lista de tareas en el móvil

La sección **Tareas** SHALL mostrar la lista en filas apiladas con el título de la tarea, su prioridad
cuando no sea media y su fecha de vencimiento en formato corto de `Europe/Madrid`, en ese orden de
jerarquía. Cada fila SHALL tener una acción de completar con un área táctil de al menos 44 × 44 px
separada de la acción de abrir el detalle. A 360 px de ancho la vista SHALL funcionar sin scroll
horizontal de página, con el contenido en una sola columna y la lista sin scroll lateral.

#### Scenario: Fila de tarea a 360 px

- **WHEN** se abre la sección Tareas a 360 px de ancho con tareas que tienen fecha y prioridad
- **THEN** cada fila muestra título, prioridad y fecha sin salir del ancho de la pantalla
- **AND** la acción de completar es alcanzable con el pulgar y mide al menos 44 × 44 px
- **AND** no hay scroll horizontal de página

#### Scenario: Abrir el detalle tocando la fila

- **WHEN** se toca una fila en cualquier parte que no sea la acción de completar
- **THEN** se abre el detalle de esa tarea
- **AND** la acción de completar no se dispara al abrir el detalle

#### Scenario: Ampliación a escritorio

- **WHEN** la ventana mide 1280 px de ancho
- **THEN** la lista se mantiene en una columna de ancho legible y centrada

### Requirement: Completadas ocultas hasta pedir verlas

La lista SHALL mostrar por defecto solo las tareas pendientes. Cuando exista al menos una tarea
completada, SHALL mostrar un interruptor **Hechas (N)** con su número, y las completadas SHALL
permanecer ocultas hasta que se active. Con el interruptor activado SHALL aparecer al final de la
lista, con el título atenuado y la fecha de completado, y SHALL poder deshacerse o borrarse. Sin
tareas completadas el interruptor SHALL NOT aparecer.

#### Scenario: Interruptor con el número de completadas

- **WHEN** hay 3 tareas completadas y la lista está en su estado por defecto
- **THEN** el interruptor dice "Hechas (3)" y no se ve ninguna tarea completada

#### Scenario: Ver las completadas

- **WHEN** se activa el interruptor "Hechas (3)"
- **THEN** las tres tareas completadas aparecen al final de la lista
- **AND** cada una muestra la fecha en que se completó

#### Scenario: Completar una tarea con las completadas a la vista

- **WHEN** se activa el interruptor y se completa una de las tareas completadas que se ven
- **THEN** deja de aparecer en la lista de completadas y el número del interruptor baja en uno

#### Scenario: Sin tareas completadas

- **WHEN** no hay ninguna tarea completada
- **THEN** no aparece el interruptor "Hechas"

### Requirement: El detalle de la tarea en un overlay adaptable

Tocar una fila SHALL abrir el detalle de esa tarea en un *bottom sheet* por debajo de 1024 px y en un
diálogo a partir de 1024 px, con el mismo contenido y las mismas acciones en ambas formas. El
detalle SHALL mostrar el estado actual de la tarea y SHALL ofrecer una acción para completarla o
deshacerla. El overlay SHALL poder cerrarse con un botón visible, con el gesto de arrastrar en móvil
y con la tecla `Escape`.

#### Scenario: Detalle en móvil (360 px)

- **WHEN** se toca una fila a 360 px de ancho
- **THEN** el detalle se abre como hoja inferior sobre el contenido
- **AND** sus acciones quedan dentro del área visible sin quedar bajo el borde inferior
- **AND** hay un botón visible para cerrarlo

#### Scenario: Detalle en escritorio

- **WHEN** se toca una fila a 1280 px de ancho
- **THEN** el detalle se abre como diálogo centrado con el mismo contenido

#### Scenario: Cerrar el detalle

- **WHEN** el detalle está abierto
- **THEN** se cierra con el botón de cerrar, con `Escape` y, en móvil, arrastrando la hoja hacia
  abajo
- **AND** la lista conserva la posición de scroll en la que estaba

### Requirement: Editar la tarea desde el detalle

El detalle SHALL permitir editar el título, las notas, la prioridad y la fecha de vencimiento, con
un campo de texto para el título de al menos 16 px de letra, un área de texto para las notas y un
campo de fecha nativo. Los cambios SHALL guardarse con una acción explícita y solo SHALL aplicarse
al guardarlos. Los errores de validación SHALL mostrarse junto al campo que los ha producido, nunca
en una alerta. Si la tarea se guardó con éxito, el detalle SHALL cerrarse.

#### Scenario: Guardar los cambios

- **WHEN** se cambia el título y la fecha de vencimiento y se pulsa "Guardar tarea"
- **THEN** la lista muestra el título nuevo
- **AND** la tarea aparece en la sección que le corresponde por su nueva fecha
- **AND** el detalle se cierra

#### Scenario: Título en blanco al guardar

- **WHEN** se borra el título y se pulsa "Guardar tarea"
- **THEN** se muestra un error junto al campo del título
- **AND** el detalle sigue abierto con lo escrito

#### Scenario: Guardar sin cambiar nada

- **WHEN** se abre el detalle y se guarda sin haber modificado ningún campo
- **THEN** no se realiza ninguna escritura

#### Scenario: El teclado virtual no tapa el botón de guardar

- **WHEN** el teclado virtual está abierto en el detalle a 360 px de ancho
- **THEN** la acción de guardar sigue siendo visible

### Requirement: Borrar la tarea desde el detalle

El detalle SHALL ofrecer una acción de borrar que SHALL pedir confirmación explícita antes de
borrar, mostrando el título de la tarea que se va a eliminar. Si la persona cancela, no SHALL
borrarse nada. Si confirma, la tarea SHALL desaparecer de la lista y el detalle SHALL cerrarse.

#### Scenario: Confirmar el borrado

- **WHEN** se pulsa borrar, se confirma y hay una tarea completada a la vista
- **THEN** la tarea desaparece de la lista
- **AND** el número del interruptor "Hechas" baja en uno

#### Scenario: Cancelar el borrado

- **WHEN** se pulsa borrar y se cancela la confirmación
- **THEN** la tarea sigue en la lista
- **AND** el detalle sigue abierto

### Requirement: Estados de la vista de tareas

La vista de tareas SHALL tener los tres estados que `docs/DESIGN.md` exige en cualquier vista con
datos: esqueleto con la forma de las filas mientras carga, estado vacío que explique qué va ahí e
invite a crear la primera tarea, y estado de error que diga qué ha fallado y ofrezca reintentar.
Cuando la petición falle al crear, completar o borrar una tarea, la lista SHALL volver a su estado
anterior y SHALL avisar de que el cambio no se ha guardado.

#### Scenario: Cargando

- **WHEN** se abre la sección Tareas y la lista todavía no ha llegado
- **THEN** se muestran filas de esqueleto con la forma del contenido esperado

#### Scenario: Sin ninguna tarea

- **WHEN** no hay tareas ni completadas
- **THEN** se muestra un estado vacío que explica que aquí se recogerán las tareas e invita a
  añadir la primera desde la barra de captura

#### Scenario: Error al cargar

- **WHEN** la lista no se puede obtener
- **THEN** se muestra un estado de error que dice que no se han podido cargar las tareas
- **AND** hay una forma de reintentar

#### Scenario: Error al completar

- **WHEN** se completa una tarea y la API responde con error
- **THEN** la tarea vuelve a aparecer como pendiente en la lista
- **AND** se avisa de que el cambio no se ha guardado

### Requirement: Crear una tarea desde la barra de captura

La barra de captura del shell SHALL crear una tarea a partir del texto escrito, solo con el título, y
SHALL hacerlo visible en la lista antes de que la API responda. Si la creación falla, la lista SHALL
volver a su estado anterior y la barra SHALL recuperar el texto escrito para no perderlo. La barra
SHALL quedar vacía tras un envío correcto y SHALL NOT crear una tarea cuando el texto esté en blanco.
La tarea creada SHALL aparecer en la sección **Sin fecha**.

#### Scenario: Captura optimista

- **WHEN** se escribe un título en la barra de captura y se envía
- **THEN** la tarea aparece en la lista en la sección Sin fecha antes de que la API responda
- **AND** tras la respuesta la barra queda vacía

#### Scenario: Captura sin texto

- **WHEN** se envía la barra de captura con el campo vacío o solo con espacios
- **THEN** no se crea ninguna tarea
- **AND** no se muestra ningún aviso de error

#### Scenario: La captura falla

- **WHEN** se envía un título y la API responde con error
- **THEN** la tarea desaparece de la lista
- **AND** se avisa de que no se ha podido guardar
- **AND** el texto vuelve a estar en la barra de captura

#### Scenario: La captura no pisa lo que se está escribiendo

- **WHEN** el foco está en el campo de la barra de captura
- **THEN** la tecla `N` no mueve el foco ni vacía el campo
