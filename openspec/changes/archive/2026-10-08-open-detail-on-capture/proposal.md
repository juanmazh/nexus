# Proposal

## Why

Al probar la app en el móvil, la persona dueña vio que casi siempre completa una tarea recién apuntada
con fecha, notas o un aviso. Hoy eso son tres pasos: capturar, buscar la fila en la lista y tocarla.
Desde otra sección (Hoy, Notas, Más) hay que cambiar además de pestaña. Abrir el detalle al guardar
ahorra esos pasos en el caso común.

Es un ajuste de la fase 1 surgido de esa primera prueba, antes de empezar la fase 2.

## What Changes

- **Tras una captura correcta se abre el detalle de la tarea recién creada**, en la sección en la
  que se esté, sin navegar.
- El detalle pasa de `TasksPage` al shell, a través de un *provider* (`TaskDetailProvider`) que
  expone `openTask(task)`. La lista y la barra de captura usan el mismo.
- Si la captura falla, no se abre nada: el texto vuelve a la barra, como hasta ahora.

### Fuera de alcance

- Un segundo botón de "guardar rápido": la persona dueña eligió abrir siempre el detalle, sabiendo
  que capturar varias tareas seguidas obliga a cerrarlo cada vez.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `tasks`: un requisito nuevo, *El detalle se abre al capturar*. Los de la captura y del detalle no
  cambian de texto.

## Impact

| Área | Impacto |
|---|---|
| Front | `src/features/tasks/task-detail-context.tsx` (nuevo), `app-shell.tsx` (abre tras capturar y monta el provider), `tasks-page.tsx` (usa el provider en vez de su estado). |
| Worker, esquema, secretos, dependencias | Ninguno. |
| Plan gratuito | Ninguno: no hay peticiones nuevas. |
