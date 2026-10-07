# Progreso — Nexus

> **Este es el fichero para retomar.** Léelo al empezar cada sesión y actualízalo al terminarla
> (ver `docs/WORKFLOW.md §2`). Si solo lees un documento antes de ponerte a trabajar, que sea este.
>
> Numeración: los pasos de configuración inicial son **S1–S7**; los cambios de OpenSpec usan **0.1, 0.2, 1.1…**

---

## 📍 Ahora mismo

| Campo | Valor |
|---|---|
| **Fase** | 0 — Cimientos |
| **Paso / cambio** | Cambio 0.1 `bootstrap-project` — **implementado a medias: 28/36 tareas** |
| **Rama** | `change/bootstrap-project` (andamiaje commiteado, sin push) |
| **Siguiente acción exacta** | `/opsx-apply bootstrap-project` en una sesión nueva → terminar las tareas 8.1–8.4 (documentación), 9.2 (comprobar `pnpm dev` a mano a 360 px) y 9.5 → commit → `git push -u origin change/bootstrap-project` → abrir el PR (la CI lo dispara y **verifica los cuatro pasos en verde**, tarea 7.2) |
| **Bloqueos** | 9.3 no se puede marcar tal como está escrita: `pnpm db:generate` **sí** escribe `migrations/meta/_journal.json` (vacío, `entries: []`). Decidir: aceptar el fichero y corregir el texto de la tarea, o ignorarlo en git |
| **Última actualización** | 2026-10-07 · oficina |

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
- [ ] Equipo de casa preparado

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
| 0.1 | `bootstrap-project` | 🟡 | `change/bootstrap-project` (sin PR) | Crear la D1: `pnpm wrangler d1 create nexus-db` y pegar el `database_id` en `wrangler.jsonc`. Primer `pnpm deploy`. **Justo después:** activar Cloudflare Access en el Worker `nexus` (producción y previews) permitiendo solo tu email |
| 0.2 | `add-access-auth` | ⬜ | | Copiar el **AUD tag** de la aplicación de Access del Worker (Zero Trust → Access → Applications) → `pnpm wrangler secret put ACCESS_AUD` |
| 0.3 | `add-app-shell` | ⬜ | | Validar en un móvil real la dirección visual "olivar" (`docs/DESIGN.md §5`) |
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
- [ ] `pnpm install` (cuando exista `package.json`, desde el cambio 0.1).
- [ ] `pnpm wrangler login` (desde el cambio 0.1).
- [ ] Copiar `.dev.vars` desde el gestor de contraseñas y comprobar con `git status` que no aparece.
- [ ] `pnpm db:migrate:local` y `pnpm dev` → la app arranca.

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

- **2026-10-07 · oficina** — `/opsx-apply bootstrap-project`: 28/36 tareas hechas y commiteadas. Base del proyecto (package.json, pnpm, 4 tsconfig, Biome), Worker con `GET /api/health` (+ 405/404 con la forma de error), SPA mínima con los tres estados, Vitest con dos proyectos (**9 tests en verde**), CI sin despliegue. pnpm, Node y `@cloudflare/vitest-plugin` ya estaban disponibles: **no hizo falta `corepack enable`**. Dos desviaciones del `design.md`: el 405 va en un middleware en vez de un `.all()` (`.get()`+`.all()` en la misma ruta colapsa el tipo de `$get` a `never` en el cliente RPC) y los alias se declaran en forma de regex (la forma objeto no resolvía dentro de Vitest 4). Pendiente: documentación (8.1–8.4), comprobación manual de `pnpm dev` (9.2) y push/PR. → Siguiente: retomar con `/opsx-apply bootstrap-project`.
- **2026-10-07 · oficina** — Parche de modelos gratuitos aplicado de verdad (`opencode.json` en la raíz, sin fijar modelo). Propuesta de `bootstrap-project` generada con `/opsx-propose` y revisada con Claude; correcciones aplicadas (404/405 con la forma de error, tsconfig, alias sin dependencias extra). → Siguiente: mergear PR #1 y #2 y `/opsx-apply`.
- **2026-10-07 · oficina** — Configuración inicial S1–S5 completada: repo `juanmazh/nexus` (con la identidad de git personal separada de la del trabajo), Cloudflare (`nexus.juanmazh-dev.workers.dev`, Zero Trust `juanmazh`), bot de Telegram y OpenSpec inicializado por PR. Decidido usar modelos gratuitos de OpenCode en modo anónimo en lugar de OpenRouter de pago. Access en el Worker se activará tras el primer deploy. → Siguiente: S6 (`opencode.json`), PR de documentación y cambio 0.1.
- **2026-10-07 · oficina** — Mobile-first como pilar: nuevo `docs/DESIGN.md`, cambio `add-app-shell` (0.3), PWA adelantada a la fase 1 (1.3) y Playwright con viewports móvil/escritorio en CI (ADR-008).
- **2026-10-07 · oficina** — Definidas las directrices (AGENTS.md, ARCHITECTURE, ROADMAP, WORKFLOW, config de OpenSpec). Decisiones: nombre Nexus, idioma mixto, React + TS, avisos por Telegram, dominio aplazado a la fase 3. → Siguiente: paso 0.1.

---

## ❓ Decisiones pendientes

- Nombre del dominio para la fase 3 (`nexus` estará cogido en casi todos los TLD; valorar algo como `juanmazh.dev`, con Nexus en una ruta o subdominio).
- Licencia del repo (MIT si quieres que sea reutilizable; sin licencia si solo quieres enseñarlo).
