# Spec Delta

## MODIFIED Requirements

### Requirement: Endpoint de salud

La API SHALL exponer `GET /api/health` bajo el prefijo `/api/*`. No SHALL requerir autenticación ni
leer ni escribir en la base de datos. Cuando la petición llega correctamente, SHALL responder `200`
con `Content-Type: application/json` y un cuerpo JSON con exactamente la propiedad `status` cuyo
valor es la cadena `ok`.

#### Scenario: Consulta correcta

- **WHEN** se envía `GET /api/health` al Worker desplegado
- **THEN** la respuesta tiene estado `200`
- **AND** el cuerpo JSON es `{ "status": "ok" }`

#### Scenario: Método no permitido

- **WHEN** se envía una petición a `/api/health` con un método distinto de `GET`, por ejemplo `POST`
- **THEN** la respuesta tiene estado `405`
- **AND** incluye la cabecera `Allow: GET`
- **AND** el cuerpo JSON tiene la forma `{ "error": { "code": string, "message": string } }`

#### Scenario: Comprobación desde la SPA

- **WHEN** se abre la sección **Más** de la SPA, que es donde vive la comprobación de diagnóstico
- **THEN** la consulta a `GET /api/health` llega al navegador y la vista puede mostrar que la API
  responde

#### Scenario: Acceso sin sesión de Access

- **WHEN** se envía `GET /api/health` sin cabecera `Cf-Access-Jwt-Assertion` (por ejemplo, en local
  o contra un despliegue todavía sin Access)
- **THEN** la respuesta tiene estado `200` con `{ "status": "ok" }`, no `401`
