# Progreso — Nexus

> **Este es el fichero para retomar.** Léelo al empezar cada sesión y actualízalo al terminarla
> (ver `docs/WORKFLOW.md §2`). Si solo lees un documento antes de ponerte a trabajar, que sea este.

---

## 📍 Ahora mismo

| Campo | Valor |
|---|---|
| **Fase** | 0 — Cimientos |
| **Paso / cambio** | Paso 0.1 — Crear el repositorio y subir la documentación |
| **Rama** | `main` (todavía no hay ramas de cambio) |
| **Siguiente acción exacta** | Ejecutar los comandos del paso 0.1 |
| **Bloqueos** | Ninguno |
| **Última actualización** | 2026-10-07 · oficina |

---

## Paso 0 — Puesta en marcha (una sola vez, manual)

Estos pasos no pasan por OpenSpec: son configuración de cuentas y herramientas.
Márcalos con `[x]` al completarlos y haz commit.

### 0.1 · Crear el repositorio y subir la documentación

> Hazlo **primero**, aunque estés en la oficina: así los documentos estarán disponibles en casa.

- [x] Crear en GitHub un repo **público** llamado `nexus`, **sin** README, sin .gitignore y sin licencia (ya los tenemos).
- [x] En local, dentro de la carpeta `nexus/` con estos ficheros:

```bash
git init -b main
git add -A
git commit -m "docs: add project guidelines, architecture and roadmap"
git remote add origin https://github.com/<tu-usuario>/nexus.git
git push -u origin main
```

- [x] Comprobar en GitHub que están `AGENTS.md`, `docs/`, `openspec/config.yaml`, `.gitignore`, `.gitattributes` y `.dev.vars.example`.

### 0.2 · Herramientas (en **cada** equipo — ver "Preparar un equipo nuevo")

- [x] Equipo de la oficina preparado
- [ ] Equipo de casa preparado

### 0.3 · Cuenta de Cloudflare

- [x] Cuenta creada (o la existente) y sesión iniciada en el dashboard.
- [x] Elegido el subdominio `workers.dev` (Workers & Pages → tu subdominio). La URL final será `nexus.<subdominio>.workers.dev`.
- [x] Zero Trust activado con el **plan Free** (te pedirá un nombre de equipo: `<equipo>.cloudflareaccess.com`). Apuntar ese nombre aquí: `juanmazh.cloudflareaccess.com`

### 0.4 · Bot de Telegram

- [ ] En Telegram, hablar con `@BotFather` → `/newbot` → guardar el **token** en tu gestor de contraseñas (nunca en el repo).
- [ ] Enviarle cualquier mensaje a tu bot nuevo.
- [ ] Abrir `https://api.telegram.org/bot<TOKEN>/getUpdates` en el navegador y copiar `message.chat.id` → gestor de contraseñas.
- [ ] Crear `.dev.vars` a partir de `.dev.vars.example` con esos valores (en cada equipo).

### 0.5 · OpenSpec

- [ ] Ejecutar en la raíz del repo: `openspec init` (elige **OpenCode** como herramienta y español si te pregunta el idioma).
- [ ] Fusionar `openspec/config.yaml`: conserva las claves que añadió `init` y deja nuestro `schema`, `context` y `rules`.
- [ ] `git diff`: si `init` añadió un bloque gestionado a `AGENTS.md`, déjalo **al final** del fichero y comprueba que nuestras secciones siguen intactas.
- [ ] Commit: `chore(openspec): initialize openspec for opencode`.

### 0.6 · OpenCode y modelos

- [ ] `opencode auth login` → OpenRouter (en cada equipo).
- [ ] Poner un **límite de crédito** en OpenRouter.
- [ ] Crear `opencode.json` en la raíz con los modelos elegidos (ver "Modelos en uso"), commit y push.

### 0.7 · Proteger `main` (después del cambio 0.1, cuando exista la CI)

- [ ] GitHub → Settings → Branches → regla para `main`: exigir PR y que pase la CI, y prohibir force push.

---

## Cambios de OpenSpec

Leyenda: ⬜ pendiente · 🟡 en curso · 👀 en revisión · ✅ hecho y desplegado

| # | change-id | Estado | Rama / PR | Pasos manuales asociados |
|---|---|---|---|---|
| 0.1 | `bootstrap-project` | ⬜ | | Crear la D1: `pnpm wrangler d1 create nexus-db` y pegar el `database_id` en `wrangler.jsonc`. Primer `pnpm deploy` |
| 0.2 | `add-access-auth` | ⬜ | | Activar Cloudflare Access en el Worker `nexus` (Workers & Pages; protege producción **y** previews), permitir solo tu email, copiar el **AUD tag** de la aplicación creada (Zero Trust → Access → Applications) → `pnpm wrangler secret put ACCESS_AUD` |
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
- [ ] **Git** configurado con tu nombre y email; en Windows, `git config --global core.autocrlf false` (el `.gitattributes` fuerza LF).
- [ ] **OpenSpec CLI**: `npm install -g @fission-ai/openspec@latest`.
- [ ] **OpenCode** instalado y `opencode auth login` con OpenRouter.
- [ ] Clonar: `git clone https://github.com/<tu-usuario>/nexus.git`.
- [ ] `pnpm install` (cuando exista `package.json`, desde el cambio 0.1).
- [ ] `pnpm wrangler login` (desde el cambio 0.1).
- [ ] Copiar `.dev.vars` desde el gestor de contraseñas.
- [ ] `pnpm db:migrate:local` y `pnpm dev` → la app arranca.

---

## 🤖 Modelos en uso

| Rol | Modelo (id de OpenRouter) | Desde | Notas |
|---|---|---|---|
| Planificación (`explore` / `propose`) | `__________` | | Modelo fuerte, de razonamiento alto |
| Implementación (`apply`) | `__________` | | Bueno en código y económico |
| Escalado / depuración difícil | `__________` | | |

---

## 📓 Bitácora (lo más reciente arriba)

Una línea por sesión: fecha · lugar · qué se hizo · siguiente paso.

- **2026-10-07 · oficina** — Mobile-first como pilar: nuevo `docs/DESIGN.md`, cambio `add-app-shell` (0.3), PWA adelantada a la fase 1 (1.3) y Playwright con viewports móvil/escritorio en CI (ADR-008).
- **2026-10-07 · oficina** — Definidas las directrices (AGENTS.md, ARCHITECTURE, ROADMAP, WORKFLOW, config de OpenSpec). Decisiones: nombre Nexus, idioma mixto, React + TS, avisos por Telegram, dominio aplazado a la fase 3. → Siguiente: paso 0.1.

---

## ❓ Decisiones pendientes

- Nombre del dominio para la fase 3 (`nexus` estará cogido en casi todos los TLD; valorar algo como `juanmazh.dev`, con Nexus en una ruta o subdominio).
- Licencia del repo (MIT si quieres que sea reutilizable; sin licencia si solo quieres enseñarlo).
