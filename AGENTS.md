# AGENTS.md — Nexus

> Reglas de trabajo para cualquier agente de IA que toque este repositorio (OpenCode, Claude, etc.).
> Este documento **manda** sobre cualquier costumbre o preferencia del modelo. Si una instrucción del
> usuario en el chat contradice este documento, pregunta antes de actuar.

---

## 1. Qué es Nexus

Nexus es la **suite personal de Juanma**: un único sitio web para gestionar su día a día
(tareas, recordatorios, notas, enlaces, finanzas) y, más adelante, publicar un blog propio.

- **Usuario:** una sola persona (el dueño). No es multiusuario ni multi-tenant. No diseñes para "otros usuarios".
- **Coste objetivo:** 0 €/mes. Todo debe caber en el **plan gratuito de Cloudflare**.
- **Repositorio público:** el código se enseña en GitHub. Debe ser limpio, legible y digno de portfolio.
- **Mobile-first:** el móvil es el dispositivo principal, no una adaptación. Toda UI se diseña a 360 px y luego se amplía (ver `docs/DESIGN.md`).
- **Desarrollo guiado por specs:** todo cambio pasa por OpenSpec (ver §7).

Documentos de referencia (léelos antes de proponer cambios grandes):

| Documento | Para qué |
|---|---|
| `docs/ARCHITECTURE.md` | Arquitectura, modelo de datos y decisiones (ADRs) |
| `docs/ROADMAP.md` | Fases del proyecto y alcance de cada una |
| `docs/DESIGN.md` | **Diseño mobile-first**: shell, reglas táctiles, dirección visual y verificación (obligatorio para cualquier UI) |
| `docs/WORKFLOW.md` | Proceso humano: roles, git, revisión de PRs |
| `docs/PROGRESS.md` | Estado actual: en qué cambio estamos y cuál es el siguiente paso |
| `openspec/specs/` | Comportamiento **actual** del sistema (fuente de verdad) |

**Al empezar una sesión**, lee `docs/PROGRESS.md › Ahora mismo` para saber dónde se quedó el trabajo.
El dueño trabaja desde varios equipos y retoma a partir de ese fichero.

---

## 2. Stack (cerrado)

No añadas, sustituyas ni elimines piezas del stack sin un `design.md` aprobado que lo justifique.

| Capa | Tecnología |
|---|---|
| Runtime | Cloudflare Workers (un **único Worker** con static assets) |
| Build | Vite + `@cloudflare/vite-plugin` |
| Backend | Hono (rutas bajo `/api/*`) |
| Validación | Zod (+ `@hono/zod-validator`) |
| Base de datos | Cloudflare D1 (SQLite) |
| ORM / migraciones | Drizzle ORM + drizzle-kit → migraciones aplicadas con `wrangler d1 migrations` |
| Frontend | React 19 + TypeScript (SPA) |
| Routing front | React Router |
| Estado de servidor | TanStack Query |
| Cliente API | Cliente RPC tipado de Hono (`hc<AppType>`) — **sin** tipos duplicados a mano |
| UI | Tailwind CSS + shadcn/ui |
| Fechas | date-fns + @date-fns/tz |
| Auth | Cloudflare Access (delante del Worker) + validación del JWT en el Worker |
| Avisos | Bot de Telegram (Bot API vía `fetch`) disparado por un Cron Trigger |
| Tests | Vitest (+ `@cloudflare/vitest-pool-workers` para el Worker) |
| Tests e2e / responsive | Playwright (viewports móvil y escritorio, en CI) |
| Lint / formato | Biome |
| Gestor de paquetes | pnpm |

**Prohibido sin aprobación explícita:** Redux/Zustand u otro estado global (TanStack Query + estado local bastan),
ORMs o query builders adicionales, frameworks CSS distintos a Tailwind, librerías de componentes distintas a shadcn/ui,
cualquier producto de Cloudflare que requiera el plan Workers Paid.

---

## 3. Estructura del repositorio

```text
nexus/
├── AGENTS.md
├── README.md
├── wrangler.jsonc            # Config del Worker: assets, D1, cron, vars
├── docs/                     # Documentación humana
├── openspec/                 # Specs y cambios (OpenSpec)
├── migrations/               # SQL generado por drizzle-kit (NO editar a mano salvo indicación)
├── shared/                   # Código compartido front ↔ worker (schemas Zod, tipos, constantes)
├── e2e/                      # Tests de Playwright (responsive móvil/escritorio)
├── worker/
│   ├── index.ts              # Entrada: exporta fetch (Hono) y scheduled (cron)
│   ├── app.ts                # Instancia Hono, middlewares globales, monta rutas, exporta AppType
│   ├── middleware/           # access.ts (JWT), errors.ts, etc.
│   ├── routes/<feature>.ts   # Una ruta Hono por feature: SOLO HTTP (parseo, validación, respuesta)
│   ├── services/<feature>.ts # Lógica de negocio pura, testeable sin HTTP
│   ├── db/schema.ts          # Esquema Drizzle (única fuente del modelo de datos)
│   ├── db/client.ts          # Factoría drizzle(env.DB)
│   ├── jobs/                 # Tareas del cron (p. ej. reminders.ts)
│   └── integrations/         # Clientes externos (telegram.ts)
└── src/                      # SPA React
    ├── main.tsx
    ├── app/                  # Router, providers, layout
    ├── features/<feature>/   # components/, hooks/, api.ts, types.ts
    ├── components/ui/        # Componentes shadcn/ui (generados)
    ├── components/           # Componentes propios reutilizables
    └── lib/                  # Utilidades (api client, fechas, cn)
```

Reglas de estructura:

- **Organización por feature**, no por tipo de fichero. Una feature nueva = `worker/routes/x.ts` + `worker/services/x.ts` + `src/features/x/`.
- `routes/` no contiene lógica de negocio ni SQL. `services/` no conoce Hono ni `Request`.
- Todo lo que comparten front y worker (schemas Zod de entrada/salida, enums) vive en `shared/`.
- No crees carpetas nuevas de primer nivel sin aprobación.

---

## 4. Comandos

Estos scripts se crean en la fase 0. Si un script no existe, **no inventes un sustituto**: indícalo.

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor local (Vite + Worker + D1 local) |
| `pnpm build` | Build de producción |
| `pnpm typecheck` | `tsc` en modo estricto, sin emitir |
| `pnpm lint` / `pnpm format` | Biome (check / write) |
| `pnpm test` | Vitest |
| `pnpm test:e2e` | Playwright (proyectos móvil 360 px y escritorio 1280 px) |
| `pnpm db:generate` | drizzle-kit genera la migración SQL desde `worker/db/schema.ts` |
| `pnpm db:migrate:local` | Aplica migraciones en la D1 local |
| `pnpm db:migrate:remote` | Aplica migraciones en producción (**solo lo ejecuta el humano**) |
| `pnpm cf-typegen` | `wrangler types`: regenera los tipos de `Env` |
| `pnpm deploy` | Despliegue (**solo lo ejecuta el humano o la CI**) |

---

## 5. Convenciones de código

### Idioma (decisión del proyecto: "mixto")

| Elemento | Idioma |
|---|---|
| Código, identificadores, nombres de fichero, comentarios en código | **Inglés** |
| Mensajes de commit (Conventional Commits) | **Inglés** |
| Specs, propuestas, diseño, tareas de OpenSpec, `docs/`, descripción de PRs | **Español** |
| Textos visibles en la UI | **Español** |

### TypeScript

- `strict: true`. Prohibido `any` (usa `unknown` y estrecha el tipo). Prohibido `@ts-ignore`; `@ts-expect-error` solo con comentario que explique por qué.
- Los tipos se **derivan**, no se duplican: tipos de BD con `InferSelectModel`/`InferInsertModel`, tipos de API con Zod (`z.infer`) y con `AppType` de Hono.
- Funciones pequeñas y con nombre descriptivo. Prefiere funciones puras y retornos tempranos.
- Nada de código muerto, `console.log` olvidados ni TODOs sin issue/cambio asociado.
- Comentarios: explican el **porqué**, no el qué.

### Backend (Worker)

- Toda entrada (body, query, params) se valida con Zod antes de llegar al servicio.
- Respuestas de error con forma única: `{ error: { code: string, message: string } }` y status HTTP correcto. Un middleware central convierte excepciones en esta forma; nunca filtres stack traces.
- Acceso a datos solo con Drizzle. **Prohibido** construir SQL concatenando strings.
- Agrupa consultas relacionadas con `db.batch()`; evita N+1 (ver límites, §8).
- IDs: `crypto.randomUUID()` (texto).
- **Fechas: siempre UTC en BD** como `integer` (epoch en milisegundos). La conversión a `Europe/Madrid` se hace solo en el frontend o al formatear un mensaje para el usuario. Los Cron Triggers corren en UTC.
- `env` y bindings tipados con los tipos generados por `wrangler types`.

### Frontend

- Componentes de función, hooks para la lógica. Un componente por fichero, nombre en PascalCase.
- Datos del servidor **solo** vía TanStack Query (queries y mutations con invalidación). No dupliques datos del servidor en `useState`.
- Llamadas a la API **solo** a través del cliente RPC de Hono (`src/lib/api.ts`), nunca `fetch` suelto.
- Formularios validados con los mismos schemas Zod de `shared/`.
- **Mobile-first**: estilos base para móvil y ampliación con `md:`/`lg:`; prohibido maquetar con `max-width` *media queries*.
- Overlays siempre con `ResponsiveDialog` (bottom sheet en móvil, diálogo o panel en escritorio).

### Diseño visual y responsive

`docs/DESIGN.md` es **obligatorio** para cualquier cambio con UI. Lo mínimo que nunca se puede saltar:

- Se diseña a **360 px** primero; a 320 px no se rompe nada y **nunca** hay scroll horizontal de página.
- Áreas táctiles de **≥ 44 × 44 px**; acciones frecuentes en el tercio inferior (tab bar + barra de captura).
- Safe areas (`env(safe-area-inset-*)`), alturas con `dvh`/`svh` (nunca `100vh`) y sin bloquear el zoom.
- Inputs con letra **≥ 16 px**, `type`/`inputmode`/`enterkeyhint` correctos e inputs nativos de fecha y hora.
- Nada depende del hover: los estilos de hover van en `@media (hover: hover)`.
- Colores solo mediante los tokens del tema (nada de `#hex` en componentes); modo claro y oscuro.
- Estados obligatorios en cada vista con datos: **cargando** (skeleton), **vacío** (invita a actuar) y **error** (qué pasó y cómo arreglarlo).
- Accesibilidad: labels en inputs, foco visible, contraste AA, botones con texto o `aria-label`, `prefers-reduced-motion`.

---

## 6. Seguridad (no negociable)

1. **Secretos fuera del repo.** Los secretos de producción se crean con `wrangler secret put`; en local viven en `.dev.vars` (ignorado por git). **Nunca** leas, muestres, copies ni commitees `.dev.vars` ni ningún token. Si un secreto es necesario, añade el nombre a `.dev.vars.example` sin valor.
2. **Auth en dos capas.** Cloudflare Access protege el Worker, y además el middleware `worker/middleware/access.ts` valida el JWT de la cabecera `Cf-Access-Jwt-Assertion` (firma con las claves públicas del equipo de Access, `aud`, `iss` y expiración). Si falta o no es válido → `401`. **Fail closed**: ante cualquier duda, se deniega.
3. Toda ruta bajo `/api/*` pasa por ese middleware. No existen endpoints privados "temporalmente abiertos".
4. Nada de `dangerouslySetInnerHTML`, salvo el renderizado del blog (fase 3), y siempre con HTML saneado.
5. **Repo público:** ni datos personales reales, ni emails, ni IDs de chat de Telegram en el código o en los seeds. Los datos de ejemplo son ficticios. La configuración sensible va en variables o secretos.
6. Cabeceras de seguridad en las respuestas (CSP razonable, `X-Content-Type-Options`, `Referrer-Policy`).
7. Dependencias nuevas: solo si están mantenidas, son conocidas y se justifican en `design.md`. Menos dependencias es mejor.

---

## 7. Flujo de trabajo con OpenSpec

**Ninguna línea de código de producto se escribe sin un cambio de OpenSpec aprobado por el humano.**

```text
/opsx:explore (opcional) → /opsx:propose <id> → REVISIÓN HUMANA → /opsx:apply → PR → REVISIÓN HUMANA → merge → /opsx:archive
```

Reglas para el agente:

1. **Un cambio = una rama = un PR.** La rama se llama `change/<change-id>`. Nunca trabajes en `main`.
2. En `apply`, implementa **solo** lo que está en `tasks.md`, en orden, marcando cada tarea al completarla.
3. Si durante la implementación descubres algo que no estaba previsto (una tarea que falta, un requisito ambiguo, una dependencia nueva), **para**: actualiza primero la propuesta, las specs o el diseño, avisa al humano y espera. No improvises fuera del alcance.
4. **No edites `openspec/specs/` a mano.** Las specs principales solo cambian al archivar un cambio.
5. Antes de dar un cambio por terminado: `openspec validate <change-id>` sin errores, y la definición de hecho (§9) cumplida.
6. **Excepción, cambios triviales:** erratas, formato, comentarios o subir de versión parche una dependencia se pueden hacer sin OpenSpec, pero también van en rama y PR.
7. **Al cerrar una sesión** (o si te piden parar): resume qué tareas quedaron hechas y cuáles no, y propone el texto actualizado de `docs/PROGRESS.md › Ahora mismo` con el **siguiente paso exacto**. Asegúrate de que todo queda commiteado en la rama del cambio.

### Cuándo debes parar y preguntar

- La spec es ambigua o se contradice con otra spec o con este documento.
- Necesitas una dependencia, un binding o un servicio que no está en el stack.
- Una migración borra o reescribe datos (DROP, renombrar columnas, cambiar tipos).
- El cambio toca autenticación, secretos o cabeceras de seguridad.
- El diseño podría acercarse a los límites del plan gratuito (§8).
- Vas a borrar o mover ficheros fuera del alcance del cambio.

---

## 8. Presupuesto del plan gratuito (restricciones de diseño)

| Recurso | Límite gratis | Implicación para el código |
|---|---|---|
| Peticiones al Worker | 100.000/día | Los assets estáticos no cuentan; no hagas polling agresivo desde el front |
| CPU por invocación | 10 ms | Nada de trabajo pesado (parseo masivo, cripto en bucle, librerías enormes) |
| Subpeticiones por invocación | 50 (las queries a D1 cuentan) | Agrupa con `db.batch()`, evita N+1, limita los lotes del cron |
| D1 filas leídas | 5 M/día | Índices en columnas de filtrado; nunca `SELECT *` sin `WHERE`/`LIMIT` en tablas que crecen |
| D1 filas escritas | 100.000/día | Cada índice suma escrituras; no escribas en bucles innecesarios |
| D1 tamaño | 500 MB por BD | Nada de blobs/imágenes en D1 (irán a R2 en su fase) |
| Cron Triggers | 5 por cuenta | **Un único cron** (`*/5 * * * *`); `scheduled()` despacha a los jobs |

Cualquier diseño que dependa del plan de pago queda **fuera de alcance** salvo aprobación explícita.

---

## 9. Definición de hecho (por cambio)

Un cambio solo está terminado cuando **todo** esto se cumple:

- [ ] Todas las tareas de `tasks.md` están marcadas.
- [ ] `pnpm typecheck`, `pnpm lint` y `pnpm test` pasan sin errores.
- [ ] `pnpm build` funciona.
- [ ] Si cambió el esquema: migración generada con `pnpm db:generate`, revisada y aplicada en local.
- [ ] Cada requisito nuevo de la spec tiene al menos un test que cubre sus escenarios principales (lógica de `services/` y `jobs/` obligatoriamente).
- [ ] La UI nueva tiene estados de carga, vacío y error.
- [ ] **Responsive verificado** según `docs/DESIGN.md §6`: `pnpm test:e2e` en verde (móvil y escritorio) y prueba manual a 360 px y en un móvil real.
- [ ] Si cambió la arquitectura o una decisión: `docs/ARCHITECTURE.md` actualizado.
- [ ] `openspec validate <change-id>` sin errores.

---

## 10. Git

- **Conventional Commits** en inglés: `type(scope): subject` (≤ 72 caracteres, imperativo). Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`. Scope = feature (`tasks`, `reminders`, `auth`, `db`...).
- Commits pequeños y atómicos, idealmente uno por tarea o grupo de tareas de `tasks.md`.
- **Prohibido:** push a `main`, `push --force`, reescribir historia publicada, commitear secretos, `.dev.vars`, `.wrangler/` o `node_modules/`.
- El merge a `main` lo hace siempre el humano.
