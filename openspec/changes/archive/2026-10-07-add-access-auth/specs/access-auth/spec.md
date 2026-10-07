# Spec Delta

## Purpose

Capa de autenticación del Worker: comprueba que cada petición a la API llega con una sesión de
Cloudflare Access válida antes de dejar que se ejecute nada, y expone la identidad de esa sesión.

## ADDED Requirements

### Requirement: Sesión de Access exigida en la API

Toda ruta bajo `/api/*` SHALL exigir una sesión de Access válida, con la única excepción de
`GET /api/health`. Ante la ausencia de sesión, un token que no se pueda verificar o cualquier
comprobación fallida, la petición SHALL ser denegada antes de ejecutar el manejador de la ruta.

#### Scenario: Petición con una sesión válida

- **WHEN** se envía una petición a una ruta de `/api/*` con un token correctamente firmado, con la
  audiencia y el emisor correctos y sin expirar
- **THEN** la ruta se ejecuta con normalidad
- **AND** la respuesta no incluye información sobre las comprobaciones internas

#### Scenario: Petición sin cabecera de sesión

- **WHEN** se envía una petición a una ruta de `/api/*` sin la cabecera `Cf-Access-Jwt-Assertion`
- **THEN** la respuesta tiene estado `401`
- **AND** el cuerpo es JSON con la forma `{ "error": { "code": string, "message": string } }`

#### Scenario: Cabecera con un token ilegible

- **WHEN** el valor de la cabecera no es un token con la estructura esperada
- **THEN** la respuesta tiene estado `401`
- **AND** la respuesta no es HTML ni un error `500`

#### Scenario: Denegar no ejecuta la ruta

- **WHEN** una petición a una ruta de `/api/*` es denegada
- **THEN** el manejador de esa ruta no se ejecuta
- **AND** no se realiza ninguna consulta a la base de datos

#### Scenario: La denegación no revela qué rutas existen

- **WHEN** una petición sin sesión válida va a una ruta de `/api/*` que **no existe**
- **THEN** la respuesta tiene estado `401`, no `404`
- **AND** su cuerpo es indistinguible del de una denegación sobre una ruta que sí existe

### Requirement: Criterios de validez de la sesión

Una sesión SHALL considerarse válida solo si el token de la cabecera `Cf-Access-Jwt-Assertion` tiene
firma válida contra las claves públicas del equipo de Access, audiencia igual a la configurada para la
aplicación, emisor igual al dominio del equipo de Access y expiración en el futuro. Las marcas de
tiempo se expresan en epoch y se comparan con el instante actual.

#### Scenario: Token con firma inválida

- **WHEN** el token de la cabecera fue firmado con una clave que no es del equipo de Access
- **THEN** la respuesta tiene estado `401`
- **AND** el cuerpo es JSON con la forma `{ "error": { "code": string, "message": string } }`

#### Scenario: Token con audiencia incorrecta

- **WHEN** el token está correctamente firmado pero su audiencia no corresponde a esta aplicación
- **THEN** la respuesta tiene estado `401`
- **AND** el cuerpo es JSON con la forma `{ "error": { "code": string, "message": string } }`

#### Scenario: Token con emisor incorrecto

- **WHEN** el token está correctamente firmado pero fue emitido por un equipo de Access distinto del
  configurado
- **THEN** la respuesta tiene estado `401`

#### Scenario: Token expirado

- **WHEN** el momento de expiración del token ya ha pasado
- **THEN** la respuesta tiene estado `401`

#### Scenario: Token que aún no es válido

- **WHEN** el token declara que no es válido antes de un momento posterior al instante actual
  (`nbf` en el futuro)
- **THEN** la respuesta tiene estado `401`

### Requirement: Forma del error de acceso denegado

El acceso denegado SHALL usar la forma de error única del proyecto, con el código `unauthorized` en
minúsculas, un mensaje redactado para la persona que usa la aplicación y **nunca** un stack trace ni
el motivo real por el que se denegó. El cuerpo SHALL ser JSON, nunca HTML.

#### Scenario: Denegación sin sesión

- **WHEN** una petición es denegada por no tener sesión válida
- **THEN** el estado es `401` y la cabecera `Content-Type` indica `application/json`
- **AND** el cuerpo es `{ "error": { "code": "unauthorized", "message": string } }`

#### Scenario: El motivo de la denegación no se filtra

- **WHEN** una petición es denegada por un token expirado, con firma inválida o con audiencia
  incorrecta
- **THEN** el mensaje es el mismo que en el resto de denegaciones
- **AND** el cuerpo no contiene ni el motivo de la denegación ni detalles de verificación

### Requirement: Identidad de la sesión

La API SHALL exponer `GET /api/me` bajo el prefijo `/api/*`. Con una sesión válida SHALL responder
`200` con `Content-Type: application/json` y un cuerpo JSON con la forma `{ "user": { "email":
string } }`, cuyo email es el del token verificado. La respuesta SHALL derivarse del token. No SHALL
leer ni escribir en la base de datos.

#### Scenario: Consulta con sesión válida

- **WHEN** se envía `GET /api/me` con un token válido cuyo email es `persona@ejemplo.test`
- **THEN** la respuesta tiene estado `200`
- **AND** el cuerpo es `{ "user": { "email": "persona@ejemplo.test" } }`

#### Scenario: Consulta sin sesión válida

- **WHEN** se envía `GET /api/me` sin cabecera, con token inválido o con token expirado
- **THEN** la respuesta tiene estado `401` con la forma de error del proyecto
- **AND** no revela ningún email

#### Scenario: Token válido sin email

- **WHEN** el token supera todas las comprobaciones pero no incluye un email
- **THEN** la respuesta tiene estado `401`, porque la aplicación no puede identificar a la persona

#### Scenario: Método no permitido

- **WHEN** se envía a `/api/me` un método distinto de `GET`, por ejemplo `POST`
- **THEN** la respuesta tiene estado `405` con la cabecera `Allow: GET` y la forma de error del
  proyecto

### Requirement: Atajo de autenticación restringido al entorno local

SHALL existir un modo de desarrollo que permita llamar a rutas de `/api/*` sin sesión, y que SHALL
activarse **solo** cuando se cumplan las dos condiciones siguientes a la vez: el atajo está activo en
la configuración del entorno de desarrollo y la petición procede de `localhost`. Si falta cualquiera
de las dos, o si la petición procede de cualquier otro host, se SHALL denegar con `401` como en
cualquier otro caso sin sesión.

#### Scenario: Desarrollo local con el atajo activo

- **WHEN** llega una petición a una ruta de `/api/*` desde `localhost` con el atajo activo en el
  entorno de desarrollo
- **THEN** la ruta se ejecuta sin exigir token
- **AND** la respuesta indica que la sesión es de desarrollo

#### Scenario: Desarrollo local con el atajo desactivado

- **WHEN** llega una petición desde `localhost` con el atajo desactivado
- **THEN** la respuesta tiene estado `401`

#### Scenario: Configuración de Access ausente

- **WHEN** falta la audiencia o el dominio del equipo de Access en la configuración del Worker
- **THEN** cualquier petición a una ruta protegida de `/api/*` recibe `401`
- **AND** la petición nunca se deja pasar ni produce un error sin controlar

#### Scenario: Atajo activo pero host que no es local

- **WHEN** el atajo está activo en la configuración pero la petición procede de un host distinto de
  `localhost`
- **THEN** la respuesta tiene estado `401`
- **AND** el atajo no ejecuta la ruta

### Requirement: Las claves de Access admiten su rotación

La verificación SHALL aceptar un token firmado con la clave pública anterior a la rotación durante el
periodo en que Access la mantiene publicada. Las claves ya descargadas SHALL reutilizarse para las
peticiones siguientes en lugar de volver a pedirse, sin dejar de aceptar un token firmado con la clave
que acaba de entrar en rotación.

#### Scenario: Token firmado con la clave anterior

- **WHEN** un token válido fue firmado con la clave pública anterior y Access todavía la publica
- **THEN** la sesión se acepta y la ruta se ejecuta

#### Scenario: Token firmado con una clave ya retirada

- **WHEN** un token fue firmado con una clave que Access ya no publica
- **THEN** la respuesta tiene estado `401`