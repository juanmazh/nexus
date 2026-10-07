# Progreso — Nexus

> **Este es el fichero para retomar.** Léelo al empezar cada sesión y actualízalo al terminarla
> (ver `docs/WORKFLOW.md §2`). Si solo lees un documento antes de ponerte a trabajar, que sea este.
>
> Numeración: los pasos de configuración inicial son **S1–S7**; los cambios de OpenSpec usan **0.1, 0.2, 1.1…**

---

## 📍 Ahora mismo

| Campo | Valor |
|---|---|
| **Fase** | 0 — Cimientos (última de la fase 0) |
| **Paso / cambio** | Cambio 0.3 `add-app-shell` **implementado y verificado**, pendiente de revisión, merge y archivo |
| **Rama** | `change/add-app-shell` (sin PR todavía) |
| **Siguiente acción exacta** | Revisar el código del cambio → `pnpm test:e2e` en verde y `pnpm exec playwright install chromium` si es un equipo nuevo → validar la dirección visual "olivar" en un **móvil real** y anotar el resultado en `docs/DESIGN.md §5` → `pnpm deploy` (sin pasos manuales previos: este cambio no añade secretos, migraciones ni cron) → comprobar en el despliegue real que la SPA carga sin violaciones de CSP, que las fuentes se sirven desde el propio origen y que el tema no destella de forma molesta → abrir el PR, mergear a `main` y archivar con `/opsx-archive add-app-shell` |
| **Bloqueos** | Ninguno. Queda una comprobación manual (móvil real) que el agente no puede hacer |
| **Última actualización** | 2026-10-07 · casa |

---

## Configuración inicial (una sola vez, manual)

Estos pasos no pasan por OpenSpec: son configuración de cuentas y herramientas.
Márcalos con `[x]` al completarlos y haz commit.

### S1 · Crear el repositorio y subir la documentación ✅

- [x] Crear en GitHub el repo **público** `juanmazh/nexus`, sin README, sin .gitignore y sin licencia.
- [x] Primer commit y push de la documentación.
- [x] Comprobar en GitHub que están `AGENTS.md`, `docs/`, `openspec/config.yaml`, `.gitignore`, `.gitattributes` y `.dev.vars.example`.

### S2 · Herramientas (en **cada** equipo — ver "Preparar un equipo nuevo")

- [x] Equipo de la oficina preparado
- [x] Equipo de casa preparado

### S3 · Cuenta de Cloudflare ✅

- [x] Cuenta creada, con la sesión iniciada en el dashboard.
- [x] Subdominio `workers.dev`: `juanmazh-dev` → URL de la app: **`nexus.juanmazh-dev.workers.dev`**
- [x] Zero Trust activado con el **plan Free**. Equipo: **`juanmazh.cloudflareaccess.com`** (valor de `ACCESS_TEAM_DOMAIN`)
- [ ] Access en el Worker: **pendiente a propósito**. Se activa justo después del primer deploy de `bootstrap-project` (ver la tabla de cambios).

### S4 · Bot de Telegram ✅

- [x] Bot creado con `@BotFather`; **token** guardado en el gestor de contraseñas (nunca en el repo).
- [x] Mensaje enviado al bot.
- [x] `chat.id` obtenido con `getUpdates` y guardado en el gestor de contraseñas.
- [x] `.dev.vars` creado a partir de `.dev.vars.example` en el equipo de la oficina (comprobado que git lo ignora).

### S5 · OpenSpec ✅

- [x] `openspec init` con OpenCode. No tocó `config.yaml` ni `AGENTS.md`; añadió `.opencode/` (comandos y skills) y las carpetas `openspec/changes/` y `openspec/specs/`.
- [x] Commit `chore(openspec): initialize openspec for opencode`, mergeado por PR.
- Comandos en OpenCode (**con guion**): `/opsx-explore`, `/opsx-propose <id>`, `/opsx-apply`, `/opsx-archive`, `/opsx-update`, `/opsx-sync`.

### S6 · OpenCode y modelo (100 % gratis)

Decisión: modelos **gratuitos de OpenCode en modo anónimo**; sin OpenRouter y sin cuenta de pago (ver "Modelos en uso").

- [x] OpenCode funcionando en modo anónimo con un modelo gratuito.
- [x] Decidido **no fijar el modelo** en `opencode.json`: OpenCode usa el gratuito que tengas seleccionado (`/models`). Así no se rompe cuando OpenCode rota sus modelos gratuitos.
- [x] `opencode.json` en la raíz (PR `chore/docs-free-models`): **bloquea al agente** la lectura de `.dev.vars`/`.env`, los comandos de despliegue (`pnpm deploy`, migraciones remotas, `wrangler secret`) y `push --force`, y pide confirmación para cualquier comando no habitual.

### S7 · Proteger `main` (después del cambio 0.1, cuando exista la CI)

- [ ] GitHub → Settings → Branches → regla para `main`: exigir PR y que pase la CI, y prohibir force push.

---

## Cambios de OpenSpec

Leyenda: ⬜ pendiente · 🟡 en curso · 👀 en revisión · ✅ hecho y desplegado

| # | change-id | Estado | Rama / PR | Pasos manuales asociados |
|---|---|---|---|---|
| 0.1 | `bootstrap-project` | ✅ | PR #3 y #4 | — |
| 0.2 | `add-access-auth` | 👀 | `change/add-access-auth` (sin PR) | Copiar el **AUD tag** de la aplicación de Access del Worker (Zero Trust → Access → Applications) → `pnpm wrangler secret put ACCESS_AUD` **antes** del primer deploy con el middleware montado → `pnpm deploy` → comprobar las tres rutas a mano |
| 0.3 | `add-app-shell` | 🟡 | `change/add-app-shell` (sin PR) | `pnpm exec playwright install chromium` en cada equipo nuevo → validar en un **móvil real** la dirección visual "olivar" (`docs/DESIGN.md §5`) → `pnpm deploy` y comprobar en el despliegue real que no hay violaciones de CSP, que las fuentes van al propio origen y que el tema no destella |
| 1.1 | `add-tasks` | ⬜ | | `pnpm db:migrate:remote` antes del deploy |
| 1.2 | `add-reminders` | ⬜ | | `wrangler secret put TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`; migración remota; deploy; esperar un aviso real |
| 1.3 | `add-pwa` | ⬜ | | Instalar la app en tu móvil (Android: Chrome › Instalar; iOS: Safari › Añadir a pantalla de inicio) |
| — | **Hito v0.1.0** | ⬜ | | Tag `v0.1.0` + una semana de uso real **desde el móvil** |
| 2.1 | `add-notes` | ⬜ | | |
| 2.2 | `add-quick-links` | ⬜ | | |
| 2.3 | `add-home-dashboard` | ⬜ | | Configurar el deploy automático (GitHub Actions + `CLOUDFLARE_API_TOKEN`) |
| 3.0 | — | ⬜ | | **Comprar el dominio** (Cloudflare Registrar) |
| 3.1 | `move-to-custom-domain` | ⬜ | | Custom Domain + aplicación de Access por ruta |
| 3.2 | `add-blog` | ⬜ | | |
| 3.3 | `add-email-channel` | ⬜ | | Email Routing + verificar la dirección de destino |
| 4.1 | `add-finance-transactions` | ⬜ | | |
| 4.2 | `add-finance-charts` | ⬜ | | |
| 5.1 | `add-calendar-view` | ⬜ | | |

---

## 💻 Preparar un equipo nuevo

- [ ] **Node.js ≥ 20.19** (`node -v`). Recomendado: la LTS actual.
- [ ] **pnpm**: `corepack enable` (o `npm i -g pnpm`).
- [ ] **Git** con tu identidad **solo en este repo** (`git config user.name` / `user.email`, sin `--global`) y, en Windows, `git config --global core.autocrlf false` (el `.gitattributes` fuerza LF).
- [ ] **OpenSpec CLI**: `npm install -g @fission-ai/openspec@latest`.
- [ ] **OpenCode** instalado (modo anónimo; no hace falta login). El modelo lo fija `opencode.json`.
- [ ] Clonar con tu usuario en la URL (evita choques con otras cuentas de GitHub del equipo):
      `git clone https://juanmazh@github.com/juanmazh/nexus.git`
- [ ] `pnpm install` (desde el cambio 0.1; `package.json` ya existe).
- [ ] `pnpm exec playwright install chromium` (desde `add-app-shell`; solo hace falta para `pnpm test:e2e`, una vez por equipo).
- [ ] `pnpm wrangler login` (solo hace falta para desplegar o para la D1 remota; `pnpm dev` no lo pide).
- [ ] Copiar `.dev.vars` desde el gestor de contraseñas (`ACCESS_AUD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) y comprobar con `git status` que no aparece. Desde `add-access-auth` ya hace falta: sin `ACCESS_AUD`, `/api/*` deniega.
- [ ] `pnpm dev` → la app arranca en `http://localhost:5173`. Para llamar a `/api/*` en local, activa `ACCESS_DEV_BYPASS=1` en `.dev.vars` (ADR-009). (`pnpm db:migrate:local` todavía no hace falta: no hay migraciones.)

---

## 🤖 Modelos en uso

| Rol | Modelo (ID) | Desde | Notas |
|---|---|---|---|
| Planificación (`explore` / `propose`) | El gratuito seleccionado en OpenCode (sin fijar) | 2026-10-07 | Gratis, anónimo. Puede usar los prompts para entrenar: **nunca secretos en el contexto** |
| Revisión de propuestas | Claude (claude.ai) | 2026-10-07 | Pegar `proposal.md`, `design.md` y `tasks.md` antes de `/opsx-apply` |
| Implementación (`apply`) | El gratuito seleccionado en OpenCode (sin fijar) | 2026-10-07 | El mismo de momento; se reevalúa tras el primer cambio |
| Plan B | OpenRouter `:free` (`qwen/qwen3-coder:free`, `openai/gpt-oss-120b:free`) | — | Solo si OpenCode falla. Límite de 50 peticiones al día |

---

## 📓 Bitácora (lo más reciente arriba)

Una línea por sesión: fecha · lugar · qué se hizo · siguiente paso.

- **2026-10-07 · casa** — `/opsx-apply add-app-shell`: **30/33 tareas** (1–6 hechas y commiteadas; 7 en curso). Shell completo (`src/app/layout/`): ruta de layout con `h-dvh` y scroll interno, `TabBar`/`Sidebar` montados **uno u otro** según viewport, barra de captura con atajo `N` que cede ante escritura, overlays y con Ctrl/Cmd/Alt, `EmptyState`, `Skeleton` y el `ToastHost` único. Tema "olivar" en tokens, con `--accent-strong` (`#A8841A`) para el marcador de "ahora" y `src/lib/contrast.test.ts` leyendo `src/index.css` y fallando si un par baja de AA (comprobado: tinta al 55 % da 3,59:1 y 3,07:1). Fuentes propias self-hosted (fuera Geist). `ResponsiveDialog` con `Drawer`/`Dialog` de shadcn y `useSyncExternalStore` para el breakpoint. `HealthPage` → `HealthPanel` en **Más**, que además muestra `GET /api/me` (solo ahí, para no gastar invocaciones del Worker). Playwright con proyectos móvil 360 × 780 y escritorio 1280 × 800, levantando `pnpm build` + `vite preview` e interceptando `/api/*`: **48 tests en verde en los dos proyectos**, y job `e2e` en la CI en paralelo a `verify`. **Tres desviaciones del `design.md`, deliberadas:** (1) `contrast.test.ts` lee el CSS con `node:fs` en vez de `import "index.css?raw"`, porque en este montaje de Vite un `?raw` de un hoja de estilos resuelve a cadena vacía y haría pasar todas las aserciones sin comprobar nada; (2) `TabBar` y `Sidebar` los elige `AppShell`, no un `AppNavigation` aparte, porque la tab bar va **abajo** en móvil y la barra lateral **a la izquierda** en escritorio, y un solo componente no puede ocupar las dos posiciones; (3) la comprobación de scroll horizontal de la suite hace más que comparar `scrollWidth` con `innerWidth`: la raíz del shell es `overflow-hidden` a propósito, así que un elemento demasiado ancho se **recorta** en vez de hacer scroll y `scrollWidth` no se entera; la suite busca además cualquier caja que sobresalga del viewport (comprobado: rompe al forzar un ancho de 1400 px). **8.1 (verificación manual en DevTools y en un móvil real) y 8.2 quedan para la persona propietaria**; el resto de 8 se cierra al final. → Siguiente: cerrar 7 y 8, revisar, `pnpm deploy`, comprobar en el despliegue real, PR, merge y `/opsx-archive`.

- **2026-10-07 · casa** — `/opsx-apply add-access-auth`: **22/22 tareas**. Dependencia `jose@^6.2.12`, `ACCESS_TEAM_DOMAIN` en `vars`, atajo local `ACCESS_DEV_BYPASS` documentado (doble condición: `.dev.vars` **y** hostname local). Worker: `services/access-token.ts` + `access-jwks.ts` (JWKS remoto memoizado por dominio), `middleware/access.ts` (fail closed, mounted **antes** del enrutado, única excepción `GET /api/health`), `routes/me.ts` (`GET /api/me`), `middleware/security-headers.ts` y `public/_headers`. **49 tests en verde.** Verificado contra el gestor de assets real con `wrangler dev`: `/` y el asset JS llevan la CSP de la SPA y `/api/health` lleva la de la API. Sin cambios de esquema (0 filas D1) y el bundle del cliente no ha crecido. **Dos desviaciones del `design.md`, ambas deliberadas:** (1) el tipo de `Bindings` de Hono se declara en `middleware/access.ts` en vez de usar `Cloudflare.Env`, porque `src/lib/api.ts` arrastra el grafo del Worker al `typecheck` de la SPA, donde los globales de workerd no existen —y porque `wrangler types` estrecha las `vars` a literales y los tests necesitan su propio dominio—; (2) una sola regla en `_headers` en vez de dos, porque `/*` y `/assets/*` coinciden en los mismos assets y Cloudflare mandaba cada cabecera duplicada. Quedan los pasos manuales: `ACCESS_AUD`, `pnpm deploy`, comprobación en el despliegue real, PR y merge. → Siguiente: revisar, `wrangler secret put ACCESS_AUD`, `pnpm deploy`, comprobar, PR, merge y `/opsx-archive`.
- **2026-10-07 · oficina** — `/opsx-apply bootstrap-project`: **33/36 tareas**, documentación cerrada (8.1–8.4). `AGENTS.md` corregido (`@cloudflare/vitest-plugin`, `test:e2e` inexistente hasta `add-app-shell`, excepción de `/api/health` en §6.3), `docs/ARCHITECTURE.md §2.3` con la configuración real (placeholder del `database_id`, sin `triggers`) y `README.md` con la puesta en marcha y el paso manual de crear la D1. 9.1 re-ejecutada de verdad: typecheck, lint, test (9/9) y build en verde; `openspec validate --strict` en verde. Auditoría 8.4: ningún secreto, email ni `chat.id` versionado (`.dev.vars` ignorado, solo se versiona `.dev.vars.example` con valores vacíos). Quedan **7.2, 9.2 y 9.5**, las tres humanas (CI, navegador y PR). **Desviación pendiente de decidir:** `design.md §3` sigue describiendo el 405 como un `.all()` en la ruta cuando acabó siendo un middleware, y los alias como objeto cuando son regex. → Siguiente: commit, `git push -u origin change/bootstrap-project`, abrir el PR y verificar la CI.
- **2026-10-07 · oficina** — `/opsx-apply bootstrap-project`: 28/36 tareas hechas y commiteadas. Base del proyecto (package.json, pnpm, 4 tsconfig, Biome), Worker con `GET /api/health` (+ 405/404 con la forma de error), SPA mínima con los tres estados, Vitest con dos proyectos (**9 tests en verde**), CI sin despliegue. pnpm, Node y `@cloudflare/vitest-plugin` ya estaban disponibles: **no hizo falta `corepack enable`**. Dos desviaciones del `design.md`: el 405 va en un middleware en vez de un `.all()` (`.get()`+`.all()` en la misma ruta colapsa el tipo de `$get` a `never` en el cliente RPC) y los alias se declaran en forma de regex (la forma objeto no resolvía dentro de Vitest 4). Pendiente: documentación (8.1–8.4), comprobación manual de `pnpm dev` (9.2) y push/PR. → Siguiente: retomar con `/opsx-apply bootstrap-project`.
- **2026-10-07 · oficina** — Parche de modelos gratuitos aplicado de verdad (`opencode.json` en la raíz, sin fijar modelo). Propuesta de `bootstrap-project` generada con `/opsx-propose` y revisada con Claude; correcciones aplicadas (404/405 con la forma de error, tsconfig, alias sin dependencias extra). → Siguiente: mergear PR #1 y #2 y `/opsx-apply`.
- **2026-10-07 · oficina** — Configuración inicial S1–S5 completada: repo `juanmazh/nexus` (con la identidad de git personal separada de la del trabajo), Cloudflare (`nexus.juanmazh-dev.workers.dev`, Zero Trust `juanmazh`), bot de Telegram y OpenSpec inicializado por PR. Decidido usar modelos gratuitos de OpenCode en modo anónimo en lugar de OpenRouter de pago. Access en el Worker se activará tras el primer deploy. → Siguiente: S6 (`opencode.json`), PR de documentación y cambio 0.1.
- **2026-10-07 · oficina** — Mobile-first como pilar: nuevo `docs/DESIGN.md`, cambio `add-app-shell` (0.3), PWA adelantada a la fase 1 (1.3) y Playwright con viewports móvil/escritorio en CI (ADR-008).
- **2026-10-07 · oficina** — Definidas las directrices (AGENTS.md, ARCHITECTURE, ROADMAP, WORKFLOW, config de OpenSpec). Decisiones: nombre Nexus, idioma mixto, React + TS, avisos por Telegram, dominio aplazado a la fase 3. → Siguiente: paso 0.1.

---

## ❓ Decisiones pendientes

- Nombre del dominio para la fase 3 (`nexus` estará cogido en casi todos los TLD; valorar algo como `juanmazh.dev`, con Nexus en una ruta o subdominio).
- Licencia del repo (MIT si quieres que sea reutilizable; sin licencia si solo quieres enseñarlo).
