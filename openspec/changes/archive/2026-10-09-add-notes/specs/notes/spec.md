## ADDED Requirements

### Requirement: Crear una nota

La API SHALL crear una nota con `POST /api/notes` a partir de su contenido y responder `201` con la
nota. El contenido SHALL tener algo que no sean espacios y como mucho 50 000 caracteres; si no,
SHALL responder `400` con el código `validation_error`. El título SHALL derivarse de la primera línea
no vacía del contenido, sin los marcadores de Markdown del principio y recortado a 120 caracteres.

#### Scenario: Título desde la primera línea

- **WHEN** se crea una nota con el contenido "# Lista de la compra\n- pan\n- leche"
- **THEN** la nota se crea con el título "Lista de la compra"

#### Scenario: Contenido vacío

- **WHEN** se crea una nota cuyo contenido son solo espacios y saltos de línea
- **THEN** la API responde `400` con el código `validation_error`

### Requirement: Listar las notas

`GET /api/notes` SHALL responder las notas con su título, un extracto, si está fijada y su última
modificación, sin el contenido completo: primero las fijadas y después las demás, cada grupo de la
modificada más recientemente a la más antigua. La sección **Notas** SHALL mostrar esa lista con las
fijadas bajo "Fijadas", y un estado vacío cuando no haya ninguna.

#### Scenario: Orden de la lista

- **WHEN** hay una nota fijada modificada ayer y una sin fijar modificada hoy
- **THEN** la fijada aparece primero

#### Scenario: Sin notas

- **WHEN** no hay ninguna nota
- **THEN** la sección muestra el estado vacío con una indicación de cómo crear la primera

### Requirement: Buscar notas

`GET /api/notes?q=` SHALL devolver solo las notas cuyo título o contenido contengan el término, sin
distinguir mayúsculas ni tildes, y tratando `%` y `_` como texto. La sección SHALL buscar mientras se
escribe en su campo de búsqueda.

#### Scenario: Sin tildes

- **WHEN** existe una nota con "Canción de cumpleaños" y se busca "cancion"
- **THEN** la nota aparece en los resultados

#### Scenario: Sin resultados

- **WHEN** ninguna nota contiene el término
- **THEN** la sección dice que no hay notas que coincidan con la búsqueda

### Requirement: Leer una nota

`GET /api/notes/:id` SHALL responder la nota completa, o `404` si no existe. El detalle SHALL tener su
propia dirección dentro de la sección Notas y SHALL mostrar el Markdown con formato, sin ejecutar ni
cargar nada que venga en el texto, con los enlaces abriéndose en otra pestaña y sin desplazamiento
horizontal de la página.

#### Scenario: Markdown con formato

- **WHEN** se abre una nota con una lista y un enlace
- **THEN** se ve la lista con formato y el enlace abre en otra pestaña

#### Scenario: HTML peligroso

- **WHEN** el contenido de una nota incluye `<script>` o un atributo `onerror`
- **THEN** no se ejecuta nada y ese HTML no aparece en la página

#### Scenario: Nota que no existe

- **WHEN** se abre la dirección de una nota que no existe
- **THEN** se indica que la nota no existe, con un enlace de vuelta a la lista

### Requirement: Editar con autoguardado

`PATCH /api/notes/:id` SHALL actualizar el contenido y responder la nota con el título recalculado. El
detalle SHALL tener un modo de edición, y SHALL guardar el texto un segundo después de la última
pulsación, al volver a la vista con formato, al salir de la nota y al pasar la app a segundo plano,
indicando si está guardando, si ha guardado o si ha fallado, con una forma de reintentar. Un fallo
SHALL NOT perder el texto escrito. Una nota que se deja vacía SHALL eliminarse al salir de ella.

#### Scenario: Guarda solo

- **WHEN** se escribe en una nota y se deja de escribir durante un segundo
- **THEN** el texto se guarda sin pulsar nada y se indica "Guardado"

#### Scenario: El guardado falla

- **WHEN** la API responde con error al guardar
- **THEN** se indica que no se ha podido guardar, el texto sigue en el editor y se puede reintentar

#### Scenario: Nota vacía

- **WHEN** se borra todo el texto de una nota y se vuelve a la lista
- **THEN** la nota se elimina y se avisa de ello

### Requirement: Fijar una nota

`PATCH /api/notes/:id` con `pinned` SHALL fijar o desfijar la nota sin cambiar su fecha de
modificación. El detalle SHALL ofrecer fijar y desfijar, indicando su estado de forma accesible.

#### Scenario: Fijar

- **WHEN** se fija una nota
- **THEN** pasa a la parte de "Fijadas" de la lista sin cambiar su fecha de modificación

### Requirement: Eliminar una nota

`DELETE /api/notes/:id` SHALL eliminar la nota y responder `204`, o `404` si no existe. El detalle
SHALL pedir confirmación antes de eliminar y volver a la lista después.

#### Scenario: Eliminar con confirmación

- **WHEN** se pulsa eliminar y se confirma
- **THEN** la nota desaparece y se vuelve a la lista

#### Scenario: Cancelar la eliminación

- **WHEN** se pulsa eliminar y no se confirma
- **THEN** la nota sigue igual

### Requirement: Capturar una nota

Estando en la lista de **Notas**, la barra de captura SHALL crear una nota con el texto escrito como
primera línea y abrir su detalle en modo de edición. Si la API falla, el texto SHALL volver a la barra
y no SHALL abrirse nada.

#### Scenario: Capturar en Notas

- **WHEN** en la lista de Notas se escribe "Ideas para el viaje" en la barra y se envía
- **THEN** se abre la nota "Ideas para el viaje" en modo de edición
