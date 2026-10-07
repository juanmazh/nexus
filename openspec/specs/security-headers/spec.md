# security-headers Specification

## Purpose

Cabeceras de seguridad en las respuestas que sirve Nexus, tanto las de la API como las de la SPA y sus
assets, para que el navegador no ejecute contenido inyectado ni permita el framing de la aplicación.

## Requirements

### Requirement: Cabeceras de seguridad en las respuestas de la API

Toda respuesta bajo `/api/*` SHALL incluir `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer` y una `Content-Security-Policy` que no permita cargar recursos ni
enmarcar la respuesta. Esto SHALL aplicarse igual a las respuestas de éxito y a las de error.

#### Scenario: Respuesta de éxito de la API

- **WHEN** una ruta de `/api/*` responde `200`
- **THEN** la respuesta incluye `X-Content-Type-Options: nosniff` y `Referrer-Policy: no-referrer`
- **AND** incluye una `Content-Security-Policy` restrictiva

#### Scenario: Respuesta de error de la API

- **WHEN** una ruta de `/api/*` responde `401`, `404`, `405` o `500`
- **THEN** la respuesta incluye las mismas cabeceras de seguridad que en una respuesta de éxito

#### Scenario: La API no puede enmarcarse

- **WHEN** se sirve cualquier respuesta de `/api/*`
- **THEN** la respuesta prohíbe que sea incrustada en un `frame` o `iframe`

### Requirement: Cabeceras de seguridad en la SPA y sus assets

El documento HTML de la aplicación y los assets que carga SHALL servirse con `X-Content-Type-Options:
nosniff`, `Referrer-Policy: no-referrer` y una `Content-Security-Policy` que permita cargar
únicamente recursos del propio origen, y que prohíba el framing.

#### Scenario: Carga inicial de la aplicación

- **WHEN** el navegador pide la raíz de la aplicación y recibe el documento HTML
- **THEN** la respuesta incluye las cabeceras de seguridad
- **AND** la `Content-Security-Policy` limita los recursos al propio origen

#### Scenario: Carga de un asset de la aplicación

- **WHEN** el navegador pide un asset de la SPA (JavaScript, CSS o fuente)
- **THEN** la respuesta incluye `X-Content-Type-Options: nosniff`

#### Scenario: Intento de framing de la aplicación

- **WHEN** un sitio intenta incrustar la aplicación en un `iframe`
- **THEN** la respuesta lo impide

#### Scenario: Un recurso de otro origen no se ejecuta

- **WHEN** la aplicación intenta cargar un script de un origen distinto del propio
- **THEN** la política de seguridad impide que ese script llegue a ejecutarse

### Requirement: La política de seguridad no rompe la aplicación

La `Content-Security-Policy` SHALL ser compatible con el funcionamiento real de la SPA: los scripts y
estilos propios, las peticiones al Worker y las fuentes servidas desde el propio origen SHALL seguir
funcionando con la política aplicada.

#### Scenario: La aplicación funciona con la política aplicada

- **WHEN** se sirve la SPA con su `Content-Security-Policy` y la aplicación se usa con normalidad
- **THEN** la carga, el enrutado del cliente y las llamadas a la API funcionan
- **AND** la consola del navegador no registra violaciones de la política

#### Scenario: Recursos propios que la aplicación necesita

- **WHEN** la aplicación carga sus scripts, sus estilos y sus fuentes desde el propio origen
- **THEN** la política los permite
- **AND** no bloquea los estilos que la biblioteca de componentes aplica en línea