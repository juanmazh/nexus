# Tasks

## 1. Modelo y reglas compartidas

- [x] 1.1 Tabla `notes` (`design.md D1`); `pnpm db:generate` (solo `CREATE TABLE` e índice) y `db:migrate:local`.
- [x] 1.2 `shared/notes.ts`: `noteTitle`, `noteExcerpt`, `normalizeForSearch`, `escapeLike` y los esquemas de crear, editar, listar e id. Tests, incluidos los marcadores de Markdown, las tildes y `%`/`_`.

## 2. Worker

- [x] 2.1 `services/notes.ts`: listar con búsqueda (D2), crear, leer, editar (recalcula título y `search_text`; fijar no toca `updated_at`) y eliminar.
- [x] 2.2 `routes/notes.ts` montado en `app.ts`, con `405` y la forma de error del proyecto (D3).
- [x] 2.3 Tests de servicio y de rutas: orden, búsqueda sin tildes y con `%`, `400`, `404`, fijar sin cambiar la fecha.

## 3. SPA

- [x] 3.1 `marked` y `dompurify`; `renderMarkdown` saneado, enlaces a otra pestaña y tablas y código con su propio scroll (D5). Tests de XSS.
- [x] 3.2 Lista con búsqueda (300 ms), "Fijadas", extracto y fecha; estados de carga, error, vacío y sin resultados.
- [x] 3.3 Ruta `/notes/:id`: ver/editar, fijar, eliminar con confirmación, nota inexistente (D4, D5).
- [x] 3.4 Autoguardado (D6): espera de 1 s, guardar al ver, al salir y en segundo plano, sin dos a la vez, indicador y reintento; nota vacía eliminada al salir.
- [x] 3.5 Barra de captura: en la lista de Notas crea una nota y abre su detalle en edición; oculta en el detalle (D4, D7).
- [x] 3.6 Tests de componentes de todo lo anterior.

## 4. End-to-end y cierre

- [x] 4.1 Stub de `/api/notes` y e2e: capturar una nota, escribir y ver que se guarda, verla con formato, buscar sin tilde, fijar y eliminar; una tabla ancha sin scroll horizontal de página; 44 px; en los dos viewports.
- [x] 4.2 `docs/ARCHITECTURE.md` (§2 y §4, con el porqué de la búsqueda), `docs/PROGRESS.md`. Comprobar que la carga inicial sigue por debajo de 200 KB. Definición de hecho de `AGENTS.md §9`.
