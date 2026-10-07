# Design

## Context

Ver `proposal.md` para la motivación. Aquí solo el estado actual que condiciona el enfoque:

- `worker/app.ts` monta Hono con `basePath: "/api"`, `onError` y `notFound` (`worker/middleware/errors.ts`),
  y encadena `routes` para exportar `AppType`. El único cliente de ese middleware es `GET /api/health`.
- `run_worker_first: ["/api/*"]` significa que **el Worker nunca ve el HTML ni los assets**: los sirve el
  gestor de static assets. Confirmado en la documentación de Cloudflare: un fichero `_headers` en el
  directorio de assets se aplica a las respuestas de assets, pero **no** a las que genera el Worker,
  aunque la URL coincida. De ahí las dos listas de cabeceras de §4.
- `worker/` compila con `lib: ["es2022"]` **sin DOM** y con `strict`, `noUncheckedIndexedAccess` y
  `noExplicitAny` (Biome). `crypto.subtle` está disponible como `globalThis.crypto` en workerd.
- Tests del Worker con `@cloudflare/vitest-plugin` 1.3.7 leyendo `wrangler.jsonc`. Su
  `cloudflare:test` **no** exporta `fetchMock` (comprobado en sus tipos), así que no hay forma
  integrada de interceptar la descarga del JWKS: el resolvedor de claves se **inyecta** (§7).
- Los tests actuales llaman a `app.fetch(new Request("http://localhost/..."))` **sin `env`**. Con el
  atajo local de §3 eso es un problema: si el `.dev.vars` de un equipo activa el atajo y el plugin lo
  carga, los tests de denegación pasarían por el atajo en ese equipo y no en la CI.
- `.dev.vars` se carga solo en local y está ignorado por git; en producción los secretos van con
  `wrangler secret put`. Esa asimetría es la base del atajo local de §3.

## Goals / Non-Goals

**Goals:**

- Que ninguna ruta de `/api/*` se ejecute sin una sesión de Access verificada, con una sola excepción
  documentada (`GET /api/health`).
- Denegar con la misma respuesta cual sea el motivo, sin filtrar cuál fue.
- Que `pnpm dev` siga siendo usable sin Access delante, sin que exista ningún camino para desactivar la
  comprobación en un despliegue.
- Cabeceras de seguridad tanto en la API como en la SPA, sin que el Worker tenga que atender el HTML.
- Cero cambios de esquema y cero coste nuevo en el plan gratuito.

**Non-Goals:**

- Sin UI: este cambio no toca `src/`. El shell y la pantalla de sesión son de `add-app-shell` (0.3), así
  que no hay wireframe móvil que dibujar ni tareas de Playwright que añadir.
- Sin HSTS ni CSP específica del blog (fase 3).
- Sin `ACCESS_AUD` por entorno (no hay entornos de staging que proteger).

## Decisions

### 1. `jose` como verificador del JWT

**Decisión:** añadir `jose@^6.2.12` y usarla con `createRemoteJWKSet` + `jwtVerify`.

Es la primera dependencia fuera de `AGENTS.md §2`, y el escape hatch que la propia regla prevé es
justificarla aquí (`AGENTS.md §2` y `§6.7`). La justificación es que Cloudflare documenta
literalmente este patrón como ejemplo oficial para Workers, y que la parte delicada —búsqueda del
`kid`, caché del JWKS con respecto a la rotación de claves, y los límites de `exp`/`nbf`— es
precisamente la que no conviene reescribir a mano en un proyecto que se enseña en GitHub.

- **Alternativa A: WebCrypto a mano.** Cero dependencias, pero obliga a escribir el parseo del JWT, la
  importación del JWK, la comprobación de `alg` para evitar confusión de algoritmos, la caché y sus
  límites. Más código que revisar y mantener a cambio de nada que Cloudflare ya resuelva.
- **Alternativa B: guardar la clave pública como secreto y verificar sin JWKS.** Descartada de
  entrada: contradice la recomendación de Cloudflare de validar contra el endpoint externo y obliga a
  rotar un secreto cada 6 semanas a mano.
- **Build de `jose` que se usa:** el de `dist/webapi`, el que resuelven los Workers. Usa WebCrypto,
  no tiene dependencias, es `sideEffects: false` y tiene licencia MIT.

Coste: `jose` entra en el bundle del Worker, no en el de la SPA (el front solo importa el **tipo**
`AppType`, que se borra al compilar), así que no afecta al peso de la descarga del cliente.

### 2. Verificación: firma, audiencia, emisor y expiración, en ese orden

`jwtVerify` se llama con `issuer: https://${ACCESS_TEAM_DOMAIN}`, `audience: ACCESS_AUD`,
`algorithms: ["RS256"]` y las opciones de tiempo por defecto (`exp` obligatorio, `nbf` comprobado).
Fijar `algorithms` no es opcional: sin ello, un token que diga `HS256` sería validado con la clave
pública como si fuera una clave simétrica. Cualquier excepción se convierte en el mismo `401`.

El `code` del error es `unauthorized` en minúsculas, siguiendo lo que ya hace `errors.ts`
(`not_found`, `internal_error`, `method_not_allowed`). El mensaje es uno solo y no dice el motivo.

### 3. El atajo local: dos condiciones, y por qué dos

**Decisión:** el atajo se activa **solo** si `env.ACCESS_DEV_BYPASS === "1"` **y**
`new URL(c.req.url).hostname` es `localhost`, `127.0.0.1` o `[::1]`. Si la variable está activa pero
el hostname **no** es local, se deniega con el `401` normal y se escribe un `console.warn`: es la
señal de que alguien ha subido la variable a un despliegue.

`ACCESS_DEV_BYPASS` se tipa a mano como **opcional** (`ACCESS_DEV_BYPASS?: string`) en
`worker/env.d.ts`, ampliando `Cloudflare.Env`. No puede salir de `wrangler types`, porque ese comando
lee el `.dev.vars` de cada equipo y el tipo cambiaría según la máquina. Además, declararla opcional
refleja la realidad: en producción no existe.

`ACCESS_DEV_BYPASS` se documenta en `.dev.vars.example` pero **no** se declara en `wrangler.jsonc`, de
modo que no existe en ningún despliegue salvo que alguien lo suba a propósito como secreto. La
segunda condición es la red de seguridad: aunque alguien lo suba por error, en producción el hostname
es `nexus.juanmazh-dev.workers.dev` y la comprobación seguiría denegando. Con las dos, hace falta un
error humano **y** un entorno no local para abrir la puerta.

Es un compromiso explícito, no accidental: se pierde parte de la garantía de fail closed en local a
cambio de poder desarrollar sin montar un Access real. Se revisa con `add-app-shell`: si para
entonces se puede desarrollar cómodamente contra una preview protegida por Access, este atajo es lo
primero que debería retirarse.

- **Alternativa: detectar el entorno con `env.ENVIRONMENT === "development"`.** Descartada: una variable
  de entorno en producción es un error de configuración esperando a ocurrir, mientras que
  `.dev.vars` **por definición** no se despliega.
- **Alternativa: no tener atajo.** Descartada por decisión del dueño: obliga a probar las rutas
  autenticadas solo contra un Access real, lo que hace el ciclo de desarrollo mucho más lento.

Cuando el atajo está activo, `/api/me` devuelve un email ficticio (`local@nexus.test`), que es dato de
ejemplo permitido por `AGENTS.md §6.5`, y la respuesta incluye `X-Nexus-Session: development` para que
se note en las herramientas del navegador. Cada uso del atajo escribe un `console.warn`: es el único
`console` del Worker y está justificado, porque avisa de la única condición en la que no se está
verificando nada.

### 4. Cabeceras de seguridad en dos sitios

**Decisión:** dos listas, porque Cloudflare solo las aplica en un sitio cada vez (ver `Context`):

| Dónde | Cómo | Contenido |
|---|---|---|
| `/api/*` | middleware de Hono en `worker/middleware/security-headers.ts` | `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `X-Frame-Options: DENY` |
| SPA y assets | `public/_headers`, copiado por Vite a `dist/client` | `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Content-Security-Policy` para la app, `X-Frame-Options: DENY` |

- **La CSP de la SPA no puede ser `default-src 'none'`**: la app necesita sus scripts, estilos y
  fuentes. Se propone `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none';
  form-action 'self'; img-src 'self' data:` con `style-src 'self' 'unsafe-inline'`, porque shadcn/Tailwind
  inyectan estilos en línea y React usa atributos `style`; sin ese permiso, los estilos se pierden y
  la página sale sin maquetar. `'unsafe-inline'` solo en `style-src`, nunca en `script-src`.
- **Alternativa: meter `/` en `run_worker_first` y que el Worker sirva el HTML.** Descartada: quitaría
  la garantía de `bootstrap-project` de que las navegaciones no invocan al Worker, y gastaría
  invocaciones del plan gratuito en cada carga de página. El fichero `_headers` hace lo mismo sin
  coste.
- **Alternativa: cabeceras solo en la API.** Descartada: `AGENTS.md §6.6` no distingue, y la CSP es la
  que protege de verdad al único sitio donde habrá contenido de terceros algún día: el HTML.
- **HSTS se deja fuera**: el dominio cambia en fase 3 y una cabecera de HSTS mal puesta en un hostname
  temporal no se puede quitar fácilmente del navegador. Se decide con `move-to-custom-domain`.

### 5. `ACCESS_TEAM_DOMAIN` sin esquema

`ACCESS_TEAM_DOMAIN` se guarda **sin** `https://` (`juanmazh.cloudflareaccess.com`), porque es el
formato que ya usan `.dev.vars.example` y la tabla de secretos de `docs/ARCHITECTURE.md §5`. El código
construye `https://${...}` **una sola vez**, al configurar el JWKS, y lo reutiliza como `issuer`. Si se
guardara con esquema, compararlo contra `iss` exigiría normalizar los dos lados y es la clase de bug
que produce denegaciones fantasma tras un despliegue.

### 6. Sin esquema de datos

No hay tablas, ni columnas, ni índices, ni migración: `/api/me` lee el token, no D1. `pnpm db:generate`
no debe seguir generando nada (mismo criterio que la tarea 9.3 de `bootstrap-project`).

### 7. Separación de responsabilidades

El middleware de Hono se queda **delgado**: lee la cabecera, decide si aplica el atajo local, llama al
verificador, guarda el principal en el contexto y devuelve el `401`. Eso es capa HTTP y va en
`worker/middleware/access.ts`, junto a `errors.ts`.

La verificación del token va en `worker/services/access-token.ts`, con la firma
`verifyAccessToken(token, { getKey, issuer, audience })`, que devuelve el email o `null` y **no
conoce Hono, `Request` ni `env`**. El resolvedor de claves (`getKey`, un `JWTVerifyGetKey` de jose)
se recibe como parámetro:

- **Producción:** `worker/services/access-jwks.ts` exporta `getAccessJwks(teamDomain)`, que crea
  `createRemoteJWKSet(new URL("https://<teamDomain>/cdn-cgi/access/certs"))` **una vez por dominio** y
  lo guarda en un `Map` a nivel de módulo. Así la caché de jose sobrevive entre peticiones del mismo
  isolate. La caché y el refetch ante un `kid` desconocido son los de jose por defecto; no se
  reimplementan ni se testean, porque eso sería testear la librería.
- **Tests:** `createLocalJWKSet` con un JWKS generado en el test. Sin red, sin `fetchMock` y
  determinista. La rotación de claves se prueba con un JWKS local que contiene la clave anterior y la
  nueva (se acepta) y con otro sin la clave retirada (se deniega).

Para que los tests de integración usen ese mismo resolvedor, `worker/app.ts` exporta
`createApp(deps?: { getKey?: (teamDomain: string) => JWTVerifyGetKey })`. Por defecto `getKey` es
`getAccessJwks`, y `index.ts` usa `createApp()`. `AppType` se deriva de las rutas de `createApp`, así
que el cliente RPC no cambia.

**Los tests controlan siempre su `env`:** las peticiones se hacen con
`app.fetch(request, testEnv)`, donde `testEnv` es un objeto explícito
(`ACCESS_AUD: "test-aud"`, `ACCESS_TEAM_DOMAIN: "test.cloudflareaccess.com"`, sin
`ACCESS_DEV_BYPASS` salvo en los tests del atajo), y por defecto con el host
`https://nexus.test`, no `localhost`. Así ningún `.dev.vars` local cambia el resultado.

**Sin configuración se deniega:** si falta `ACCESS_AUD` o `ACCESS_TEAM_DOMAIN`, el middleware
responde el mismo `401`, nunca deja pasar la petición y nunca lanza un error sin controlar.

No hay `services/` de negocio en este cambio: no hay dominio que extraer todavía. El middleware publica
el principal con `c.set("user", { email })` y `GET /api/me` solo lo lee.

## Migration Plan

1. `pnpm add jose` (añade la dependencia y el lockfile).
2. `ACCESS_TEAM_DOMAIN` a `wrangler.jsonc`; `ACCESS_AUD` con `pnpm wrangler secret put ACCESS_AUD`
   (**solo la persona propietaria**).
3. `pnpm cf-typegen` para que `worker-configuration.d.ts` recoja las variables nuevas.
4. Tests en verde y `pnpm build`.
5. `pnpm deploy` (**solo la persona propietaria**) y comprobación en el despliegue: `/api/health`
   sigue en `200` sin sesión, `/api/me` devuelve `401` sin sesión y `200` con la sesión del navegador.
6. Revisión de PR y merge.

**Reversión:** el cambio es reversible quitando el middleware de `app.ts`; no hay migración que
deshacer ni esquema que revertir. Lo único que no se deshace solo es el secreto `ACCESS_AUD`, que se
puede dejar puesto sin efecto. La CSP se revierte borrando `public/_headers` y el middleware de
cabeceras.

**Orden de despliegue:** las cabeceras y `/api/me` son inocuas; el único cambio con riesgo de dejarte
fuera es el middleware. Por eso `ACCESS_AUD` se pone **antes** del primer deploy con el middleware
montado, y el despliegue se verifica con las dos rutas a mano.

## Coste en el plan gratuito

| Recurso | Consumo |
|---|---|
| Filas leídas / escritas en D1 | 0. Ni el middleware ni `/api/me` tocan la base de datos. |
| Queries por petición | 0. |
| Subpeticiones por invocación | 0 en el caso habitual: el JWKS se descarga **una vez por isolate** y `createRemoteJWKSet` lo cachea. Solo los isolates recién creados hacen 1 `fetch`. Lejos de 50. |
| CPU por invocación | Una verificación RS256. Muy por debajo de 10 ms. |
| Peticiones al Worker | Sin cambio: `/api/*` ya lo atendía el Worker. Los assets siguen sin invocar al Worker. |
| Coste | 0 €. |

Aislates nuevos: pasan a existir tras un redeploy o un eviction; la rotación de claves (cada 6 semanas) provoca
alguna descarga extra puntual. Ninguna de las dos cosas se acerca a un límite.

## ADR

- **ADR-002** (Access) queda confirmado y se le añade que la validación del JWT es **en el Worker** y
  que Access **no** es la única barrera.
- **Entrada nueva propuesta, ADR-009 · "Atajo de autenticación solo en local, con doble condición"**:
  merece registro porque es la única decisión de este cambio que relaja conscientemente una garantía de
  seguridad, y porque las condiciones concretas (`.dev.vars` **y** hostname local) son lo que la hace
  aceptable. Sin ese ADR, dentro de seis meses el atajo parece un accidente.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| El atajo local se cuela en producción | Doble condición: variable que solo existe en `.dev.vars` **y** hostname local. En producción el hostname nunca es local. Se anota como deuda a retirar con `add-app-shell`. |
| Rotación de claves y cacheo del JWKS | `createRemoteJWKSet` refetch ante una clave desconocida, y Cloudflare publica la clave anterior 7 días. Un isolate que sobrevive con una clave antigua sigue aceptando tokens de la nueva. Especificado en `specs/access-auth`. |
| `ACCESS_AUD` equivocado en el primer deploy | Se revisa contra el AUD tag de la aplicación de Access **antes** de desplegar, y el paso 5 del plan verifica `/api/me` en el despliegue real. Un `aud` incorrecto da `401` en todas partes, que es un síntoma obvio, no silencioso. |
| CSP demasiado restrictiva y pantalla en blanco | `style-src` lleva `'unsafe-inline'` desde el principio, y las fuentes son self-hosted. La tarea de verificación mira la consola del navegador en una preview, no solo que las cabeceras estén. |
| `_headers` no se aplica al `index.html` de la SPA fallback | Se verifica contra una preview real, no en local. Si no se aplicara, la alternativa (servir el HTML desde el Worker) tiene coste en invocaciones y se documenta como plan B en `design.md` §4. |
| Los tests del Worker pasan a necesitar tokens firmados | Keypair RSA generado en el test con `jose` y resolvedor inyectado con `createLocalJWKSet` (§7). Sin red, determinista y sin claves reales en el repo. |
| Un `.dev.vars` local cambia el resultado de los tests | Los tests pasan su `env` explícito y usan un host no local (§7). |
| `401` en vez de `404` rompe algo que hoy "funciona" | Solo existe `/api/health`, que queda exento, y su spec lo cubre. El cambio de comportamiento se spec de forma explícita en `api-health`. |
| El bundle del Worker crece con `jose` | Solo afecta al Worker. El bundle de la SPA no lo incluye (el front importa un tipo). Se comprueba el tamaño en la tarea de build. |

## Open Questions

Ninguna que afecte a las specs, al enfoque o al desglose de tareas. La decisión de si el atajo local
sobrevive a `add-app-shell` se puede tomar sin cambiar nada de lo que este cambio construye.