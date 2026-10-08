# Spec Delta

## ADDED Requirements

### Requirement: El detalle se abre al capturar

Tras crear una tarea desde la barra de captura y en cuanto la API la confirma, la aplicación SHALL
abrir el detalle de esa tarea en la sección en la que se esté, sin navegar. Si la creación falla NO
SHALL abrirse ningún detalle.

#### Scenario: Capturar desde la lista de tareas

- **WHEN** se escribe "Llamar al taller" en la barra de captura en Tareas y se envía
- **THEN** se abre el detalle de "Llamar al taller"
- **AND** desde ahí se le puede poner fecha y avisos

#### Scenario: Capturar desde otra sección

- **WHEN** se captura una tarea estando en Hoy
- **THEN** el detalle se abre encima de Hoy
- **AND** al cerrarlo se sigue en Hoy

#### Scenario: La captura falla

- **WHEN** la API responde con error a una captura
- **THEN** no se abre ningún detalle y el texto vuelve a la barra
