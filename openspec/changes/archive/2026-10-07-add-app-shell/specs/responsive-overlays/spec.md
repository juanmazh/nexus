# Spec Delta

## Purpose

Única forma de superponer contenido sobre la aplicación: un componente de overlay que es hoja
inferior en el móvil y diálogo en escritorio, más un único aviso temporal. Ninguna vista usa los
componentes de overlay por su cuenta, de modo que el comportamiento es idéntico en todas partes.

## ADDED Requirements

### Requirement: Un único componente de overlay

La aplicación SHALL exponer un solo componente de overlay. Por debajo de 1024 px de ancho SHALL
presentarse como hoja inferior anclada al borde inferior; a partir de 1024 px SHALL presentarse como
diálogo centrado. En ambos casos SHALL tener título, contenido y acciones con las mismas
funciones, y SHALL retener el foco dentro de él mientras esté abierto.

#### Scenario: Overlay en el móvil (360 px)

- **WHEN** se abre un overlay a 360 px de ancho
- **THEN** aparece como una hoja pegada a la parte inferior de la pantalla, con esquinas superiores
  redondeadas
- **AND** su contenido se puede desplazar si no cabe
- **AND** la hoja respeta la zona segura inferior del dispositivo

#### Scenario: Overlay en escritorio (1280 px)

- **WHEN** se abre el mismo overlay a 1280 px de ancho
- **THEN** aparece como un diálogo centrado, con la misma información y las mismas acciones

#### Scenario: El foco no se escapa del overlay

- **WHEN** un overlay está abierto
- **THEN** el foco está dentro del overlay y no puede desplazarse al contenido de detrás
- **AND** el contenido de detrás se marca como inaccesible para las tecnologías de asistencia

### Requirement: Cierre del overlay y retorno del foco

Un overlay SHALL poder cerrarse con un botón de cerrar visible, con la tecla de escape y tocando
fuera de él. Al cerrarse, el foco SHALL volver al elemento que lo abrió.

#### Scenario: Cerrar con el botón visible

- **WHEN** un overlay está abierto
- **THEN** hay un botón de cerrar visible cuyo área táctil mide al menos 44 × 44 px

#### Scenario: Cerrar con la tecla de escape

- **WHEN** un overlay está abierto y se pulsa la tecla de escape
- **THEN** el overlay se cierra

#### Scenario: El foco vuelve a donde estaba

- **WHEN** se cierra un overlay
- **THEN** el foco vuelve al control que lo abrió

### Requirement: Acciones del overlay con el teclado virtual abierto

Las acciones principales de un overlay SHALL seguir siendo alcanzables con el teclado virtual
abierto en el móvil: el overlay SHALL ocupar como máximo el alto disponible de la pantalla usando
unidades de viewport dinámicas y su contenido desplazable SHALL conservar el acceso a las acciones.

#### Scenario: Teclado virtual abierto

- **WHEN** se abre un overlay a 360 px y se enfoca un campo de texto
- **THEN** la acción principal del overlay sigue siendo visible y alcanzable

### Requirement: Avisos temporales

La aplicación SHALL tener un único lugar donde aparecen los avisos temporales. Por debajo de 1024 px
los avisos SHALL aparecer en la parte superior, de modo que no tapen la barra de pestañas ni la barra
de captura; a partir de 1024 px SHALL aparecer en la esquina inferior derecha. El texto del aviso
SHALL usar el mismo verbo que el botón que lo provocar.

#### Scenario: Aviso en el móvil (360 px)

- **WHEN** se emite un aviso a 360 px de ancho
- **THEN** aparece en la parte superior de la pantalla
- **AND** no tapa ni la barra de pestañas ni la barra de captura

#### Scenario: Aviso en escritorio (1280 px)

- **WHEN** se emite un aviso a 1280 px de ancho
- **THEN** aparece en la esquina inferior derecha

#### Scenario: El aviso se anuncia y se retira solo

- **WHEN** se emite un aviso
- **THEN** se anuncia a las tecnologías de asistencia
- **AND** desaparece solo sin que la persona tenga que hacer nada
