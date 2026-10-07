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

<details>
<summary>Prompt para <code>/opsx:propose bootstrap-project</code></summary>

```text
Crea el andamiaje inicial de Nexus siguiendo AGENTS.md y docs/ARCHITECTURE.md:
un único Worker con static assets (Vite + @cloudflare/vite-plugin), SPA React 19 + TS strict,
Hono montado en /api/*, Tailwind + shadcn/ui inicializado, Biome, Vitest (con
@cloudflare/vitest-pool-workers para el Worker), Drizzle configurado contra D1 (binding DB,
base de datos nexus-db, sin tablas todavía), y todos los scripts de AGENTS.md §4.
Comportamiento observable: GET /api/health devuelve 200 con { status: "ok" } y la SPA muestra
una página de inicio vacía con el layout base (navegación preparada para móvil).
Incluye un workflow de GitHub Actions que ejecute lint, typecheck, test y build en cada PR.
Fuera de alcance: autenticación, tablas de negocio, despliegue automático.
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

---

## Fase 1 — MVP: tareas y recordatorios ⭐

**Objetivo:** usar Nexus a diario para las tareas y recibir avisos por Telegram.
**Coste:** 0 €.

| # | change-id | Qué entrega |
|---|---|---|
| 1.1 | `add-tasks` | Tabla `tasks`, CRUD `/api/tasks`, filtros (pendientes / hechas / vencidas), vista de lista en la SPA con crear, editar, completar y borrar |
| 1.2 | `add-reminders` | Tabla `reminders`, crear y cancelar recordatorios de una tarea, cron cada 5 minutos y envío por Telegram con reintentos |

<details>
<summary>Prompt para <code>/opsx:propose add-tasks</code></summary>

```text
Implementa la gestión de tareas según el modelo de datos de docs/ARCHITECTURE.md §4 (tabla tasks).
API: GET /api/tasks (filtro status=todo|done y overdue=true; orden por due_at con nulos al final),
POST /api/tasks, PATCH /api/tasks/:id, DELETE /api/tasks/:id. Al pasar a done se rellena
completed_at; al volver a todo se limpia. Validación con schemas Zod en shared/.
UI: lista de tareas con secciones Vencidas / Hoy / Próximas / Sin fecha, alta rápida
(título + fecha opcional), edición en un diálogo, completar con un clic, borrar con confirmación.
Fechas mostradas en Europe/Madrid. Estados de carga, vacío y error. Usable en móvil.
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
UI: en el diálogo de la tarea, añadir recordatorio (fecha y hora, más atajos "en 1 h",
"mañana 9:00"), ver los pendientes y cancelarlos.
Tests del job con Telegram simulado: éxito, fallo con reintento, tercer fallo → failed, lote limitado a 20.
Fuera de alcance: email, recordatorios recurrentes, recordatorios sin tarea.
```
</details>

**Hito:** despliegue en producción y una semana de uso real antes de empezar la fase 2.

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

## Fase 5 — Calendario y experiencia móvil

| # | change-id | Qué entrega |
|---|---|---|
| 5.1 | `add-calendar-view` | Vista mensual y semanal de tareas con fecha y recordatorios |
| 5.2 | `add-pwa` | Instalable en el móvil (manifest + service worker para la shell) |

---

## Backlog (sin compromiso)

- Tareas recurrentes y etiquetas.
- Exportación e importación de datos (JSON).
- Backup automático de D1 a R2 o a un artefacto de GitHub Actions.
- Bot de Telegram bidireccional: crear tareas escribiéndole al bot (requiere webhook público y su propia validación de seguridad).
