# Spec Delta

## Purpose

Dirección visual de Nexus: la paleta "olivar" en modo claro y oscuro, la tipografía propia servida
desde el propio origen y las reglas de forma que hacen que la aplicación se vea como una sola cosa y
no como un ensamblaje de componentes sueltos.

## ADDED Requirements

### Requirement: Tema claro y oscuro con conmutador

La aplicación SHALL ofrecer un modo claro y un modo oscuro completos, y SHALL seguir la preferencia
del sistema mientras la persona no elija otra cosa. Una elección manual SHALL conservarse al
recargar y al volver a abrir la aplicación. Los textos SHALL mantener contraste AA en ambos modos.

#### Scenario: Sin elección previa

- **WHEN** se abre la aplicación por primera vez y el sistema está en modo oscuro
- **THEN** la aplicación se muestra en modo oscuro

#### Scenario: Elección manual que se recuerda

- **WHEN** se elige explícitamente un modo distinto del del sistema
- **AND** se recarga la aplicación
- **THEN** la aplicación se muestra en el modo elegido

#### Scenario: Contraste en ambos modos

- **WHEN** se recorre cualquier sección en modo claro y en modo oscuro
- **THEN** el texto y su fondo mantienen contraste AA

### Requirement: Paleta "olivar" expresada en tokens

Los colores de la aplicación SHALL definirse como tokens del tema, con el fondo cal, el texto tinta,
el primario olivo, el acento aceite, el secundario piedra y el destructivo granada. Ningún
componente SHALL fijar un color literal. El acento aceite SHALL reservarse para marcar "lo de ahora",
para que no pierda su significado por aparecer en todas partes.

#### Scenario: Los componentes usan tokens

- **WHEN** se inspecciona el estilo de cualquier componente de la aplicación
- **THEN** sus colores provienen de los tokens del tema y no de valores literales

#### Scenario: Los pares de tokens cumplen el contraste

- **WHEN** se comprueban los tokens del tema en modo claro y en modo oscuro
- **THEN** el texto principal, el texto secundario y el texto sobre los colores primario, acento y
  destructivo tienen un contraste de 4,5:1 o más con su fondo
- **AND** el marcador de "ahora" y el anillo de foco tienen un contraste de 3:1 o más con el fondo

#### Scenario: El acento marca lo de ahora

- **WHEN** se revisa la aplicación
- **THEN** el acento aceite aparece únicamente junto a lo que corresponde a "ahora" o a hoy
- **AND** no se usa para decorar acciones corrientes

### Requirement: Tipografía propia servida desde el propio origen

Los títulos de vista SHALL usar Bricolage Grotesque y el resto del texto SHALL usar Atkinson
Hyperlegible Next. Ambas fuentes SHALL servirse desde el propio origen, sin peticiones a terceros, y
con `font-display: swap` para que el texto sea legible antes de que carguen. El cuerpo del texto
SHALL ser de 16 px como mínimo y SHALL tener interlineado de 1,5.

#### Scenario: Las fuentes se sirven sin salir del propio origen

- **WHEN** se carga la aplicación
- **THEN** todas las peticiones de fuentes van al propio origen
- **AND** el texto se muestra con una fuente de reserva hasta que la definitiva está lista

#### Scenario: Escala tipográfica

- **WHEN** se abre una sección a 360 px de ancho
- **THEN** el título de la vista usa la familia de títulos
- **AND** el cuerpo del texto es de 16 px como mínimo y no obliga a desplazarse

### Requirement: Forma y jerarquía

Los campos y botones SHALL tener las mismas esquinas redondeadas; las hojas SHALL tener las
superiores más redondeadas que las inferiores; y las listas SHALL presentarse como filas separadas
por líneas finas, no como tarjetas. Las sombras SHALL reservarse para lo que flota sobre el contenido.

#### Scenario: Listas en filas

- **WHEN** una sección muestra una lista de elementos
- **THEN** los elementos se separan con líneas finas y no aparecen como tarjetas con sombra

#### Scenario: Sombras solo en lo que flota

- **WHEN** se revisa la interfaz
- **THEN** las sombras aparecen únicamente en elementos superpuestos, como la hoja inferior y la
  barra de captura
