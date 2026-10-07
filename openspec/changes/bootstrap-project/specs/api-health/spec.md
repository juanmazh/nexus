# Spec Delta

## Purpose

Endpoint de salud del Worker que confirma que el despliegue está vivo y que la API bajo `/api/*`
responde, accesible sin autenticación para no quedar bloqueado por Access.

## ADDED Requirements

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

- **WHEN** se envía `GET /api/health` con un método distinto de `GET`, por ejemplo `POST`
- **THEN** la respuesta tiene estado `405`
- **AND** el cuerpo JSON tiene la forma `{ "error": { "code": string, "message": string } }`

#### Scenario: Comprobación desde la SPA

- **WHEN** la SPA carga su página inicial y consulta `GET /api/health`
- **THEN** la respuesta llega al navegador y la página puede mostrar que la API responde

#### Scenario: Acceso sin sesión de Access

- **WHEN** se envía `GET /api/health` sin cabecera `Cf-Access-Jwt-Assertion` (por ejemplo, en local
  o contra un despliegue todavía sin Access)
- **THEN** la respuesta tiene estado `200` con `{ "status": "ok" }`, no `401`

### Requirement: El Worker sirve la SPA y la API en el mismo origen

El Worker SHALL servir los assets estáticos de la SPA y las rutas de la API bajo el mismo origen, de
modo que la SPA pueda llamar a `/api/*` sin CORS. Las rutas que no existen bajo `/api/*` SHALL
devolver `404` con la forma de error del proyecto, en lugar del HTML de la SPA.

#### Scenario: Ruta de la SPA en cliente

- **WHEN** el navegador pide una ruta interna de la SPA, por ejemplo `/` o cualquier ruta de la
  aplicación que aún no existe
- **THEN** el Worker devuelve el `index.html` de la SPA con estado `200`, de forma que el router del
  cliente resuelva la ruta

#### Scenario: Ruta de API inexistente

- **WHEN** se pide `GET /api/no-existe` sin autenticación
- **THEN** la respuesta tiene estado `404`
- **AND** el cuerpo JSON tiene la forma `{ "error": { "code": string, "message": string } }`
- **AND** el cuerpo no es HTML

### Requirement: Forma única de error

Toda respuesta de error de la API SHALL tener estado HTTP correcto y cuerpo JSON con la forma
`{ "error": { "code": string, "message": string } }`. El mensaje SHALL estar redactado para la persona
que usa la aplicación, nunca SHALL incluir un stack trace.

#### Scenario: Error inesperado en la API

- **WHEN** una ruta de la API lanza una excepción no controlada
- **THEN** la respuesta tiene estado `500` con la forma `{ "error": { "code": string, "message": string } }`
- **AND** el cuerpo no contiene un stack trace ni el nombre interno del fichero que falló