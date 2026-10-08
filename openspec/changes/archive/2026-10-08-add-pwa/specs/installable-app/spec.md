# Spec Delta

## Purpose

Lo que hace que Nexus se instale y se comporte como una app en el móvil: el manifest, los iconos, el
color de la barra de estado según el tema, y la ausencia deliberada de un *service worker*, para que
abrir la app instalada sea siempre abrir la última versión detrás de Cloudflare Access.

## ADDED Requirements

### Requirement: Manifest de aplicación web

La SPA SHALL enlazar un manifest con nombre "Nexus", `start_url` y `scope` en `/`, `display`
`standalone`, idioma `es`, y colores de fondo y de tema iguales al fondo del tema claro.

#### Scenario: El manifest se sirve y se enlaza

- **WHEN** se carga cualquier ruta de la SPA
- **THEN** el documento enlaza `/manifest.webmanifest`
- **AND** ese fichero se sirve con éxito y declara `display: standalone` y `start_url: "/"`

#### Scenario: Colores alineados con la paleta

- **WHEN** se lee el manifest
- **THEN** su `background_color` y su `theme_color` son el color de fondo del tema claro de `src/index.css`

### Requirement: Iconos de la aplicación

El manifest SHALL declarar iconos PNG de 192 y 512 px y uno *maskable* de 512 px cuyo contenido
quepa en la zona segura central. La SPA SHALL tener además favicon y `apple-touch-icon`.

#### Scenario: Iconos con sus dimensiones

- **WHEN** se leen los iconos declarados
- **THEN** cada PNG existe y mide exactamente lo que declara

#### Scenario: Icono adaptable

- **WHEN** Android recorta el icono *maskable* en un círculo
- **THEN** la letra queda entera dentro del recorte

### Requirement: Color de la barra de estado según el tema

El documento SHALL tener un `theme-color` igual al color de fondo del tema pintado, y SHALL
actualizarlo al cambiar de tema, incluido un cambio manual en **Más**.

#### Scenario: Tema oscuro

- **WHEN** la app se pinta en tema oscuro
- **THEN** `theme-color` es el color de fondo del tema oscuro

#### Scenario: Cambio manual de tema

- **WHEN** se cambia de claro a oscuro en **Más**
- **THEN** `theme-color` pasa al color de fondo del tema oscuro sin recargar

### Requirement: Sin service worker

La SPA NO SHALL registrar ningún *service worker*. Abrir la app instalada SHALL cargar la versión
desplegada en ese momento y pasar por Cloudflare Access como cualquier navegación.

#### Scenario: Ninguna caché propia

- **WHEN** se carga la SPA
- **THEN** no hay ningún *service worker* registrado para su origen

#### Scenario: Nueva versión desplegada

- **WHEN** se despliega una versión nueva y se vuelve a abrir la app instalada
- **THEN** se carga la versión nueva sin ningún paso adicional
