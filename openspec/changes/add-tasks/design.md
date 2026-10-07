# Design

## Context

Estado actual, solo lo que condiciona el diseño:

- `worker/db/schema.ts` es `export {}`: **no hay ninguna tabla** y `migrations/` solo tiene `.gitkeep`.
  Esta es la primera migración y la primera vez que D1 lee o escribe algo.
- **No hay Zod instalado.** `AGENTS.md §2` lo fija como capa de validación y `package.json` no lo
  tiene porque hasta ahora no había nada que validar: `health.ts` y `me.ts` no reciben entrada.
  `@hono/zod-validator` tampoco.
- **No hay `date-fns` ni `@date-fns/tz` instalados**, pese a estar en `AGENTS.md §2`. Hoy las fechas
  se formatean con `Intl.DateTimeFormat` en línea (`today-page.tsx`, `now-marker.tsx`).
- `shared/` está vacío. Los alias `@shared/*` ya están en los cuatro `tsconfig`, en `vite.config.ts`
  y en `vitest.web.config.ts`: no hay que tocar la configuración.
- `CaptureBar` ya expone `onSubmit?: (text: string) => void` y hoy nadie se lo pasa. El input es
  **no controlado**, con `id="captura"` fijo, y se vacía a mano en su propio `onSubmit` interno.
- `AppShell` monta **dos** `CaptureBar` (móvil abajo, escritorio en la cabecera), los dos sin
  `onSubmit`.
- `ResponsiveDialog` ya resuelve `Drawer`/`Dialog` por viewport y expone `title`, `description`,
  `actions` y `children`; la rama `Drawer` ya trae `px-4`, scroll propio y el pie con safe-area.
- `worker/app.ts` encadena `onError` → `notFound` → `securityHeaders` → `access` → rutas, y el
  `AppType` del cliente RPC es el tipo de la cadena `routes`: añadir una ruta es **una** línea.
- `middleware/errors.ts` no mapea `HTTPException`; los errores se construyen a mano con `errorBody()`.
  La única ruta con `405` es `health.ts`, que la implementa como un `.use("*")`, no como un `.all()`,
  porque `.get()` + `.all()` en la misma ruta colapsa `$get` a `never` en el cliente RPC.
- Los tests del Worker usan `app.fetch(req, testEnv())`, y **`testEnv()` no incluye `DB`**. Para
  probar rutas con base de datos hay que pasar el `env` real de `cloudflare:test`, que sí trae
  `env.DB` (ya lo comprueba `health.test.ts`).
- `e2e/fixtures.ts` responde `{ status: "ok" }` a **todo** `/api/**` que no sea `/api/me`: sin una
  rama para `/api/tasks`, los tests de la lista no pueden afirmar nada.
- No existen `ui/input.tsx`, `ui/label.tsx`, `ui/textarea.tsx` ni `ui/checkbox.tsx`. Los controles de
  formulario del proyecto son `<input>` escritos a mano con Tailwind (véase `capture-bar.tsx`).

## Goals / Non-Goals

**Goals:**

- Dejar modelo, CRUD y vista de tareas en una forma que `add-reminders` pueda reutilizar tal cual
  (índice por `(status, due_at)`, `completed_at` para el interruptor de completadas).
- Que el cálculo de "qué día es esta tarea" esté en **una** función pura, testeable sin DOM y sin red:
  es donde el cambio de hora de verano puede colarse sin que nada se entere.
- Una query por lectura de lista, sin N+1, y una escritura por fila mutada.
- Que el primer contacto con la base de datos real venga con tests contra **D1 de verdad**, no contra
  un doble: los fallos que hay que cazar (fechas como texto, `NULL` ordenando primero) solo aparecen
  en SQLite.

**Non-Goals:**

- Lógica de recordatorios, aunque la tabla y el servicio se dejen con la forma que las necesitará.
- Concurrencia optimista con `updated_at` en el `WHERE`. Es una app de un usuario en un dispositivo;
  el `updated_at` es información, no un mecanismo de bloqueo.
- Edición del título dentro de la lista (solo en el detalle) y gestos de *swipe* para completar:
  `docs/DESIGN.md §4` exige botón visible para cada acción, y el gesto es una mejora posterior.
- Controles de filtro en la vista (los chips). La API los soporta y los testea; la UI llega con
  `add-home-dashboard`, que es quien de verdad los necesita.

## Decisions

### D1 · El cambio no se aplica hasta que `add-app-shell` esté archivado

**Qué.** `add-tasks` espera a que `add-app-shell` esté mergeado y archivado, de modo que
`openspec/specs/app-shell/spec.md` exista.

**Por qué.** Este cambio modifica el requisito *Barra de captura* de `app-shell`. Una delta
`MODIFIED` necesita el bloque original literal para que el archivado aplique bien, y ese bloque solo
existe cuando el cambio que lo introduce está archivado. `AGENTS.md §7.4` prohíbe editar
`openspec/specs/` a mano. Además los dos cambios tocan `capture-bar.tsx`, `app-shell.tsx` y
`tasks-page.tsx`: solaparlos produce conflictos en el mismo PR, contra `AGENTS.md §7.1`.

**Alternativas.** (a) Escribir el delta en fase de apply, cuando el requisito sea escribible →
`openspec validate add-tasks` en rojo durante todo el apply. (b) Crear una capacidad `task-capture`
nueva en vez de modificar `app-shell` → dos capacidades describiendo el mismo comportamiento.
Descartadas: la dependencia explícita es más barata que la incoherencia.

**Consecuencia.** `docs/PROGRESS.md` ya marca `add-app-shell` como listo para archivo, así que la
espera es de un PR, no de trabajo.

### D2 · Esquema: una tabla, dos índices, `due_at` en UTC

```ts
// worker/db/schema.ts
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable(
	"tasks",
	{
		id: text("id").primaryKey(),
		title: text("title").notNull(),
		notes: text("notes"),
		status: text("status", { enum: ["todo", "done"] }).notNull().default("todo"),
		priority: text("priority", { enum: ["low", "medium", "high"] })
			.notNull()
			.default("medium"),
		due_at: integer("due_at", { mode: "number" }),
		completed_at: integer("completed_at", { mode: "number" }),
		created_at: integer("created_at", { mode: "number" }).notNull(),
		updated_at: integer("updated_at", { mode: "number" }).notNull(),
	},
	(t) => [
		// Cubre la lectura dominante: pendientes ordenadas por vencimiento.
		index("tasks_status_due_at_idx").on(t.status, t.due_at),
		// El interruptor "Hechas" filtra por estado y ordena por completado: con
		// `status` delante, el índice sirve al WHERE y al ORDER BY a la vez.
		index("tasks_status_completed_at_idx").on(t.status, t.completed_at),
	],
);
```

Es `docs/ARCHITECTURE.md §4` literal, con **un** índice añadido. La migración **no es destructiva**:
`CREATE TABLE` más dos `CREATE INDEX` sobre una base vacía, y no toca ninguna tabla existente.

**Por qué el segundo índice.** `tasks_status_due_at_idx` sirve a la lista de pendientes y al filtro
`overdue`. El interruptor "Hechas" hace `WHERE status='done' ORDER BY completed_at DESC` y además
necesita el **número** de completadas para la etiqueta del interruptor; sin índice por `completed_at`
eso es un recorrido de todas las completadas en cada carga de la lista. Un usuario con 500 tareas
completadas paga 500 filas leídas por abrir la app. El coste del índice son escrituras
(`AGENTS.md §8`): en un `UPDATE` de una tarea cambia `status`, `due_at` o `completed_at` y ambos
índices se actualizan. Sigue siendo 2 índices para 2 consultas ordenadas, que es lo que cuesta
mantener el orden de ambas.

**Por qué no un `CHECK` en la base.** Los `enum` de Drizzle son de TypeScript, no del esquema. La
defensa real es Zod en la frontera (`D4`); no hay ningún `INSERT` fuera de la API.

**Por qué no `deleted_at`.** Borrar es borrar (`proposal.md`). Una columna más, un índice más y una
condición en cada consulta para un caso que no existe.

### D3 · Las cuatro dependencias, y por qué no basta lo que hay

**Qué.** `pnpm add zod @hono/zod-validator date-fns @date-fns/tz`.

| Dependencia | Por qué no basta lo que ya hay |
|---|---|
| `zod` | Es la capa de validación de `AGENTS.md §2`, y `§5` la exige en **toda** entrada. `errorBody()` solo formatea errores: no valida nada. Sin Zod, cada ruta repite `if`s a mano y el formulario del detalle no tiene un esquema con el que validar. |
| `@hono/zod-validator` | Convierte el resultado en `c.req.valid()` ya tipado y evita escribir el manejo de `ZodError` en cada ruta. Es lo que hace el `400` con la forma del proyecto (`D5`). |
| `date-fns` + `@date-fns/tz` | Agrupar por día y convertir el `YYYY-MM-DD` del input nativo a un instante UTC exige ir y volver de "día civil ↔ instante en `Europe/Madrid`". `Intl` formatea bien pero no tiene API estándar para el sentido inverso, y trocear `toLocaleDateString("en-CA")` devuelve `null` silencioso en navegadores sin soporte de `timeZoneName`: un `null` callado en la sección "Hoy" es justo el bug que después cuesta una hora de depuración. |

**Ya están aprobadas.** Las cuatro están nombradas en `AGENTS.md §2`; instalarlas no amplía el stack,
cumple el que ya estaba escrito. `AGENTS.md §6.7` solo obliga a justificarlas, y esta tabla es la
justificación.

**Alternativas descartadas.** `@js-temporal/polyfill`: más correcto y más pesado, y otra dependencia
para lo mismo. `z.coerce.boolean()` para `overdue`: convierte `"no"` en `true`, que es la clase de bug
que un filtro mal interpretado convierte en "¿por qué no me sale lo que pedí?". Se usa la versión
mayor que resuelva el lockfile, sin asumir API que no exista en `node_modules` tras instalar.

**Coste en el bundle.** `date-fns` es *tree-shakeable por función*: importando solo `format`,
`isSameDay`, `isBefore` y `TZDate`, la vista de tareas añade del orden de 6–8 kB comprimidos. La carga
inicial está hoy en 135,63 kB comprimidos (`docs/PROGRESS.md`), así que el presupuesto de 200 kB
(`docs/DESIGN.md §4`) queda con margen de sobra, y la lista de tareas ya viaja en su propio chunk por
el `lazy()` del router, así que **no entra en la carga inicial**. `pnpm build` lo mide y es tarea de
`tasks.md`.

### D4 · `shared/tasks.ts` con los esquemas; los tipos de respuesta salen del Worker

**Qué.** `shared/tasks.ts` exporta `createTaskSchema`, `updateTaskSchema`, `listTasksQuerySchema`,
`taskIdParamSchema`, los enums `TASK_STATUSES` / `TASK_PRIORITIES` y las funciones de conversión de
fecha de `D8`.

**Por qué.** `AGENTS.md §3` manda que lo que comparten front y Worker viva en `shared/`, y `§5` que
el front valide los formularios con **los mismos** esquemas: el formulario del detalle importa
`updateTaskSchema` y muestra sus mensajes en español, y el Worker importa el mismo fichero para el
`400`. Una sola fuente, imposible que se desincronicen.

**Los tipos de salida no se declaran a mano.** La fila se tipa con `InferSelectModel<typeof tasks>` y
el cuerpo de la respuesta se deriva con `InferResponseType<typeof client.api.tasks.$get>` (ADR-007),
igual que `use-session.ts` y `features/health/api.ts`. La API devuelve la fila con los mismos
nombres, así que **no hace falta un esquema de salida**: un `taskResponseSchema` del que nadie valida
en el Worker sería una segunda fuente de verdad que además no se comprueba.

### D5 · El `400` con la forma del proyecto, sin tocar el manejador central

`@hono/zod-validator` lanza `HTTPException(400)` con su **propia** forma, y el `onError` de
`middleware/errors.ts` responde `500` a todo lo que le llega. Este proyecto tiene una forma única
(`api-health`, *Forma única de error*) y respetarla no es opcional.

**Decisión.** No se toca `onError`. `worker/routes/tasks.ts` monta un `validator` propio de tres
líneas:

```ts
const jsonBody = <T extends z.ZodType>(schema: T) =>
	validator("json", schema, (result, c) =>
		result.success
			? undefined
			: c.json(errorBody("validation_error", firstIssueMessage(result.error)), 400),
	);
```

y sus equivalentes `query` y `param`. El `400` sale con la forma del proyecto desde la primera ruta.

**Por qué no mapear `HTTPException` en `onError`.** Sería mejor a medio plazo — una sola ruta en vez
de tres helpers — pero **cambia el comportamiento observable de cualquier error HTTP del Worker**, y
eso pertenece a la capacidad `api-health`: tocarlo aquí obligaría a una delta de `api-health` en este
cambio, que es justo lo que un cambio de la Fase 1 no debería hacer. Se anota como deuda para cuando
llegue la segunda ruta validada (`add-reminders`).

### D6 · `404` en `PATCH`/`DELETE`: una sola query

`services/tasks.ts` hace `UPDATE ... WHERE id = ? RETURNING *` y `DELETE ... WHERE id = ? RETURNING id`.
En SQLite, `RETURNING` devuelve **las filas que casan con el `WHERE`**, hayan cambiado sus valores o
no: un `PATCH` con un cuerpo idéntico al estado actual devuelve la fila igual. Por tanto "cero filas"
significa exactamente "no existe", y la ruta responde `404` sin una segunda consulta.

**Por qué importa dejarlo escrito.** La primera versión de este diseño suponía que un `PATCH`
idempotente devolvería cero filas y respondería `404` por error. No es así, y un test lo fija:
`PATCH` con los mismos valores responde `200` con la fila.

### D7 · Consultas: una por lectura, y los `NULL` al final son explícitos

**Qué.** `listTasks` monta **una** consulta con `where` y `orderBy` variables según los filtros:

```ts
// pendientes (por defecto): sin fecha al final, luego por vencimiento
where(eq(status, "todo")).orderBy(sql`${tasks.due_at} is null`, asc(tasks.due_at), asc(tasks.created_at))
// vencidas
where(eq(status, "todo"), isNotNull(due_at), lt(due_at, startOfToday)).orderBy(asc(tasks.due_at))
// startOfToday = zonedDayStart(now, env.APP_TIMEZONE)
// completadas
where(eq(status, "done")).orderBy(desc(tasks.completed_at))
```

**Por qué el `is null` explícito.** En SQLite un `ORDER BY col ASC` coloca los `NULL` **primero**, no
al final: `NULL` ordena antes que cualquier número. Sin ese primer criterio, "Sin fecha" aparecería
encima de "Vencidas" y la lista empezaría por lo que no vence nunca. Es el tipo de detalle que en
local con tres tareas no se ve y en producción rompe la sección entera.

**Por qué `startOfToday` y no `now`.** `due_at` guarda las **00:00** del día elegido (`D8`). Con
`lt(due_at, now)`, una tarea que vence hoy contaría como vencida desde las 00:01, y la API diría
"vencida" mientras la vista la pone en **Hoy**. La regla es la de la spec: vencida es la de un día
**anterior** al de hoy en `Europe/Madrid`. El Worker usa `env.APP_TIMEZONE` y la misma
`zonedDayStart` de `shared/dates.ts` que usa el front, así que API y vista no pueden discrepar.

**Por qué `overdue` en SQL y no en el front.** El panel de Hoy de `add-home-dashboard` (2.3) quiere
`GET /api/tasks?overdue=true` para el resumen y `?status=done` para el recuento, **sin** traer todas
las pendientes para filtrarlas en el cliente. Cada fila devuelta es una fila leída (`AGENTS.md §8`).

**Por qué no paginar.** Un usuario con una lista de tareas cabe de sobra en el límite de respuesta.
Añadir `limit`/`cursor` sin necesitarlos es un `LIMIT` que hay que acordarse en cada consulta nueva.
Deuda anotada, no olvidada: el criterio para añadirlo es que la lista supere el comfort de scroll
(unas 300 tareas).

### D8 · El día de una tarea se calcula en el front, en funciones puras y compartidas

**Qué.** `shared/dates.ts` exporta, todas puras y sin DOM:

- `zonedDayStart(now: Date, tz: string): number` → epoch ms del inicio del día local de `tz`.
- `zonedDayNumber(ms: number, tz: string): number` → el día local como `yyyymmdd`, comparable con `>`.
- `dueDateToEpochMs(value: string, tz: string): number | null` → `YYYY-MM-DD` → epoch ms de las
  **00:00 de ese día en `tz`**.
- `epochMsToDueDate(ms: number | null, tz: string): string | null` → el inverso para el input nativo.

**Por qué `zonedDayNumber` en vez de comparar instantes.** El requisito es "esta tarea pertenece a hoy
según el reloj de `Europe/Madrid`", y ese reloj cambia: el 29 de marzo de 2026 el día tiene 23 horas
y el 25 de octubre, 25. Comparar dos días con dos `startOfDay` funciona, pero comparar días exige una
clave estable. `20260329` como número se compara y se serializa, y evita arrastrar la aritmética de
DST a los componentes.

**Por qué 00:00 y no 23:59.** El detalle pide una **fecha**, no fecha y hora (`docs/DESIGN.md §4`
exige inputs nativos de fecha). Las 00:00 del día elegido son la convención que menos sorprende:
"venció el martes" sigue siendo cierto todo el martes, en vez de caducar a medianoche. Si algún día
hace falta la hora, se añade un `datetime-local` en el mismo sitio y **el modelo no cambia**:
`due_at` ya es un instante.

**Por qué en `shared/` y no en el componente.** Es aritmética de huso con una respuesta equivocada
silenciosa si se duplica: el front y los tests tienen que convertir **igual**. Se testea en el
proyecto `web` y en el `worker` con los mismos casos, y el día del cambio de hora de verano es un caso
fijo del fichero de tests, no uno que dependa de cuándo corra el test.

**Zona horaria.** La constante vive en `src/lib/datetime.ts` con `"Europe/Madrid"` como valor por
defecto y el valor de `APP_TIMEZONE` de `wrangler.jsonc` cuando esté disponible. Si algún día se
sustituye el despliegue por otro, se cambia **un** sitio y no los componentes.

### D9 · La API devuelve la lista plana; la vista de `/tasks` la agrupa

**Qué.** `GET /api/tasks?overdue=true` devuelve **solo** las vencidas, ya ordenadas; `GET /api/tasks`
devuelve las pendientes planas. El agrupado en secciones (Vencidas / Hoy / Próximas / Sin fecha) lo
hace `groupTasks(tasks, now, tz)` en `src/features/tasks/group.ts`, pura.

**Por qué las dos cosas.** `overdue` existe para que un consumidor que solo quiere vencidas no
traiga todas las pendientes (`D7`). El agrupado es de **presentación**: en el panel de Hoy (2.3) dos
tareas vencidas no llevan su propia etiqueta "Vencidas". Si la API devolviera secciones, cada
consumidor tendría que desempaquetarlas; si el front no agrupara, la API no podría responder "dame
las vencidas" sin traerlo todo. Son responsabilidades distintas y no se mezclan.

**`groupTasks` recibe `now`.** Sin `now` inyectado, un test de "¿esta tarea es la de hoy?" solo
comprueba el día en el que el test casualmente corre: un test que deja de pasar el día que falla por
otro motivo. Con `now` como parámetro, el cambio de hora de verano y el día en blanco son casos fijos.

### D10 · La barra de captura se conecta en `AppShell`, no en cada página

**Qué.** `AppShell` pasa `onSubmit` a sus dos `CaptureBar` con una mutación compartida. Las páginas
no pasan callbacks: usan un hook (`useCreateTask`).

**Por qué.** El shell ya es quien monta las dos barras y quien decide que su atajo `N` ceda ante la
escritura. Si cada página montara su propia mutación habría dos fuentes de verdad sobre quién
captura, y la barra quedaría sin conectar en cualquier sección nueva.

**El input no controlado manda.** `CaptureBar` hoy vacía el campo en su propio `onSubmit` interno,
después de llamar a `onSubmit?.()`. El estado del texto vive en la mutación de TanStack Query, no en
la barra:

- Si la API responde bien → el texto ya está vacío y la tarea ya está en la lista (optimista).
- Si falla → el `onError` del `useMutation` **devuelve el texto a la barra** y avisa con un `toast`.

**Cómo vuelve el texto.** `CaptureBar` acepta `value?: string` y `onValueChange?: (v: string) => void`
para poder ser controlado cuando hace falta, **sin** convertirlo por defecto en controlado: un input
controlado con un `setState` por pulsación re-renderiza el shell entero en cada tecla, que es lo
contrario de lo que `docs/DESIGN.md §4` pide en rendimiento percibido. El campo sigue no controlado
por defecto; el modo controlado solo se activa cuando hay que reponer el texto.

**No se bloquea el campo mientras guarda.** La barra marca `aria-busy` y el botón se deshabilita solo
durante el envío. Escribir la siguiente tarea mientras la anterior se guarda es el caso normal, y
bloquear el campo sería una molestia diaria.

### D11 · `updateTaskStatus()` es la única fuente del instante de completado

**Qué.** `updateTaskStatus(id, status)` es la **única** función del servicio que escribe
`completed_at`. Nunca se escribe desde el `PATCH` genérico.

**Por qué.** El requisito es simetría exacta: volver a completar una tarea ya completada no cambia el
instante. Si `PATCH /api/tasks/:id` con `{ status: "done" }` escribiera `completed_at = now()` a
todo, la segunda vez **cambiaría** el instante y el requisito se rompería sin que ningún test lo
notase. La lógica va en el `CASE` del propio `UPDATE`:

```sql
UPDATE tasks
SET status = ?,
    completed_at = CASE WHEN ? = 'done' THEN COALESCE(completed_at, ?)
                        WHEN ? = 'todo' THEN NULL
                        ELSE completed_at END,
    updated_at = ?
WHERE id = ?
```

**Por qué `COALESCE`.** Sin él, completar dos veces seguidas mueve el instante; con él, la primera
completación es la que cuenta. El `ELSE completed_at` deja el comportamiento definido para el caso de
un cambio de estado que llegue por otra vía, sin romper la simetría.

### D12 · El orden de la API manda; el front solo agrupa

**Qué.** La lista de `/tasks` se pinta en el orden que devuelve la API, dentro de cada sección.
`groupTasks` **no** reordena.

**Por qué.** `add-home-dashboard` (2.3) reutilizará estas consultas con otros criterios de ordenación
(por ejemplo, por prioridad). Si el front reordenara, tendría que conocer el criterio que la API ya
aplicó, y bastaría con que uno de los dos cambiara para que la vista mostrara un orden que nadie
pidió. Una sola decisión de orden, en un sitio.

**Secundario.** Dentro de las vencidas, el orden por `due_at` ascendente pone la más antigua primero,
que es lo que quiere quien limpia la lista. Entre tareas con la misma fecha manda `created_at`
ascendente: la más antigua primero, que es el orden de una cola de trabajo.

### D13 · `today-page.tsx` no se toca

**Qué.** `TodayPage` sigue con su estado vacío.

**Por qué.** El panel de Hoy es `add-home-dashboard` (2.3). Rellenarlo aquí adelantaría una
funcionalidad distinta y duplicaría el agrupado, y el marcador de "ahora" que ya existe es lo que hace
que esa vista sea la excepción visual de `docs/DESIGN.md §5`: reutilizar la lista de tareas tal cual
la dejaría sin carácter. Se toca en 2.3, cuando la vista de detalle ya esté aprendida.

### D14 · Layout móvil primero (360 px)

Wireframe de `/tasks` a 360 px: `ViewHeader` (título **Tareas** y subtítulo con el recuento de
pendientes), `SkeletonList` mientras carga, la lista y el interruptor al final.

```text
┌──────────────────────────────┐
│ Tareas                       │  ViewHeader, pt-safe-area-inset-top
│ 7 pendientes                 │
├──────────────────────────────┤
│ VENCIDAS                     │  encabezado de sección: 12 px, muted
│ ☐  Llamar al dentista      ✓  │  filas separadas por línea fina
│ ☐  Pagar el alquiler      ✓  │  (no tarjetas, docs/DESIGN.md §5)
│ HOY                          │
│ ☐  Revisar la factura     ✓  │  ✓ = check de completar,
│ PRÓXIMAS                     │      área táctil ≥ 44 × 44 px
│ ☐  Reservar cita          ✓  │      y separada ≥ 8 px
│ SIN FECHA                     │
│ ☐  Comprar café           ✓  │
│ ─────────────────────────── │
│ Hechas (3)                   │  interruptor: fila completa pulsable
└──────────────────────────────┘
```

Cada fila es un `<button>` de ancho completo que abre el detalle y, dentro, alineado a la derecha,
el check de completar como **`<button>` independiente** de 44 × 44 px. El texto va en un `<span>`
dentro del primer botón y no es el botón: si el `<button>` de la fila contuviera el `<button>` del
check, el HTML sería inválido y el área pulsable del check sería impredecible en móvil.

**Ampliación.**

| Ancho | Qué cambia |
|---|---|
| 360–767 px | Todo lo de arriba. Una columna, sin scroll lateral. |
| 768 px (`md`) | Nada nuevo. El ancho extra lo aprovecha el `max-w-2xl` que ya lleva el `<Outlet/>` de `AppShell`. No se añade una segunda columna porque una lista de tareas no es una tabla. |
| ≥ 1024 px (`lg`) | Igual, centrada y con ancho legible; el detalle ya lo resuelve `ResponsiveDialog` como diálogo centrado. La lista **no** se convierte en lista + panel: `docs/DESIGN.md §3` menciona el panel de detalle junto a la lista, pero hacerlo en el mismo cambio que introduce el detalle duplicaría el estado del overlay (qué fila está seleccionada) y añadiría una ruta más. Se hace en 2.3. |

**Reglas de `docs/DESIGN.md` que aplican y cómo.**

| Regla | Cómo se cumple |
|---|---|
| Sin scroll horizontal a 320 px | `min-w-0` en el contenedor de texto de cada fila y `truncate` en el título; el interruptor es una fila, no chips con scroll lateral. Lo verifica `expectNoHorizontalScroll`. |
| Áreas táctiles ≥ 44 × 44 px | Check de `size-11`, filas de abrir, guardar y confirmar de `min-h-11`, interruptor `min-h-11`; los botones del `ResponsiveDialog` ya lo cumplen. Lo verifica `expectTactileTargets`. |
| Nada depende de `hover` | El feedback es `active:`, nunca `hover:`. Check y fila se distinguen por forma y por `aria-label`, no por color. |
| Inputs ≥ 16 px y `enterkeyhint` | Título y notas del detalle a `text-base` (16 px); la barra de captura ya lo cumple. |
| Fechas nativas | `<input type="date">`, sin calendario dibujado. |
| Guardar no tapado por el teclado | El `Drawer` de `ResponsiveDialog` mide `max-h-[calc(100dvh-3rem)]` y el pie lleva `env(safe-area-inset-bottom)`; con el teclado abierto el `dvh` se reduce y el pie sigue visible. El botón va en `actions`, que `ResponsiveDialog` ya renderiza en `DialogFooter` / `DrawerFooter`. |
| Errores junto al campo | Cada campo renderiza su mensaje debajo, con `aria-invalid` y `aria-describedby`; nunca en un `toast` ni en una alerta. |
| Fechas en Europe/Madrid, UTC en BD | `D8`. Formato corto (`"vie 10 oct"`) con `tabular-nums`. |
| Prioridad con forma o texto, no solo color | `high` añade la etiqueta de texto "Alta"; `low` no añade nada para no ensuciar la fila. El acento dorado sigue siendo exclusivo de "ahora" (`docs/DESIGN.md §5`). |
| Accesibilidad | Cada fila tiene nombre accesible; el check lleva `aria-label` "Completar <título>" o "Deshacer <título>"; el interruptor es un `<button aria-pressed>`; el `h1` es el de `ViewHeader`, uno por sección. |

**Detalles de implementación que ya importan.**

- Los componentes de formulario **no** se generan con el CLI de shadcn: el proyecto escribe `<input>`
  con Tailwind a mano (`capture-bar.tsx`) y no tiene `ui/input.tsx`. Generar `input`, `label` y
  `textarea` serían tres ficheros nuevos que casi nadie más usa todavía.
- `src/features/tasks/` sigue la organización por feature de `AGENTS.md §3`: `api.ts` (una función por
  endpoint sobre el cliente RPC), `use-*.ts` (hooks de TanStack Query), `group.ts` (puro) y los
  componentes.
- `tasks-page.tsx` **sustituye** el `EmptyState` de siempre: el estado vacío pasa a ser "no hay
  tareas" y solo se ve cuando la lista está vacía de verdad.

### D15 · `e2e/fixtures.ts` crece, no se sustituye

**Qué.** `stubApi` gana ramas por método y ruta: `GET /api/tasks` devuelve la lista de fixture,
`POST /api/tasks` devuelve `201` con la tarea creada y **la añade a un array en memoria**, y `PATCH` y
`DELETE` devuelven la fila o `204`. `shell.spec.ts` no se toca: sus cinco rutas y sus comprobaciones
de `docs/DESIGN.md §6` siguen valiendo, incluida la de `/tasks`.

**Por qué en memoria y no re-mockeando por test.** Los tests del flujo **crear → completar** necesitan
que la fila creada exista después en la lista; si cada test re-mockeara, el estado que TanStack Query
cachea entre pasos y el estado del stub no podrían coincidir, y el test probaría el mock y no la app.
Un array en memoria por test es lo mínimo que hace que la suite siga probando la app.

**Playwright mantiene su motivo de ser.** `playwright.config.ts` sirve el **build** con `vite preview`
y no `pnpm dev`, porque solo el gestor de assets real aplica `public/_headers` (ADR-008). Este cambio
no lo altera.

## Coste en el plan gratuito

| Operación | Queries | Filas leídas | Filas escritas | Subpeticiones |
|---|---|---|---|---|
| `GET /api/tasks` (lista) | 1 | nº de pendientes + las que casen en el índice | 0 | 1 |
| `POST /api/tasks` | 1 | 0 | 1 (+ 2 índices) | 1 |
| `PATCH /api/tasks/:id` | 1 | 1 | 1 (+ 2 índices) | 1 |
| `DELETE /api/tasks/:id` | 1 | 1 | 1 (+ 2 índices) | 1 |

Ninguna petición se acerca a los límites de `AGENTS.md §8`: **1** de 50 subpeticiones y **1** de 50
peticiones al Worker por acción. Con un uso de ~100 peticiones al día frente a las 100.000 del plan
gratuito, el margen es de tres órdenes de magnitud. La carga de CPU por invocación es despreciable: una
consulta con índice y un `INSERT`. El cron no se toca en este cambio.

## Riesgos / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **El delta de `app-shell` no valida hasta que `add-app-shell` se archive** (`D1`) | Dependencia declarada en `proposal.md` y aquí, con `docs/PROGRESS.md` apuntando al archivo pendiente. Si al aplicar el requisito original difiere del supuesto, la primera tarea de `tasks.md` re-lee `openspec/specs/app-shell/spec.md` y ajusta **solo** el delta del cambio, nunca `openspec/specs/` a mano. |
| **`date-fns` y `@date-fns/tz` no se foreseen y su versión cambia el parseo** | Se fija la versión con `pnpm add` en `package.json`, se escribe un test del día del cambio de hora (29 de marzo de 2026) **antes** de usar la librería en la UI, y los tests de `D8` detectan cualquier cambio de semántica. Si `@date-fns/tz` resultara incompatible con la versión de `date-fns` que resuelva el lockfile, el plan B es un `Intl.DateTimeFormat("en-CA", { timeZone })` para formatear y aritmética con `Date.UTC` para el sentido inverso: se cambia `shared/dates.ts` y nada más, porque es el único módulo que depende de la librería. |
| **API y vista discrepan sobre qué es "vencida"** (`D7`) | Una sola regla (día anterior al de hoy en `Europe/Madrid`) y una sola función (`zonedDayStart`) en `shared/`, usada por el Worker y por `groupTasks`; test de ruta con una tarea que vence hoy y no sale en `overdue=true`. |
| **Sin paginación, la lista crece sin tope** (`D7`) | Con 5.000 tareas la respuesta ronda los 700 kB y un recorrido, muy por debajo de los límites del plan. Deuda con criterio cerrado: en cuanto la lista supere unas 300 tareas, `limit`/`cursor` entran en `D7`. |
| **El índice de `completed_at` suma escrituras** (`D2`) | 2 índices para 2 consultas ordenadas es el intercambio correcto en una app cuya operación más frecuente es abrir la lista. Se revisa si alguna vez se consulta sin agrupar por completadas. |
| **`completed_at` escrito en dos sitios** si alguien añade otro camino de estado (`D11`) | `D11` lo reduce a una función y a un `CASE` dentro del `UPDATE`, con un test que completa dos veces y comprueba que el instante no cambia. Es la clase de bug que ese test existe para cazar. |
| **La barra de captura escribe desde cualquier sección** y quien usa puede guardar un título vacío por accidente | El `CaptureBar` ya ignora los envíos en blanco y el esquema rechaza un título vacío: las dos barreras, en el cliente y en el servidor. El hueco del espacio en blanco lo cierra el `trim` del esquema. |
| **La suite e2e pasa a depender del array en memoria** | El fixture se instancia por test, así que no hay estado compartido entre tests. `shell.spec.ts` sigue siendo válido sin cambios. |
| **El cambio es grande para un solo PR** | El código de producto se mantiene en el orden de las ~600 líneas de `AGENTS.md §9`, pero toca Worker + esquema + SPA + e2e. Mitigación: `tasks.md` ordena el trabajo por capas (esquema → servicio → rutas → front → tests → docs) para que el PR se pueda revisar en tramos; y si al empezar el apply resulta demasiado grande, la primera mitad (esquema + servicio + rutas + sus tests) ya es un subconjunto coherente y revisable. |

## Migration Plan

1. `pnpm add zod @hono/zod-validator date-fns @date-fns/tz`.
2. Editar `worker/db/schema.ts` y ejecutar `pnpm db:generate`. Revisar el SQL: debe ser `CREATE TABLE`
   más dos `CREATE INDEX` y nada más.
3. `pnpm db:migrate:local` y `pnpm db:generate` otra vez, para comprobar que el esquema está limpio.
4. Verificación completa de `AGENTS.md §9` (última tarea de `tasks.md`).
5. **Pasos manuales de la persona dueña**, en este orden:
   1. `pnpm db:migrate:remote` — **antes** del deploy. Es la primera migración real del proyecto; sin
      ella, el Worker desplegado con las rutas nuevas recibe consultas a una tabla que no existe.
   2. `pnpm deploy`.
   3. Comprobar en el despliegue real: `GET /api/health` sigue en `200`; `/tasks` carga la lista vacía
      sin errores en la consola; crear una tarea desde la barra de captura y verla aparecer;
      completar, editar con fecha y borrar.
   4. Abrir el PR, mergear a `main`, archivar con `/opsx-archive add-tasks`.

**Reversión.** El código se revierte con un revert del PR. **La migración no tiene vuelta atrás**: no
hay `DROP TABLE` en el plan de reversión, porque una tarea borrada es un dato real y
`docs/ARCHITECTURE.md` no documenta una política de borrado. Si hubiera que deshacer el esquema en
producción, el camino es aplicar una migración nueva que elimine la tabla, y solo con una decisión
explícita de la persona dueña del proyecto. Los datos afectados son los que esta misma funcionalidad
creó, así que el cambio es de una sola dirección.

**Orden de despliegue y su porqué.** La migración va **antes** del deploy, no después: el Worker nuevo
espera a la tabla, y la tabla sin el Worker nuevo no la usa nadie. Al revés, un despliegue con las
rutas ya montadas contra una base sin la tabla devuelve `500` en cuanto alguien abre `/tasks`.

## Open Questions

Ninguna que afecte a las specs, al enfoque o al desglose de tareas. Dos mejoras quedan anotadas como
trabajo posterior, no como incógnita: el panel de detalle junto a la lista en escritorio
(`docs/DESIGN.md §3`, en `D14`, para `add-home-dashboard`) y el mapeo de `HTTPException` en `onError`
(`D5`, para cuando exista la segunda ruta validada). Las dos tienen su motivo escrito.
