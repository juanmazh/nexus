# Arquitectura — Nexus

> Documento vivo. Se actualiza cuando un cambio de OpenSpec modifica la arquitectura o una decisión.
> El comportamiento detallado de cada funcionalidad vive en `openspec/specs/`, no aquí.

---

## 1. Visión general

Nexus es **un único Cloudflare Worker** que sirve tres cosas:

1. La **SPA de React** (static assets: gratis e ilimitados, no cuentan como peticiones al Worker).
2. La **API** bajo `/api/*` (Hono).
3. Un **job programado** (Cron Trigger) que envía los recordatorios por Telegram.

```text
                         Navegador / móvil
                                │  HTTPS
                                ▼
                  ┌───────────────────────────┐
                  │   Cloudflare Access       │  ← login (código por email / Google)
                  │   (Zero Trust, plan free) │     antes de llegar al Worker
                  └─────────────┬─────────────┘
                                │  + cabecera Cf-Access-Jwt-Assertion
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│                       Worker "nexus"                              │
│                                                                   │
│  /*        → static assets (SPA React, fallback a index.html)     │
│  /api/*    → Hono ─► middleware access (valida JWT)               │
│                     ─► routes/<feature> (HTTP + Zod)              │
│                     ─► services/<feature> (negocio)               │
│                     ─► Drizzle ─► D1                              │
│                                                                   │
│  scheduled (*/5 * * * *) → jobs/reminders ─► D1                   │
│                                            ─► Telegram Bot API    │
└───────────────────────────────────────────────────────────────────┘
          │                                   │
          ▼                                   ▼
   Cloudflare D1 (SQLite)             api.telegram.org
   BD "nexus-db"                      (fetch saliente)
```

**Fase 3 (blog):** se añade un dominio propio. `/blog/*` pasa a ser público (renderizado en el Worker)
y Access protege solo `/admin/*` y `/api/*` mediante una aplicación de Access por ruta sobre el dominio.

---

## 2. Componentes

### 2.1 Worker (backend)

| Pieza | Responsabilidad |
|---|---|
| `worker/index.ts` | Exporta `fetch` (la app Hono) y `scheduled` (despacha jobs del cron) |
| `worker/app.ts` | Middlewares globales (errores, cabeceras de seguridad, access), monta rutas y exporta `AppType` |
| `middleware/access.ts` | Valida el JWT de Access: firma (claves del equipo), `aud`, `iss`, `exp`. Cachea las claves públicas |
| `routes/*` | Capa HTTP: valida con Zod, llama al servicio, serializa la respuesta |
| `services/*` | Lógica de negocio. Recibe `db` y datos ya validados. Testeable sin HTTP |
| `db/schema.ts` | Esquema Drizzle: fuente única del modelo de datos |
| `jobs/reminders.ts` | Selecciona recordatorios vencidos, los envía y registra el resultado |
| `integrations/telegram.ts` | Cliente mínimo de `sendMessage` de la Bot API |

### 2.2 SPA (frontend)

| Pieza | Responsabilidad |
|---|---|
| `src/app/` | Router, `QueryClientProvider`, layout (navegación móvil y escritorio) |
| `src/lib/api.ts` | Cliente `hc<AppType>('/')`: llamadas tipadas de extremo a extremo sin generar código |
| `src/features/*` | Una carpeta por feature con sus componentes, hooks de TanStack Query y tipos |
| `src/components/ui/` | Componentes de shadcn/ui |

### 2.3 Configuración del Worker (`wrangler.jsonc`)

Refleja la configuración real del andamiaje. Los bloques que aún no existen se marcan con `TODO`.

```jsonc
{
  "name": "nexus",
  "main": "./worker/index.ts",
  "compatibility_date": "<fecha de la fase 0>",
  "assets": {
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "nexus-db",
      "migrations_dir": "migrations",
      // TODO(setup): sustituye este UUID por el que devuelva
      //   pnpm wrangler d1 create nexus-db
      "database_id": "00000000-0000-0000-0000-000000000000"
    }
  ],
  // TODO(add-reminders): el cron único "*/5 * * * *" se añade con ese cambio.
  //   Sin jobs, un cron ocuparía uno de los 5 Cron Triggers de la cuenta sin hacer nada.
  "vars": {
    "APP_TIMEZONE": "Europe/Madrid",
    // Dominio del equipo de Zero Trust, SIN esquema. No es un secreto.
    "ACCESS_TEAM_DOMAIN": "<equipo>.cloudflareaccess.com"
  }
  // Secretos (wrangler secret put): ACCESS_AUD, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
}
```

`ACCESS_DEV_BYPASS` **no está aquí a propósito**: es el atajo de desarrollo local y solo
existe en `.dev.vars` (ver [ADR-009](#adr-009--atajo-de-autenticación-solo-en-local-con-doble-condición)).
El Worker la lee como opcional (`worker/env.d.ts`).

---

## 3. Flujos clave

### 3.1 Petición autenticada a la API

1. El navegador pide `/api/tasks`. Access comprueba la sesión; si no hay, redirige al login de Access.
2. Con sesión válida, Access reenvía la petición al Worker con la cabecera `Cf-Access-Jwt-Assertion`.
3. `middleware/security-headers.ts` añade las cabeceras de seguridad a la respuesta.
4. `middleware/access.ts` verifica el JWT (firma RS256 contra el JWKS del equipo, `aud`,
   `iss` y expiración). El `401` ocurre **antes** del enrutado, así que una petición sin
   sesión válida recibe `401` incluso si la ruta no existe, y el manejador nunca se ejecuta.
   Si falla → `401` con `{ "error": { "code": "unauthorized", "message": ... } }`, siempre el
   mismo mensaje para no revelar el motivo.
5. La ruta valida la entrada con Zod → el servicio ejecuta la lógica → Drizzle consulta D1.
6. El front recibe la respuesta tipada a través del cliente RPC y TanStack Query la cachea.

Única excepción a la sesión obligatoria: `GET /api/health`, que no devuelve ningún dato y
sirve de comprobación de vida para un monitor sin credenciales.

**¿Por qué validar el JWT si Access ya protege el Worker?** Defensa en profundidad: si alguien
desactiva Access por error, o aparece un hostname nuevo sin cubrir, el Worker sigue denegando.

### 3.2 Cabeceras de seguridad

Hay dos listas porque Cloudflare solo las aplica en un sitio cada vez:

| Dónde | Cómo | Contenido |
|---|---|---|
| `/api/*` | `worker/middleware/security-headers.ts` (middleware de Hono) | `nosniff`, `no-referrer`, `X-Frame-Options: DENY`, CSP `default-src 'none'; frame-ancestors 'none'` |
| SPA y assets | `public/_headers` (copiado por Vite a `dist/client`) | `nosniff`, `no-referrer`, `X-Frame-Options: DENY`, CSP `default-src 'self'; …; style-src 'self' 'unsafe-inline'` |

`'unsafe-inline'` está **solo** en `style-src`: Tailwind y la librería de componentes aplican
estilos en línea. Nunca en `script-src`. HSTS se decide en `move-to-custom-domain` (fase 3).

### 3.3 Envío de recordatorios (cron)

1. Cada 5 minutos (UTC) se ejecuta `scheduled()` → `jobs/reminders.run(env)`.
2. Una sola query trae como máximo **N = 20** recordatorios con `status = 'pending' AND remind_at <= now`, ordenados por `remind_at`.
3. Por cada uno: llamada a Telegram (`sendMessage`, hora formateada en Europe/Madrid).
4. Los resultados se guardan en **un único `db.batch()`**: `sent` + `sent_at`, o `attempts + 1` y `last_error`. Tras **3 intentos** fallidos → `failed`.
5. Presupuesto por invocación: 1 query de lectura + ≤ 20 fetch + 1 batch de escritura ≈ 22 subpeticiones (< 50).

Semántica: **al menos una vez**. Si Telegram acepta un mensaje pero falla la escritura en D1, ese
recordatorio podría reenviarse en la siguiente ejecución. Es aceptable para una app personal; un
duplicado es mejor que un aviso perdido.

---

## 4. Modelo de datos (MVP)

> La fuente de verdad es `worker/db/schema.ts`. Esta tabla es una guía para diseñar los cambios.

### `tasks`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text PK | `crypto.randomUUID()` |
| `title` | text NOT NULL | 1–200 caracteres |
| `notes` | text | opcional, Markdown simple |
| `status` | text NOT NULL | `todo` \| `done` (default `todo`) |
| `priority` | text NOT NULL | `low` \| `medium` \| `high` (default `medium`) |
| `due_at` | integer | epoch ms UTC, opcional |
| `completed_at` | integer | epoch ms UTC, se rellena al pasar a `done` |
| `created_at` / `updated_at` | integer NOT NULL | epoch ms UTC |

Índices: `(status, due_at)`.

### `reminders`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text PK | |
| `task_id` | text NOT NULL | FK → `tasks.id`, `ON DELETE CASCADE` |
| `remind_at` | integer NOT NULL | epoch ms UTC |
| `channel` | text NOT NULL | `telegram` (en fase 3 se añade `email`) |
| `status` | text NOT NULL | `pending` \| `sent` \| `failed` \| `cancelled` |
| `attempts` | integer NOT NULL | default 0 |
| `last_error` | text | último error de envío, truncado |
| `sent_at` | integer | epoch ms UTC |
| `created_at` | integer NOT NULL | |

Índices: `(status, remind_at)`. Es el índice que usa el cron: la consulta lee pocas filas aunque la tabla crezca.

Reglas de negocio iniciales:
- Completar una tarea **cancela** sus recordatorios pendientes.
- No se puede crear un recordatorio con `remind_at` en el pasado.
- Borrar una tarea borra sus recordatorios (cascade).

---

## 5. Entornos y secretos

| Entorno | Dónde | BD | Auth |
|---|---|---|---|
| Local | `pnpm dev` | D1 local (`.wrangler/`) | `ACCESS_DEV_BYPASS=1` en `.dev.vars` + petición desde `localhost` (ADR-009); en los tests, un token firmado en el propio test |
| Producción | `nexus.<subdominio>.workers.dev` (fase 3: dominio propio) | D1 `nexus-db` | Cloudflare Access + validación del JWT en el Worker |

| Secreto | Uso | Dónde vive |
|---|---|---|
| `ACCESS_AUD` | Audience de la aplicación de Access | `wrangler secret put` / `.dev.vars` |
| `TELEGRAM_BOT_TOKEN` | Token del bot (BotFather) | `wrangler secret put` / `.dev.vars` |
| `TELEGRAM_CHAT_ID` | Tu chat con el bot | `wrangler secret put` / `.dev.vars` |
| `CLOUDFLARE_API_TOKEN` | Despliegue desde GitHub Actions | Secrets del repo en GitHub |

`ACCESS_TEAM_DOMAIN` y `APP_TIMEZONE` no son secretos: viven en `vars` de `wrangler.jsonc`
(§2.3). `ACCESS_DEV_BYPASS` tampoco se despliega nunca: solo existe en `.dev.vars`.

---

## 6. Registro de decisiones (ADR)

Formato corto: **contexto → decisión → consecuencias**. Las decisiones nuevas se proponen en el
`design.md` de un cambio y se copian aquí al archivarlo.

### ADR-001 · Un único Worker con static assets (en vez de Pages + Worker)
- **Contexto:** hace falta servir una SPA y una API.
- **Decisión:** un solo Worker con `assets` y `run_worker_first: ["/api/*"]`.
- **Consecuencias:** un despliegue, sin CORS, bindings en un solo sitio. Los assets estáticos son gratis e ilimitados.

### ADR-002 · Cloudflare Access en vez de autenticación propia
- **Contexto:** app de un solo usuario; un login casero (hash, sesiones, CSRF, fuerza bruta) es superficie de ataque.
- **Decisión:** Access delante del Worker (plan free, hasta 50 usuarios) + validación del JWT en el Worker.
- **Consecuencias:** cero código de credenciales. Dependencia de Cloudflare para el login (aceptable). La validación del JWT ocurre **dentro** del Worker, así que Access no es la única barrera: si se desactiva o queda un hostname sin cubrir, el Worker sigue denegando.

### ADR-003 · D1 + Drizzle
- **Contexto:** datos relacionales pequeños; hace falta tipado y migraciones versionadas.
- **Decisión:** D1 (SQLite) con Drizzle ORM; migraciones generadas por drizzle-kit y aplicadas con wrangler.
- **Consecuencias:** tipos derivados del esquema. Límite de 500 MB por BD en el plan free, de sobra para el uso previsto.

### ADR-004 · Telegram como canal de avisos del MVP
- **Contexto:** el envío de email gratis en Cloudflare exige dominio propio (Email Routing) y solo a destinos verificados.
- **Decisión:** bot de Telegram vía `fetch`. El email se valora en la fase 3, cuando haya dominio.
- **Consecuencias:** notificaciones instantáneas en el móvil, sin dominio y sin coste.

### ADR-005 · Un único Cron Trigger cada 5 minutos
- **Contexto:** el plan free permite 5 cron triggers por cuenta y 10 ms de CPU por invocación.
- **Decisión:** un solo cron `*/5 * * * *` que despacha a los jobs; lotes de 20 como máximo.
- **Consecuencias:** precisión de avisos de ±5 minutos (aceptable). Quedan 4 crons libres para otros proyectos.

### ADR-006 · Fechas en UTC (epoch ms) y presentación en Europe/Madrid
- **Contexto:** los crons corren en UTC y existe el cambio de horario de verano.
- **Decisión:** se almacena siempre en UTC; se convierte solo al mostrar o al formatear mensajes.
- **Consecuencias:** comparaciones triviales en SQL; los cambios de hora no rompen nada.

### ADR-007 · Cliente RPC de Hono para tipar la API de extremo a extremo
- **Contexto:** duplicar tipos entre front y back provoca desincronización.
- **Decisión:** `hc<AppType>` en el front; los schemas Zod viven en `shared/`.
- **Consecuencias:** un cambio en la API rompe el `typecheck` del front al momento, que es justo lo que se busca.

### ADR-008 · Mobile-first verificado automáticamente
- **Contexto:** el móvil es el dispositivo principal de Nexus; "ya lo miraré en el móvil" acaba en layouts rotos que nadie detecta.
- **Decisión:** reglas de diseño obligatorias en `docs/DESIGN.md`, un shell propio (`add-app-shell`) antes de la primera funcionalidad, PWA en la fase 1 y Playwright en la CI con proyectos móvil (360 px) y escritorio.
- **Consecuencias:** una dependencia de desarrollo más (Playwright, solo Chromium en CI) y CI algo más lenta, a cambio de que una regresión responsive rompa la CI en lugar de llegar a producción.

### ADR-009 · Atajo de autenticación solo en local, con doble condición
- **Contexto:** con Access delante, `pnpm dev` no puede llamar a `/api/*` sin montar una aplicación de Access real, y probar las rutas autenticadas solo así vuelve el ciclo de desarrollo muy lento.
- **Decisión:** `ACCESS_DEV_BYPASS=1` permite saltarse la verificación, **solo** si además la petición viene de `localhost`, `127.0.0.1` o `[::1]`. La variable solo existe en `.dev.vars` y no se declara en `wrangler.jsonc`; si se cuela en un despliegue, la comprobación del hostname sigue denegando y escribe un `console.warn`.
- **Consecuencias:** se relaja conscientemente la garantía de *fail closed* **en local**, a cambio de poder desarrollar sin Access. Abrir la puerta requiere un error humano **y** un entorno no local. Cada uso del atajo escribe un aviso y la respuesta lleva `X-Nexus-Session: development`. Deuda a revisar con `add-app-shell`: si para entonces se puede desarrollar cómodamente contra una preview protegida por Access, el atajo es lo primero que debería retirarse.
