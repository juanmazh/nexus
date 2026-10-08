# Tasks

## 1. Recarga

- [ ] 1.1 `src/lib/stale-chunk.ts`: `handleStaleChunk` (`design.md D1`) e `installStaleChunkReload`, registrado en `src/main.tsx`. Tests: recarga una vez, no recarga dentro de 10 s, sin conexión ni sin almacenamiento.

## 2. Error de sección

- [ ] 2.1 `SectionError` y la ruta sin `path` con `errorElement` (`D2`). Test.

## 3. End-to-end y cierre

- [ ] 3.1 `e2e/pwa.spec.ts`: el fichero de Más falla una vez → recarga y se ve Más; falla siempre → una sola recarga y el error con "Recargar", sin scroll horizontal y con 44 px.
- [ ] 3.2 `docs/ARCHITECTURE.md` (ADR-011) y `docs/PROGRESS.md`. Definición de hecho de `AGENTS.md §9`.
