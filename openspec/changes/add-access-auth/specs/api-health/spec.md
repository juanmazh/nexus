# Spec Delta

## MODIFIED Requirements

### Requirement: El Worker sirve la SPA y la API en el mismo origen

El Worker SHALL servir los assets estáticos de la SPA y las rutas de la API bajo el mismo origen, de
modo que la SPA pueda llamar a `/api/*` sin CORS. Las rutas que no existen bajo `/api/*` SHALL
devolver `404` con la forma de error del proyecto, en lugar del HTML de la SPA, siempre que la
petición lleve una sesión válida. Una petición sin sesión válida SHALL ser denegada con `401` antes
de comprobar el enrutado.

#### Scenario: Ruta de la SPA en cliente

- **WHEN** el navegador pide una ruta interna de la SPA, por ejemplo `/` o cualquier ruta de la
  aplicación que aún no existe
- **THEN** el Worker devuelve el `index.html` de la SPA con estado `200`, de forma que el router del
  cliente resuelva la ruta

#### Scenario: Ruta de API inexistente

- **WHEN** se pide `GET /api/no-existe` con una sesión válida
- **THEN** la respuesta tiene estado `404`
- **AND** el cuerpo JSON tiene la forma `{ "error": { "code": string, "message": string } }`
- **AND** el cuerpo no es HTML

#### Scenario: Ruta de API inexistente sin sesión válida

- **WHEN** se pide `GET /api/no-existe` sin cabecera `Cf-Access-Jwt-Assertion`
- **THEN** la respuesta tiene estado `401` con la forma `{ "error": { "code": string, "message":
  string } }`
- **AND** el cuerpo no es HTML