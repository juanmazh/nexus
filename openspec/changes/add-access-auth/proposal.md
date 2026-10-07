# Proposal

## Why

Cloudflare Access ya va a estar delante del Worker, pero hoy el Worker **se fía de ello sin
comprobarlo**: cualquier petición que llegue al Worker sin pasar por Access (una URL alternativa sin
cubrir, una aplicación de Access desactivada por error, un `curl` directo al `workers.dev`) recibe la
misma respuesta que un usuario legítimo. Además la API no tiene forma de saber **quién** es la
persona que llama, y las respuestas no llevan las cabeceras de seguridad que `AGENTS.md §6.6` exige.

Este es el momento de cerrar esa puerta porque es la última fase antes de que empiece a haber datos
que proteger: en cuanto existan tareas y notas, un endpoint mal protegido expone información real.
Es además el cambio 0.2 del roadmap, el siguiente paso natural tras el andamiaje.

## What Changes

- **Middleware de Access** en `worker/middleware/access.ts`, montado en `worker/app.ts` sobre todas
  las rutas de `/api/*` **salvo** `GET /api/health`. Valida el JWT de la cabecera
  `Cf-Access-Jwt-Assertion`: firma RS256 contra las claves públicas del equipo de Access, `aud`
  igual al secreto `ACCESS_AUD`, `iss` igual a `https://<ACCESS_TEAM_DOMAIN>` y expiración.
- **Política fail closed**: si falta la cabecera, o el token no supera cualquiera de esas
  comprobaciones, la respuesta es `401` con la forma `{ error: { code, message } }` y **no** se
  ejecuta ninguna lógica de la ruta.
- **Atajo local documentado y doblemente protegido** para que `pnpm dev` siga siendo usable sin
  Access delante (ver `design.md §3`): solo se activa si la variable `ACCESS_DEV_BYPASS` está activa
  **y** la petición viene de `localhost`. Ninguna de las dos condiciones se puede dar en producción.
- **`GET /api/me`**: devuelve el email del JWT validado (`200` con sesión válida, `401` sin ella).
  Es el origen tipado de "quién está dentro" para el shell.
- **Cabeceras de seguridad** en dos sitios, porque el Worker no ve el HTML de la SPA: en las
  respuestas de `/api/*` (middleware) y en los assets y el `index.html` (fichero `_headers`).
- **`ACCESS_TEAM_DOMAIN`** pasa a ser una variable de `wrangler.jsonc`. `ACCESS_AUD` ya estaba
  preparado en `.dev.vars.example` y ahora pasa a ser de verdad un secreto en producción.
- El manejador central de errores **ya existe** desde `bootstrap-project`; este cambio le añade la
  ruta del `401` y unifica el `code` en minúsculas (ver `Impact`).

### Cambio de comportamiento en rutas inexistentes

Hoy `GET /api/no-existe` sin sesión responde `404`. Con el middleware montado antes del enrutado,
una petición **sin sesión válida** responde `401` y solo una petición **autenticada** recibe el
`404`. No es un efecto secundario: es exactamente lo que falla cerrado significa, y evita que un
visitante sin sesión pueda enumerar qué rutas existen. Se actualiza el requisito correspondiente de
la capacidad `api-health`.

## Capabilities

### New Capabilities

- `access-auth`: validación del JWT de Access en el Worker, política fail closed, el atajo local y el
  endpoint `GET /api/me` que expone la identidad de la sesión.
- `security-headers`: cabeceras de seguridad en las respuestas de la API y en los assets de la SPA
  (CSP, `X-Content-Type-Options`, `Referrer-Policy` y antiframeo).

### Modified Capabilities

- `api-health`: la ruta de API inexistente pasa a responder `401` cuando la petición no lleva sesión
  válida, y `404` solo cuando sí la lleva.

## Fuera de alcance

- **Roles, permisos o varios usuarios.** El proyecto es de un único usuario (`AGENTS.md §1`).
- **Login propio o usuarios en D1.** La autenticación es Access, no nuestra.
- **Allowlist de emails dentro del Worker.** Access ya restringe por email al desplegar
  (`docs/PROGRESS.md` S3). Una segunda lista en el Worker sería un sitio más que mantener y un lugar
  más donde meter un email real en un repo público.
- **UI que muestre la sesión.** El shell es de `add-app-shell` (0.3). Este cambio entrega el
  contrato y su tipo, no la pantalla; añadirla aquí ampliaría el PR y obligaría a escribir tests de
  Playwright que todavía no existen (`AGENTS.md §4`).
- **HSTS**, que se decide cuando exista el dominio propio (fase 3, `move-to-custom-domain`).
- **Playwright / `test:e2e`**, que llega con `add-app-shell`.
- **CSP específica del blog**, que llega con `add-blog` (fase 3).

## Impact

- **Fase del roadmap**: 0.2 (`add-access-auth`), el siguiente tras `bootstrap-project`.
- **Dependencia nueva**: `jose@^6.2.12` (MIT, build WebCrypto, `sideEffects: false`). Es la primera
  dependencia fuera de `AGENTS.md §2`; queda justificada en `design.md §1`. Sin ella habría que
  escribir a mano el parseo del JWT, la importación del JWK y la verificación RS256 con WebCrypto.
- **Secretos**: `ACCESS_AUD` pasa a ser necesario en producción (`wrangler secret put ACCESS_AUD`).
  Ya estaba en `.dev.vars.example` desde `bootstrap-project`, así que no aparece ningún secreto nuevo.
- **Variables nuevas**: `ACCESS_TEAM_DOMAIN` (pública, en `wrangler.jsonc`) y `ACCESS_DEV_BYPASS`
  (solo en `.dev.vars`, nunca desplegada).
- **Esquema de datos**: **ningún cambio**. No hay tablas ni migración; `/api/me` lee el JWT, no D1.
- **Riesgo de rotura**: el único cambio observable para el usuario es que `/api/*` pasa a exigir
  sesión. En producción Access ya está delante, así que el usuario no nota nada; el que nota el
  cambio es el código que hoy funciona sin sesión, y solo existe `/api/health`, que queda exento.
- **Límites del plan gratuito**: 0 filas leídas y 0 escritas en D1. Las subpeticiones son ocasionales: el JWKS se pide **una vez por isolate** y se cachea en memoria (rotación cada 6
  semanas, clave anterior válida 7 días), de modo que el coste habitual es de 0 subpeticiones por
  petición. La verificación RSA está muy por debajo de los 10 ms de CPU. **Sin impacto en el coste.**
- **Límite de tamaño**: un PR, por debajo de las ~600 líneas de producto orientativas.

### Desviación documental que este cambio corrige

`docs/ARCHITECTURE.md §3.1` ilustra el error de autenticación con `code: "UNAUTHORIZED"` en
mayúsculas, pero el código existente usa minúsculas (`not_found`, `internal_error`,
`method_not_allowed`). Se adopta minúsculas y se corrige el documento, para que el front tenga un
único criterio.