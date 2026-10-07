# Roadmap — Nexus

> Cada fase se divide en **cambios de OpenSpec** pequeños (un cambio = una rama = un PR).
> El estado real de cada cambio se lleva en `docs/PROGRESS.md`; este documento define **qué** y **en qué orden**.
>
> Regla de oro: no se empieza una fase hasta que la anterior está desplegada y usándose.
> Lo que no se usa a diario no merece la siguiente funcionalidad.

---

## Fase 0 — Cimientos (sin funcionalidad visible)

**Objetivo:** un Worker desplegado en `workers.dev`, protegido por Access, con CI y la base técnica lista.
**Coste:** 0 €.

| # | change-id | Qué entrega |
|---|---|---|
| 0.1 | `bootstrap-project` | Scaffold React + Vite + Worker + Hono, Tailwind + shadcn/ui, Biome, Vitest, scripts de `AGENTS.md §4`, D1 creada y enlazada, `GET /api/health`, CI (lint + typecheck + test + build) |
| 0.2 | `add-access-auth` | Middleware de validación del JWT de Access en `/api/*` (fail closed), cabeceras de seguridad, manejador de errores central, `GET /api/me` |
| 0.3 | `add-app-shell` | **Shell mobile-first** de `docs/DESIGN.md`: tab bar inferior / barra lateral, barra de captura (sin lógica aún), `ResponsiveDialog`, tema "olivar" claro y oscuro, fuentes, safe areas y Playwright con viewports móvil y escritorio en la CI |

<details>
<summary>Prompt para <code>/opsx:propose bootstrap-project</code></summary>

```text
Crea el andamiaje inicial de Nexus siguiendo AGENTS.md y docs/ARCHITECTURE.md:
un único Worker con static assets (Vite + @cloudflare/vite-plugin), SPA React 19 + TS strict,
Hono montado en /api/*, Tailwind + shadcn/ui inicializado, Biome, Vitest (con
@cloudflare/vitest-pool-workers para el Worker), Drizzle configurado contra D1 (binding DB,
base de datos nexus-db, sin tablas todavía), y todos los scripts de AGENTS.md §4.
Comportamiento observable: GET /api/health devuelve 200 con { status: "ok" } y la SPA muestra
una página mínima que consulta ese endpoint. El meta viewport ya es el de docs/DESIGN.md §4
(width=device-width, initial-scale=1, viewport-fit=cover; sin bloquear el zoom).
Incluye un workflow de GitHub Actions que ejecute lint, typecheck, test y build en cada PR.
Fuera de alcance: autenticación, tablas de negocio, layout y diseño visual (van en add-app-shell),
despliegue automático.
```
</details>

<details>
<summary>Prompt para <code>/opsx:propose add-access-auth</code></summary>

```text
Añade la capa de autenticación descrita en ADR-002: un middleware en worker/middleware/access.ts
que proteja todas las rutas /api/* salvo /api/health, validando el JWT de la cabecera
Cf-Access-Jwt-Assertion (firma con las claves públicas del equipo de Access, aud = secreto
ACCESS_AUD, iss = https://<ACCESS_TEAM_DOMAIN>, expiración), con caché de las claves y política
fail closed (401 con { error: { code, message } }). Añade el manejador central de errores,
cabeceras de seguridad y GET /api/me, que devuelve el email del JWT.
Los tests deben cubrir: sin cabecera, firma inválida, aud incorrecto, token expirado y token válido.
Fuera de alcance: roles, varios usuarios, login propio.
```
</details>

<details>
<summary>Prompt para <code>/opsx:propose add-app-shell</code></summary>

```text
Construye el shell de la aplicación siguiendo docs/DESIGN.md (§3 estructura, §4 reglas móviles,
§5 dirección visual). Diseña primero a 360 px y después amplía.
Móvil (< lg): barra superior mínima con el título de la vista, tab bar inferior (Hoy, Tareas,
Notas, Más) y, encima, la barra de captura (de momento solo la UI: input con enterkeyhint="send"
y botón; sin persistencia). Escritorio (≥ lg): barra lateral con las mismas secciones y la barra
de captura en la cabecera, enfocable con la tecla N. Rutas vacías para cada sección, con su
estado vacío. Componente ResponsiveDialog (Drawer de shadcn en móvil, Dialog en escritorio).
Tema "olivar" claro y oscuro como tokens CSS de shadcn (sigue el sistema, con conmutador),
fuentes self-hosted (Bricolage Grotesque y Atkinson Hyperlegible Next), safe areas, dvh,
áreas táctiles ≥ 44 px y toasts arriba en móvil.
Añade Playwright con dos proyectos (móvil 360x780 y escritorio 1280x800) y tests para cada ruta:
sin scroll horizontal, navegación visible y usable, y barra de captura visible sin hacer scroll.
Inclúyelo en la CI.
Fuera de alcance: lógica de tareas, PWA, animaciones más allá de abrir y cerrar sheets.
```
</details>

---

## Fase 1 — MVP: tareas y recordatorios ⭐

**Objetivo:** usar Nexus a diario para las tareas y recibir avisos por Telegram.
**Coste:** 0 €.

| # | change-id | Qué entrega |
|---|---|---|
| 1.1 | `add-tasks` | Tabla `tasks`, CRUD `/api/tasks`, filtros (pendientes / hechas / vencidas), vista de lista en la SPA con crear, editar, completar y borrar |
| 1.2 | `add-reminders` | Tabla `reminders`, crear y cancelar recordatorios de una tarea, cron cada 5 minutos y envío por Telegram con reintentos |
| 1.3 | `add-pwa` | **Instalable en el móvil:** manifest, iconos, `display: standalone`, `theme-color` por tema y service worker que cachea solo la shell |

<details>
<summary>Prompt para <code>/opsx:propose add-tasks</code></summary>

```text
Implementa la gestión de tareas según el modelo de datos de docs/ARCHITECTURE.md §4 (tabla tasks).
API: GET /api/tasks (filtro status=todo|done y overdue=true; orden por due_at con nulos al final),
POST /api/tasks, PATCH /api/tasks/:id, DELETE /api/tasks/:id. Al pasar a done se rellena
completed_at; al volver a todo se limpia. Validación con schemas Zod en shared/.
UI (mobile-first según docs/DESIGN.md): lista en filas con secciones Vencidas / Hoy / Próximas /
Sin fecha. La barra de captura del shell crea la tarea (título; la fecha se añade después) con
actualización optimista. Tocar una fila abre el detalle en ResponsiveDialog (bottom sheet en
móvil) para editar título, notas, prioridad y fecha (input nativo). Completar con un toque en el
check (área de 44 px o más); borrar desde el detalle, con confirmación. Fechas en Europe/Madrid.
Estados de carga (skeleton), vacío y error. Tests de Playwright del flujo crear → completar en
móvil y en escritorio.
Fuera de alcance: recordatorios, etiquetas, subtareas, repetición.
```
</details>

<details>
<summary>Prompt para <code>/opsx:propose add-reminders</code></summary>

```text
Implementa los recordatorios según docs/ARCHITECTURE.md §3.2 y §4 (tabla reminders).
API: GET /api/tasks/:id/reminders, POST /api/tasks/:id/reminders (remind_at en el futuro; si no,
400), DELETE /api/reminders/:id (pasa a cancelled). Completar una tarea cancela sus recordatorios
pendientes. Job en worker/jobs/reminders.ts disparado por el cron */5 * * * *: lote máximo de 20,
envío por Telegram (worker/integrations/telegram.ts, secretos TELEGRAM_BOT_TOKEN y
TELEGRAM_CHAT_ID), resultados en un único db.batch(), máximo 3 intentos y después failed.
Mensaje: título de la tarea, fecha límite en Europe/Madrid y prioridad.
UI: en el detalle de la tarea (bottom sheet en móvil), añadir recordatorio con chips de atajo
grandes ("En 1 h", "Esta tarde 18:00", "Mañana 9:00") y un input nativo datetime-local para el
resto; ver los pendientes y cancelarlos.
Tests del job con Telegram simulado: éxito, fallo con reintento, tercer fallo → failed, lote limitado a 20.
Fuera de alcance: email, recordatorios recurrentes, recordatorios sin tarea.
```
</details>

<details>
<summary>Prompt para <code>/opsx:propose add-pwa</code></summary>

```text
Haz Nexus instalable como PWA para usarlo desde la pantalla de inicio del móvil: web app manifest
(nombre, short_name, start_url "/", display standalone, background_color y theme_color según el
tema "olivar"), iconos (192, 512 y maskable, más apple-touch-icon) y un service worker que cachee
solo la shell estática (nunca respuestas de /api/*), con estrategia de actualización segura
(nueva versión → aviso "Hay una versión nueva" con botón para recargar).
En modo standalone, la app respeta las safe areas y no muestra elementos que dependan de la barra
del navegador. Verifica la instalación en Android (Chrome) e iOS (Safari, "Añadir a pantalla de inicio").
Fuera de alcance: modo offline con datos, notificaciones push web (los avisos siguen por Telegram).
```
</details>

**Hito:** despliegue en producción y **una semana de uso real desde el móvil** antes de empezar la fase 2.

---

## Fase 2 — Notas, enlaces y página de inicio

| # | change-id | Qué entrega |
|---|---|---|
| 2.1 | `add-notes` | Notas en Markdown con búsqueda por título y contenido, y fijar notas |
| 2.2 | `add-quick-links` | Enlaces rápidos con título, URL, categoría y orden manual |
| 2.3 | `add-home-dashboard` | Inicio con resumen: tareas de hoy y vencidas, próximos recordatorios, notas fijadas y enlaces |

---

## Fase 3 — Dominio propio y blog público 💶 (~10 €/año)

**Requisito manual previo:** comprar el dominio (Cloudflare Registrar) — ver `docs/PROGRESS.md`.

| # | change-id | Qué entrega |
|---|---|---|
| 3.1 | `move-to-custom-domain` | Custom Domain para el Worker; Access por ruta (`/admin/*`, `/api/*`); la SPA pasa a vivir bajo `/admin` |
| 3.2 | `add-blog` | Entradas en Markdown (borrador/publicada), editor en `/admin`, páginas públicas `/blog` y `/blog/:slug` renderizadas en el Worker con HTML saneado, metadatos SEO, RSS y sitemap |
| 3.3 | `add-email-channel` | (Opcional) recordatorios y resumen diario por email vía Email Routing a dirección verificada |

---

## Fase 4 — Finanzas y gráficas

| # | change-id | Qué entrega |
|---|---|---|
| 4.1 | `add-finance-transactions` | Ingresos y gastos con categorías, importes en céntimos (integer) y filtros por mes |
| 4.2 | `add-finance-charts` | Gráficas mensuales por categoría y evolución del saldo |

---

## Fase 5 — Calendario

| # | change-id | Qué entrega |
|---|---|---|
| 5.1 | `add-calendar-view` | Vista de agenda por días en móvil (lista con scroll) y vistas semanal y mensual en escritorio, con tareas y recordatorios |

---

## Backlog (sin compromiso)

- Tareas recurrentes y etiquetas.
- Exportación e importación de datos (JSON).
- Backup automático de D1 a R2 o a un artefacto de GitHub Actions.
- Modo offline con datos y cola de cambios pendientes (sincroniza al volver la conexión).
- Bot de Telegram bidireccional: crear tareas escribiéndole al bot (requiere webhook público y su propia validación de seguridad).
