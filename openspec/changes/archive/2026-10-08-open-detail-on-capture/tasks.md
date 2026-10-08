# Tasks

## 1. Implementación

- [x] 1.1 `TaskDetailProvider` y `useTaskDetail` en `src/features/tasks/task-detail-context.tsx`, que montan `TaskDetailSheet` una vez (`design.md D1`).
- [x] 1.2 `AppShell` monta el provider y abre el detalle con la fila real tras `mutateAsync` (`D2`); `TasksPage` usa el provider en vez de su estado propio.
- [x] 1.3 Tests: abrir al capturar en Tareas y en otra sección, no abrir si falla, y la lista sigue abriendo el detalle al tocar una fila.

## 2. End-to-end y cierre

- [x] 2.1 e2e en los dos viewports: capturar abre el detalle con la tarea; desde Hoy se abre encima de Hoy; qué recibe el foco al abrir en móvil.
- [x] 2.2 Definición de hecho (`AGENTS.md §9`) y `docs/PROGRESS.md`.
