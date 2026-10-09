# Design

## Context

Una persona, cientos de notas como mucho, sobre todo desde el móvil. Plan gratuito: cada petición es
una invocación del Worker y cada fila leída cuenta en D1. La SPA ya tiene un patrón para todo esto en
las tareas (RPC tipado, TanStack Query, errores con la forma del proyecto) y se sigue.

## Decisions

### D1 · Modelo

```
notes(id text PK, title text NOT NULL, content text NOT NULL, search_text text NOT NULL,
      pinned integer NOT NULL DEFAULT 0, created_at integer NOT NULL, updated_at integer NOT NULL)
index notes_pinned_updated_at_idx (pinned, updated_at)
```

`title` y `search_text` se **derivan** de `content` en el Worker en cada escritura; la API nunca los
recibe. Guardarlos evita leer el contenido entero para pintar la lista y para buscar.

- **Título** (`noteTitle` en `shared/notes.ts`): la primera línea no vacía, sin los marcadores de
  Markdown del principio (`#`, `-`, `*`, `>`, `1.`, `- [ ]`), recortada a 120 caracteres con "…".
- **Extracto**: lo siguiente al título, sin marcadores, en una línea y como mucho 140 caracteres. Se
  calcula al listar, en el Worker, para no mandar el contenido entero a la lista.
- **Contenido**: obligatorio (algo que no sean espacios) y como mucho **50 000** caracteres.

### D2 · Búsqueda con una columna normalizada, sin FTS5

`search_text` = título + contenido en minúsculas y sin diacríticos (`NFD` y quitar `\p{Diacritic}`).
La consulta normaliza igual el término y filtra con `LIKE '%término%' ESCAPE '\'`, escapando `%`, `_`
y `\` de lo que escriba la persona.

Se descarta **FTS5**, aunque D1 lo admite: sus tablas virtuales no salen en `wrangler d1 export`, lo que
rompería el backup del backlog, y Drizzle no las genera. A esta escala un recorrido completo de unas
cientos de filas cuesta milisegundos; si algún día no basta, se añade FTS5 sin cambiar la API.

La búsqueda va al servidor, no se filtra en el navegador: la lista no trae el contenido entero.
En la SPA espera **300 ms** sin teclear antes de preguntar.

### D3 · API

| Método y ruta | Respuesta |
|---|---|
| `GET /api/notes?q=` | `200` con `{ id, title, excerpt, pinned, updated_at }[]`: fijadas primero, luego por `updated_at` descendente; como mucho 500 |
| `POST /api/notes` `{ content }` | `201` con la nota completa |
| `GET /api/notes/:id` | `200` con `{ id, title, content, pinned, created_at, updated_at }`, o `404` |
| `PATCH /api/notes/:id` `{ content?, pinned? }` | `200` con la nota, `404`, `400` |
| `DELETE /api/notes/:id` | `204` o `404` |

Fijar **no** cambia `updated_at`: fijar una nota no es modificarla, y la lista no debe reordenarse por
eso más allá de subirla a las fijadas.

### D4 · Detalle en su propia ruta

`/notes/:id` es una página dentro de la shell, no un diálogo como el detalle de una tarea: una nota se
escribe con el teclado abierto y necesita toda la altura, el botón atrás de Android debe volver a la
lista y una nota se puede enlazar. La cabecera lleva "← Notas" y las acciones Fijar, Editar/Ver y
Eliminar.

**La barra de captura no se muestra en el detalle de una nota**: con el teclado abierto, la barra y las
pestañas se comerían casi un tercio de la pantalla del móvil, y capturar algo con el editor abierto no
tiene sentido. Las pestañas siguen.

### D5 · Ver y editar

- Abrir una nota existente la **muestra renderizada**. "Editar" cambia a un `<textarea>` que crece con
  el texto; "Ver" vuelve.
- Una nota recién creada desde la barra se abre **ya en edición**, con el cursor al final, para seguir
  escribiendo.
- Markdown con **`marked`** (GFM: listas, casillas, tablas, código, enlaces) y el HTML pasado por
  **`DOMPurify`** antes de pintarlo. Los enlaces se abren en otra pestaña con `rel="noopener noreferrer"`.
  Tablas y bloques de código llevan su propio scroll horizontal: la página nunca lo tiene.
- Las dos librerías (unos 20 KB comprimidos) van en el fichero de la sección Notas, que ya se carga bajo
  demanda.

### D6 · Autoguardado

- Un `PATCH` con el contenido **1 s después de la última tecla**, y otro inmediato al pulsar "Ver", al
  salir de la nota y cuando la pestaña pasa a segundo plano (`visibilitychange`), que es lo que hay al
  cambiar de app en el móvil.
- Nunca dos `PATCH` a la vez: si hay uno en vuelo, el siguiente espera y manda solo el último texto.
- Un indicador con `role="status"`: "Guardando…", "Guardado" o "No se ha podido guardar" con
  **Reintentar**. Mientras haya cambios sin guardar, el texto sigue en pantalla: nunca se pierde.
- **Una nota que se queda vacía no se guarda**: al salir de ella se elimina, con el aviso "Nota vacía
  eliminada", que es lo que hacen Keep y Notas.

### D7 · Captura en Notas

Estando en `/notes`, la barra muestra "Añade una nota…", crea la nota con el texto como primera línea
y navega a su detalle en edición. Si la API falla, el texto vuelve a la barra, como con las tareas.
No es optimista: hasta que la API responde no hay `id` al que navegar.

## Risks / Trade-offs

- **Última escritura gana** entre dos dispositivos. Aceptable para una persona.
- **Recorrido completo** al buscar: lineal en el número de notas, irrelevante a esta escala (D2).
