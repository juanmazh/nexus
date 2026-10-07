# Tasks

## 1. Dependencia y configuración

- [ ] 1.1 Instalar `jose` como dependencia de producción con `pnpm add jose`; verificar que
  `package.json` la declara, que `pnpm install` termina sin avisos de peer dependency y que
  `pnpm typecheck` sigue devolviendo `0`.
- [ ] 1.2 Añadir `ACCESS_TEAM_DOMAIN` (sin esquema: `juanmazh.cloudflareaccess.com`) a `vars` de
  `wrangler.jsonc` y ejecutar `pnpm cf-typegen`; verificar que `worker-configuration.d.ts` declara
  `ACCESS_TEAM_DOMAIN` y que `pnpm typecheck` sigue en `0`.
- [ ] 1.3 Documentar `ACCESS_DEV_BYPASS` **comentado y sin valor** en `.dev.vars.example`, con una línea
  que explique que solo sirve en local y que nunca se despliega; verificar que
  `git grep -iE "(token|secret|password|bypass)\s*[:=]\s*['\"][^'\"]{8}"` no encuentra ningún valor.

## 2. Verificación del token

- [ ] 2.1 Crear `worker/services/access-token.ts` con `verifyAccessToken(token, { getKey, issuer, audience })`,
  que devuelva el email del principal o `null`, usando `jwtVerify` con `algorithms: ["RS256"]`; que
  **no** importe nada de Hono ni lea `env`. Crear `worker/services/access-jwks.ts` con
  `getAccessJwks(teamDomain)` memoizado en un `Map` de módulo (ver `design.md §7`). Verificar que
  `pnpm typecheck` lo acepta dentro de `tsconfig.worker.json`.
- [ ] 2.2 Escribir `worker/services/access-token.test.ts` generando en el test un keypair RSA con `jose`
  y cubriendo: token válido devuelve el email; firma inválida, `aud` incorrecto, `iss` incorrecto,
  expirado, `nbf` en el futuro y token con estructura ilegible devuelven `null`. Verificar con
  `pnpm test` que solo este test pasa en verde.
- [ ] 2.3 Probar la rotación con `createLocalJWKSet`: un JWKS con la clave anterior y la nueva acepta
  tokens firmados con cualquiera de las dos, y un JWKS sin la clave retirada deniega los tokens firmados
  con ella. Probar que `getAccessJwks` devuelve la **misma instancia** para el mismo dominio. **No** se
  usa `fetchMock`, que no existe en `@cloudflare/vitest-plugin` 1.3.7.

## 3. Middleware de Access

- [ ] 3.0 Crear `worker/env.d.ts` que amplíe `Cloudflare.Env` con `ACCESS_DEV_BYPASS?: string`, y
  convertir `worker/app.ts` en `createApp(deps?)` (con `getKey` inyectable) más `index.ts` usando
  `createApp()`, manteniendo `AppType`. Migrar los tests existentes a `app.fetch(request, testEnv)`
  con un `env` explícito y el host `https://nexus.test`. Verificar con `pnpm typecheck && pnpm test`.
- [ ] 3.1 Crear `worker/middleware/access.ts`, delgado: lee `Cf-Access-Jwt-Assertion`, aplica el atajo
  local solo si `ACCESS_DEV_BYPASS === "1"` **y** `new URL(c.req.url).hostname` es local (si la variable
  está activa con un host no local: `401` y `console.warn`), deniega si falta `ACCESS_AUD` o
  `ACCESS_TEAM_DOMAIN`, llama a `verifyAccessToken`, guarda
  `c.set("user", { email })` y responde `401` con `{ error: { code: "unauthorized", message } }` ante
  cualquier fallo, sin filtrar el motivo. Verificar con tests unitarios del middleware.
- [ ] 3.2 Montar el middleware en `worker/app.ts` sobre `*` **excluyendo `GET /api/health`**, y verificar
  con tests de integración que: `/api/health` sigue en `200` sin cabecera, una ruta `/api/*` sin
  cabecera devuelve `401` y una ruta inexistente **con** token válido devuelve `404`.
- [ ] 3.3 **Actualizar el test existente** `worker/routes/health.test.ts` de "unknown API route → 404",
  que ahora necesita un token válido para seguir esperando `404`, y añadir los casos `401` sin cabecera y
  `401` con token inválido; verificar que el proyecto `worker` de Vitest pasa en verde.

## 4. `GET /api/me`

- [ ] 4.1 Crear `worker/routes/me.ts` con `GET /` que devuelve `200 { user: { email } }` leyendo el
  principal del contexto, con el mismo patrón de `405` + `Allow: GET` que usa `health.ts`; montarlo en
  `app.ts` dentro de la cadena de rutas. Verificar con tests: con token válido devuelve el email del
  token, sin token devuelve `401`, con `POST` devuelve `405`, y con token válido **sin** email devuelve
  `401`.
- [ ] 4.2 Verificar que el tipo de la respuesta se deriva con `InferResponseType` desde `AppType` y que el
  cliente RPC del front expone `client.api.me.$get()` sin tocar `src/`: comprobar con `pnpm typecheck`.

## 5. Cabeceras de seguridad

- [ ] 5.1 Crear `worker/middleware/security-headers.ts` y montarlo en `app.ts` para que **toda** respuesta
  de `/api/*` incluya `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `X-Frame-Options: DENY` y una `Content-Security-Policy` restrictiva; verificar con tests que las
  cabeceras aparecen en respuestas `200`, `401`, `404`, `405` y `500`.
- [ ] 5.2 Crear `public/_headers` con la CSP de la SPA (`default-src 'self'`, `style-src` con
  `'unsafe-inline'`, `frame-ancestors 'none'`), `nosniff`, `Referrer-Policy: no-referrer` y
  `X-Frame-Options: DENY`; verificar que `pnpm build` lo copia a `dist/client/_headers` y que su
  contenido es el esperado.
- [ ] 5.3 Levantar `pnpm build` y después `pnpm wrangler dev` para comprobar contra el gestor de assets
  real (no el servidor de Vite) que `/` y un asset JS llevan las cabeceras, y que `/api/health` lleva
  las suyas; verificar las cuatro cabeceras en las respuestas. Si el `curl` está bloqueado en el
  entorno, hacerlo con el equivalente disponible.

## 6. Documentación

- [ ] 6.1 Actualizar `docs/ARCHITECTURE.md`: §2.3 con `ACCESS_TEAM_DOMAIN` en `vars` y
  `ACCESS_DEV_BYPASS` anotado como solo local; §3.1 con el `code: "unauthorized"` en minúsculas y con
  el hecho de que el `401` precede al enrutado; y añadir la entrada **ADR-009 · Atajo de
  autenticación solo en local, con doble condición**. Verificar que no queda ningún `code` de error en
  mayúsculas en el documento.
- [ ] 6.2 Actualizar `docs/PROGRESS.md` con el cambio 0.2 y el siguiente paso exacto, y `README.md` con
  la nota de que `/api/*` exige sesión y el atajo local; verificar que los pasos manuales de
  `wrangler secret put` y `pnpm deploy` quedan listados como pasos de la persona propietaria.
- [ ] 6.3 Revisar `AGENTS.md §6` para que la excepción de `/api/health` y la ubicación de las cabeceras
  de seguridad sigan siendo ciertas con el código ya escrito; verificar con `git diff` que no hay
  contradicciones.

## 7. Verificación final

- [ ] 7.1 Ejecutar `pnpm typecheck && pnpm lint && pnpm test && pnpm build` y dejar constancia del
  resultado; verificar que los cuatro terminan en `0` y que el bundle del **cliente** no ha crecido
  (porque `jose` solo entra en el Worker).
- [ ] 7.2 Ejecutar `pnpm db:generate` y verificar que sigue sin generarse ningún fichero `.sql` en
  `migrations/`, confirmando que este cambio no toca el esquema.
- [ ] 7.3 Ejecutar `openspec validate add-access-auth --strict` y verificar que pasa sin errores.
- [ ] 7.4 Comprobar la definición de hecho de `AGENTS.md §9`, anotando que el punto de `test:e2e` no
  aplica en este cambio porque la UI no existe todavía (llega con `add-app-shell`) y que no hay
  migración que aplicar; verificar cada punto de la lista.

## Workflow follow-up

Pasos que no puede hacer el agente porque los ejecuta la persona propietaria del proyecto:

- Copiar el **AUD tag** de la aplicación de Access del Worker (Zero Trust → Access → Applications) →
  `pnpm wrangler secret put ACCESS_AUD`.
- `pnpm deploy` y comprobar en el despliegue real que `GET /api/health` sigue en `200` sin sesión,
  `GET /api/me` da `401` sin sesión y `200` con la sesión del navegador, y que la SPA carga sin
  violaciones de CSP en la consola.
- Comprobar que la CSP se aplica también al `index.html` de la preview desplegada (en `pnpm dev` la
  sirve Vite, no el gestor de assets).
- Descripción del PR con el resultado de la verificación y merge a `main`.
- Archivar el cambio con `/opsx-archive` una vez revisado y mergeado.