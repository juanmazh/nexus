# Spec Delta

## Purpose

Comprobación automática de que la aplicación sigue siendo usable en el móvil y se amplía bien en
escritorio. Convierte las reglas de `docs/DESIGN.md §6` en algo que rompe la CI cuando se incumple,
en lugar de algo que se recuerda al final del cambio.

## ADDED Requirements

### Requirement: Suite de pruebas con los dos viewports de referencia

El proyecto SHALL incluir una suite de pruebas de navegador con dos proyectos, uno de **móvil de
360 × 780** y otro de **escritorio de 1280 × 800**. Cada ruta de la aplicación SHALL estar cubierta en
los dos proyectos.

#### Scenario: Cada ruta se prueba en móvil y en escritorio

- **WHEN** se ejecuta la suite de pruebas de navegador
- **THEN** cada ruta de la aplicación se comprueba con el viewport de móvil y con el de escritorio

#### Scenario: Un fallo responsive rompe la ejecución

- **WHEN** una ruta incumple una comprobación responsive en cualquiera de los dos viewports
- **THEN** esa prueba falla e identifica el viewport en el que se incumplió

### Requirement: Comprobaciones obligatorias por ruta

Para cada ruta, en ambos viewports, la suite SHALL comprobar que la página no tiene scroll horizontal
de documento, que la acción principal de la vista es visible sin desplazamiento y que los elementos
interactivos principales miden al menos 44 px de alto.

#### Scenario: Sin scroll horizontal

- **WHEN** se abre cualquier ruta a 360 px de ancho
- **THEN** el ancho de scroll del documento no supera el ancho de la ventana

#### Scenario: La acción principal no exige desplazamiento

- **WHEN** se abre cualquier ruta a 360 px de ancho
- **THEN** la acción principal de la vista está visible sin desplazarse

#### Scenario: Áreas táctiles suficientes

- **WHEN** se abre cualquier ruta
- **THEN** los elementos interactivos principales miden al menos 44 px de alto

### Requirement: La suite se ejecuta en la CI

El proyecto SHALL ofrecer un comando `test:e2e` que ejecute la suite de navegador, y la CI SHALL
ejecutarlo en cada pull request y en `main`, de modo que el trabajo falle si alguna comprobación
responsive falla.

#### Scenario: Pull request con un fallo responsive

- **WHEN** un pull request introduce una vista que desborda horizontalmente a 360 px
- **THEN** el trabajo de la CI termina en fallo y señala la prueba responsable

#### Scenario: El comando está disponible en local

- **WHEN** se ejecuta `pnpm test:e2e` en un equipo con el navegador instalado
- **THEN** la suite se ejecuta en los dos viewports y devuelve el resultado

### Requirement: La suite no necesita credenciales ni secretos

La suite de navegador SHALL poder ejecutarse sin una aplicación de Cloudflare Access delante, sin
`ACCESS_AUD` y sin el atajo de autenticación local. Las respuestas de la API que necesite SHALL
proporcionarse desde la propia prueba, de modo que ni la CI ni un equipo nuevo necesiten secretos
para ejecutarla.

#### Scenario: La suite se ejecuta en la CI sin secretos

- **WHEN** la CI ejecuta la suite de navegador sin ningún secreto configurado
- **THEN** todas las pruebas pasan
- **AND** no hay ningún valor escrito en `.dev.vars`
