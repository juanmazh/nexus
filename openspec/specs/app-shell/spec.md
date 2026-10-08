# app-shell Specification

## Purpose

Estructura fija de la aplicación: cómo se navega entre secciones, dónde está la acción de capturar
algo, qué ve la persona en cada sección cuando todavía no hay nada que mostrar y qué reglas
táctiles y de viewport cumple todo el shell en el móvil, que es el dispositivo principal de Nexus.

## Requirements

### Requirement: Navegación entre secciones

La aplicación SHALL organizar su navegación en cuatro secciones —**Hoy**, **Tareas**, **Notas** y
**Más**— con una URL propia para cada una. Por debajo de 1024 px de ancho la navegación SHALL ser una
barra de pestañas en la parte inferior de la pantalla; a partir de 1024 px SHALL ser una barra
lateral con esas mismas cuatro secciones. La sección activa SHALL estar marcada como tal de forma
accesible.

#### Scenario: Navegar por las secciones en el móvil (360 px)

- **WHEN** la aplicación se abre a 360 px de ancho
- **THEN** las cuatro secciones están disponibles en una barra de pestañas en la parte inferior
- **AND** elegir una cambia a su URL y marca esa sección como activa
- **AND** cada pestaña es alcanzable con el pulgar y mide al menos 44 px de alto

#### Scenario: Navegar por las secciones en escritorio (1280 px)

- **WHEN** la aplicación se abre a 1280 px de ancho
- **THEN** las mismas cuatro secciones aparecen en una barra lateral
- **AND** la barra de pestañas de la parte inferior no está presente

#### Scenario: La sección activa es identificable sin mirar el color

- **WHEN** se inspecciona la sección activa en cualquier viewport
- **THEN** el elemento que la representa está marcado como la sección actual para las tecnologías
  de asistencia

### Requirement: Barra de la vista

Cada sección SHALL mostrar en su parte superior el título de la vista. Al cambiar de sección, el
contenido SHALL volver al principio, de modo que el título quede siempre visible.

#### Scenario: Cambio de sección

- **WHEN** se pasa de una sección a otra
- **THEN** el título de la nueva sección aparece en la parte superior del contenido
- **AND** el contenido comienza por el principio y no en un punto intermedio del scroll

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

### Requirement: Estados de cada sección

Cada sección SHALL tener un estado vacío que invite a actuar, un estado de carga con la forma del
contenido esperado y un estado de error que diga qué ha pasado. Ninguna sección SHALL depender de
`hover` para mostrar información o acciones.

#### Scenario: Sección sin contenido

- **WHEN** se abre una sección que todavía no tiene nada
- **THEN** se muestra un estado vacío que explica qué cabrá ahí e invita a añadirlo
- **AND** el texto y las acciones caben a 320 px de ancho sin scroll horizontal

#### Scenario: Contenido cargándose

- **WHEN** una sección está esperando datos
- **THEN** se muestra un esqueleto con la forma del contenido en lugar de un spinner a pantalla
  completa

#### Scenario: Error al cargar

- **WHEN** una sección no puede obtener sus datos
- **THEN** muestra un estado de error que dice qué ha fallado
- **AND** ofrece una forma de reintentar

### Requirement: Indicador de sesión

La sección **Más** SHALL mostrar quién ha iniciado sesión consultando `GET /api/me`, con su estado de
carga y su estado de error. Esa consulta SHALL realizarse solo cuando la vista **Más** esté visible y
no SHALL ejecutarse en el resto de secciones.

#### Scenario: Sesión visible en Más

- **WHEN** se abre la sección **Más**
- **THEN** se indica el email de la sesión que devuelve `GET /api/me`
- **AND** la consulta no se ha realizado antes de abrir esa sección

#### Scenario: La sesión no se puede comprobar

- **WHEN** `GET /api/me` responde con error o no responde
- **THEN** la vista **Más** muestra un estado de error que dice que no se ha podido comprobar la
  sesión
- **AND** ofrece una forma de reintentar la consulta

### Requirement: Reglas táctiles y de viewport del shell

El shell SHALL funcionar a 320 px de ancho sin scroll horizontal de página y SHALL estar diseñado
para 360 px. Las áreas tocables SHALL medir al menos 44 × 44 px, los campos de texto SHALL usar al
menos 16 px de letra, las barras SHALL respetar `env(safe-area-inset-*)` y las alturas a pantalla
completa SHALL usar unidades dinámicas de viewport. El zoom del navegador SHALL permanecer
disponible.

#### Scenario: El shell no se rompe a 320 px

- **WHEN** se abre cualquier sección a 320 px de ancho
- **THEN** no hay scroll horizontal de página
- **AND** ningún texto aparece cortado ni solapado

#### Scenario: Zoom del navegador disponible

- **WHEN** se inspecciona el `meta viewport` de la aplicación
- **THEN** su contenido es `width=device-width, initial-scale=1, viewport-fit=cover`
- **AND** no contiene `maximum-scale` ni `user-scalable`

#### Scenario: Las barras respetan las safe areas

- **WHEN** la aplicación se abre en un dispositivo con zona de gesto o muesca
- **THEN** la barra de pestañas, la barra de captura y el contenido no quedan debajo de esa zona

### Requirement: Rutas desconocidas

Una ruta que no corresponde a ninguna sección SHALL resolverse dentro del shell, mostrando un estado
de "página no encontrada" con una forma de volver a **Hoy**, en lugar de una pantalla vacía.

#### Scenario: Ruta inexistente

- **WHEN** se abre una ruta interna que no existe, por ejemplo `/no-existe`
- **THEN** se muestra el estado de página no encontrada dentro del shell
- **AND** ofrece un enlace o botón que lleva a la sección **Hoy**