## ADDED Requirements

### Requirement: Recuperación tras un despliegue

Si falla la carga de un fichero de la app, la app SHALL recargarse una vez para traer la versión
desplegada. No SHALL volver a recargarse si ya lo hizo en los últimos 10 segundos ni sin conexión.
Si la sección sigue sin cargar, SHALL mostrarse dentro de la shell un error en español con un botón
"Recargar".

#### Scenario: Fichero de una versión anterior

- **WHEN** la app sigue abierta tras un deploy y se entra en una sección que aún no se había cargado
- **THEN** la página se recarga una vez y la sección se muestra

#### Scenario: Sin bucle

- **WHEN** la carga de la sección vuelve a fallar después de recargar
- **THEN** la página no se recarga de nuevo y la sección muestra el error con "Recargar"
- **AND** la navegación y la barra de captura siguen disponibles
