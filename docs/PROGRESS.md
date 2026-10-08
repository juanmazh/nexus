# Progreso — Nexus

> **Este es el fichero para retomar.** Léelo al empezar cada sesión y actualízalo al terminarla
> (ver `docs/WORKFLOW.md §2`). Si solo lees un documento antes de ponerte a trabajar, que sea este.
>
> Numeración: los pasos de configuración inicial son **S1–S7**; los cambios de OpenSpec usan **0.1, 0.2, 1.1…**

---

## 📍 Ahora mismo

| Campo | Valor |
|---|---|
| **Fase** | 1 — MVP: tareas y recordatorios |
| **Paso / cambio** | Cambio 1.2 `add-reminders` **mergeado** (PR #11) y **archivado** en `chore/archive-add-reminders` (spec `reminders` nueva). Siguiente: 1.3 `add-pwa` |
| **Rama** | `chore/archive-add-reminders` (PR del archivo y del job de CI que exige archivar) |
| **Siguiente acción exacta** | Mergear el PR del archivo → **S7**: proteger `main` exigiendo los tres jobs de la CI, incluido `OpenSpec (validated and archived)` → `add-pwa` |
| **Bloqueos** | Ninguno |
| **Última actualización** | 2026-10-08 · casa |

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

- [ ] GitHub → Settings → Branches → regla para `main`: exigir PR y que pasen los tres jobs de la CI (`Lint, typecheck, test and build`, `Responsive (Playwright)` y `OpenSpec (validated and archived)`), y prohibir force push. **Sin esto el job de OpenSpec avisa pero no impide el merge.**

---

## Cambios de OpenSpec

Leyenda: ⬜ pendiente · 🟡 en curso · 👀 en revisión · ✅ hecho y desplegado

| # | change-id | Estado | Rama / PR | Pasos manuales asociados |
|---|---|---|---|---|
| 0.1 | `bootstrap-project` | ✅ | PR #3 y #4 | — |
| 0.2 | `add-access-auth` | ✅ | PR #6 | Copiar el **AUD tag** de la aplicación de Access del Worker (Zero Trust → Access → Applications) → `pnpm wrangler secret put ACCESS_AUD` **antes** del primer deploy con el middleware montado → `pnpm deploy` → comprobar las tres rutas a mano |
| 0.3 | `add-app-shell` | ✅ | PR #7 | `pnpm exec playwright install chromium` en cada equipo nuevo → validar en un **móvil real** la dirección visual "olivar" (`docs/DESIGN.md §5`) → `pnpm deploy` y comprobar en el despliegue real que no hay violaciones de CSP, que las fuentes van al propio origen y que el tema no destella |
| 1.1 | `add-tasks` | ✅ | PR #9 (+ PR del archivo) | `pnpm db:migrate:remote` **antes** del deploy → `pnpm deploy` → comprobar `/tasks` y la captura en el despliegue real y en un **móvil real** |
| 1.2 | `add-reminders` | ✅ | PR #11 (+ PR del archivo) | `wrangler secret put TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` → `pnpm db:migrate:remote` **antes** del deploy → `pnpm deploy` → aviso de prueba desde Más y un aviso real en el móvil |
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

### Estado de la definición de hecho (`AGENTS.md §9`) para `add-reminders`

| Punto | Estado |
|---|---|
| Todas las tareas de `tasks.md` marcadas | ✅ todas las automáticas; los pasos manuales están en "Ahora mismo" |
| `pnpm typecheck`, `pnpm lint` y `pnpm test` en `0` | ✅ `0`, `0`, **371 tests** (worker contra D1 real + web) |
| `pnpm build` | ✅ sin errores |
| Migración | ✅ `migrations/0001_graceful_mad_thinker.sql` (tabla `reminders`, FK con cascada y dos índices), aplicada en local; la remota va **antes** del deploy |
| Cron | ✅ `*/5 * * * *` en `wrangler.jsonc`; `scheduled` verificado en local con `wrangler dev --test-scheduled` (sin secretos registra lo que falta y no toca nada) |
| Cada requisito nuevo con al menos un test | ✅ Vitest + Playwright (**72 en dos viewports**, 10 nuevos de avisos) |
| UI nueva con carga, vacío y error | ✅ esqueleto, "Sin avisos." y error con "Reintentar" en el detalle |
| Responsive verificado (`docs/DESIGN.md §6`) | ✅ automático en verde. ⚠️ Falta probarlo en el **móvil real** con Telegram |
| `docs/ARCHITECTURE.md` actualizado | ✅ §2.1, §2.3, §3.3 y §4 |
| `openspec validate add-reminders --strict` | ✅ sin errores |
| Presupuesto de la carga inicial | ✅ **148,9 kB de JS comprimido** (antes 148,6; presupuesto: 200 kB) |
| Auditoría de secretos | ✅ ningún token ni `chat_id` real; los de los tests son ficticios (`123456789:AAFake…`, `424242`) |

### Estado de la definición de hecho (`AGENTS.md §9`) para `add-tasks`

| Punto | Estado |
|---|---|
| Todas las tareas de `tasks.md` marcadas | ⚠️ **34/35**: solo queda 8.3, que es manual |
| `pnpm typecheck`, `pnpm lint` y `pnpm test` en `0` | ✅ `0`, `0`, **278 tests** (worker contra D1 real + web) |
| `pnpm build` | ✅ build de producción sin errores |
| Migración | ✅ `migrations/0000_mixed_madrox.sql` (tabla `tasks` y sus dos índices), aplicada en local; la remota es un paso manual **antes** del deploy |
| Cada requisito nuevo con al menos un test | ✅ Vitest + Playwright (**62 en dos viewports**, 10 nuevos del flujo de tareas) |
| UI nueva con carga, vacío y error | ✅ `Skeleton`, `EmptyState` "Sin tareas" y error con "Reintentar" |
| Responsive verificado (`docs/DESIGN.md §6`) | ⚠️ **automático en verde** (sin scroll horizontal, objetivos de 44 px, hoja en móvil y diálogo en escritorio); falta la 8.3 manual |
| `docs/ARCHITECTURE.md` actualizado | ✅ `§2.1`, `§2.2` y `§4` (segundo índice, regla de "vencida", único escritor de `completed_at`) |
| `openspec validate add-tasks --strict` | ✅ sin errores |
| Presupuesto de la carga inicial | ✅ **148,6 kB de JS comprimido** (antes 135,6; presupuesto: 200 kB). El chunk perezoso de `/tasks` pesa 47,9 kB |
| Auditoría de secretos | ✅ ningún token, secreto, email real ni `chat.id`; los datos de `e2e/fixtures.ts` son ficticios |

### Estado de la definición de hecho (`AGENTS.md §9`) para `add-app-shell`

| Punto | Estado |
|---|---|
| Todas las tareas de `tasks.md` marcadas | ⚠️ **32/33**: solo queda 8.1, que es manual |
| `pnpm typecheck`, `pnpm lint` y `pnpm test` en `0` | ✅ `0`, `0`, **160 tests** en 20 ficheros |
| `pnpm build` | ✅ build de producción sin errores |
| Sin cambio de esquema | ✅ `pnpm db:generate` → "No schema changes", `migrations/` sigue solo con `.gitkeep` |
| Cada requisito nuevo con al menos un test | ✅ Vitest (160) + Playwright (52 en dos viewports) |
| UI nueva con carga, vacío y error | ✅ `Skeleton`, `EmptyState` y los paneles con reintento |
| Responsive verificado (`docs/DESIGN.md §6`) | ⚠️ **automático en verde** (`pnpm test:e2e`, móvil y escritorio); falta la comprobación manual de 8.1 |
| `docs/ARCHITECTURE.md` actualizado | ✅ `§2.2` y ADR-010 nuevo, ADR-008 enmienda |
| `openspec validate add-app-shell --strict` | ✅ sin errores |
| Presupuesto de la carga inicial | ✅ **135,63 kB de JS comprimido** (presupuesto: 200 kB) |
| Auditoría de secretos | ✅ `git grep` de `token`/`secret`/`password` sin resultados; el email de los fixtures solo vive en `e2e/` |

- **2026-10-08 · casa** — `add-reminders` mergeado como PR #11, **otra vez sin archivar** (tercera vez, tras `add-access-auth` y `add-tasks`). Archivado después en `chore/archive-add-reminders` con la spec `reminders` (15 requisitos) y las 10 specs validadas. En producción: secretos de Telegram, `db:migrate:remote` y deploy hechos; **el aviso de prueba y uno real llegan bien**. Como recordarlo no ha bastado, la CI tiene un job nuevo, `OpenSpec (validated and archived)`: valida todas las specs y falla en una rama `change/<id>` mientras `openspec/changes/<id>/` exista. Solo bloquea si **S7** está hecho. → Siguiente: S7 y `add-pwa`.

- **2026-10-08 · casa** — `add-reminders` propuesto e implementado por Claude, porque OpenCode se quedó sin cuota. Decisiones de producto tomadas por la persona dueña antes de la propuesta: atajos fijos más "El día que vence 9:00", campana en la fila, cancelar con confirmación y sin editar la hora, deshacer no reactiva avisos, botón de aviso de prueba en Más, mensaje con título, vencimiento y prioridad alta, sin aviso automático y un solo cambio aunque pase de 600 líneas. **Lo que destaparon los tests:**
  - **Bug de Drizzle con subconsultas correlacionadas:** escribe `${tasks.id}` como un `"id"` sin cualificar, que dentro de la subconsulta es el de `reminders`. Devolvía `null` en silencio; las columnas se cualifican a mano.
  - **Bug previo de `ResponsiveDialog` en escritorio:** recortaba en vez de hacer scroll cualquier contenido más alto que la pantalla. Commit propio `fix(ui)` y e2e de regresión que falla sin el arreglo.
  - **La confirmación de cancelar el último aviso quedaba por debajo de lo visible;** ahora se desplaza a la vista.
  - **El 10 de octubre de 2026 es sábado,** no viernes como decían los ejemplos de la propuesta: corregido.
  - **Revisión independiente** (un agente que no vio el desarrollo): nada se salta Access, el token no se filtra y se respetan los límites del plan. Encontró dos bugs y un riesgo, corregidos con tests que fallan sin el arreglo: el detalle podía listar avisos ya cancelados tras completar y deshacer (caché); un aviso creado justo al completar la tarea podía enviarse; y las trazas de Cloudflare, si se activaran, registrarían el token (ahora apagadas explícitamente).

  → Siguiente: revisión, PR, secretos, migración remota, deploy, prueba con Telegram real y `/opsx-archive` antes del merge.

- **2026-10-08 · casa** — `add-tasks` mergeado como PR #9 y archivado después con `/opsx-archive add-tasks` en `chore/archive-add-tasks`: nueva spec `tasks` (17 requisitos) y requisito *Barra de captura que crea tareas* en `app-shell`; `openspec validate --all --strict` con las 9 specs en verde. Se volvió a mergear **antes** de archivar: el archivo va siempre en el PR del cambio, no después. Limpieza: borrada la rama `change/add-tasks` y el stash de OpenCode. Después: `pnpm db:migrate:remote`, `pnpm deploy` y **8.3 verificada en un móvil real** sobre el despliegue (lista, captura, completar y deshacer, detalle como hoja inferior con el teclado abierto, borrado confirmado, modo claro y oscuro: todo bien). → Siguiente: `/opsx-propose add-reminders`.

- **2026-10-07 · casa** — `/opsx-apply add-tasks`: **34/35 tareas**. OpenCode hizo los grupos 0–3 con errores de tipos y de formato (corregidos) y se quedó sin cuota gratuita; Claude cerró 3–9. Worker: `routes/tasks.ts` con validadores propios que devuelven `{ error: { code, message } }`, `405` con `Allow`, `PATCH` que separa `status` (va a `updateTaskStatus`, único escritor de `completed_at`) del resto de campos. SPA: `features/tasks/` con tipos derivados del cliente RPC, mutaciones optimistas con rollback, secciones Vencidas / Hoy / Próximas / Sin fecha, `Hechas (N)`, detalle en `ResponsiveDialog` con borrado confirmado, y la barra de captura conectada desde el shell. **Desviaciones del `design.md`, deliberadas y ya reflejadas en él:** (1) la barra devuelve el texto cuando la promesa de `onSubmit` se rechaza, sin modo controlado `value`/`onValueChange`; (2) una fila optimista no se puede completar ni abrir hasta que llega su id real, porque su id provisional daría un `400`; (3) el botón "Borrar tarea" va con borde rojo en vez de relleno, porque blanco sobre el rojo del modo oscuro no llega a AA; (4) la comprobación de scroll horizontal de la suite e2e ignora los nodos recortados a nada (`sr-only`, *focus guards* de Base UI), que daban falsos positivos. La 9.2 pedía marcar el cambio en `docs/ROADMAP.md`, pero ese documento no lleva estado: el estado vive aquí. → Siguiente: revisar, PR, `pnpm db:migrate:remote`, `pnpm deploy`, 8.3 en un móvil real y `/opsx-archive add-tasks` antes del merge.

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
- **Landing pública del proyecto** (idea del 2026-10-08, aparcada). Página para exponer Nexus como proyecto de portfolio con un botón "Acceder" a la app. Planteamiento acordado para cuando se retome:
  - **Sin login propio:** "Acceder" enlaza a la app y Cloudflare Access hace de login (código por email), coherente con ADR-002. La página de login de Access se puede personalizar con la marca desde Zero Trust.
  - **La landing como sitio estático aparte en el mismo repo** (`landing/` con su propio `wrangler.jsonc`, HTML + Tailwind con los tokens "olivar", sin React), publicada en su propia URL de `workers.dev`. La app no se toca. Coste 0 € (los assets estáticos no gastan invocaciones). Requiere una ADR nueva, porque ADR-001 dice "un único Worker".
  - **No** proteger por ruta (`/` pública y `/app/*` tras Access) en `workers.dev`: la documentación de Cloudflare no confirma que las aplicaciones por ruta funcionen en ese hostname.
  - Con el dominio de la fase 3 solo se asignan dominios (p. ej. `nexus.<dominio>` para la landing y `app.nexus.<dominio>` para la app), sin rehacer nada.
  - Contenido: capturas reales en móvil y escritorio, el stack, las decisiones clave (ADRs), el enlace al repo y al flujo OpenSpec. Segunda fase opcional: demo pública con datos ficticios reutilizando el stub en memoria de los e2e.
  - Se haría como un cambio propio de OpenSpec (`add-landing`). Por decidir: cuándo intercalarlo y si se adelanta la compra del dominio.
- Licencia del repo (MIT si quieres que sea reutilizable; sin licencia si solo quieres enseñarlo).
