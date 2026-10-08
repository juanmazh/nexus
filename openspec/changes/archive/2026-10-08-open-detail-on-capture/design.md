# Design

## Context

`TasksPage` tenía su propio estado `selected` y montaba `TaskDetailSheet`. La barra de captura vive en
`AppShell`, por encima de todas las páginas, así que no podía abrir un panel que solo existía dentro
de `/tasks`.

## Decisions

### D1 · El detalle vive en el shell, detrás de un provider

`TaskDetailProvider` guarda la tarea abierta, monta `TaskDetailSheet` una sola vez y expone
`useTaskDetail()` con `openTask(task)`. `AppShell` lo pone alrededor de la columna de contenido, así
que las páginas y la barra de captura comparten el mismo panel. Es estado de interfaz de una pantalla,
no de servidor, y por eso no va a TanStack Query.

### D2 · Se abre cuando la API ha respondido, no antes

La fila optimista tiene un id provisional y su detalle no podría crear avisos (`add-tasks` D10). El
shell espera a `mutateAsync` y abre el panel con la fila real. La espera es la de la respuesta, unos
cientos de milisegundos, y la fila ya se ve en la lista mientras tanto. Si la API falla, la promesa se
rechaza, no se abre nada y la barra recupera el texto como antes.

### D3 · Encima de la sección actual

El panel es un overlay; no hace falta estar en `/tasks` para verlo. Abrirlo donde se está mantiene el
contexto, y al cerrarlo la persona sigue donde estaba.

## Riesgos / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Capturar varias seguidas obliga a cerrar el panel** | Aceptado por la persona dueña. `Escape` o el gesto de arrastrar lo cierran. |
| **El teclado virtual se abre sobre el panel** si el foco cae en un campo | Verificado: en móvil el foco va al propio panel (no salta el teclado) y en escritorio al campo Título, cómodo con teclado físico. Un e2e lo fija para móvil. |

## Migration Plan

Sin migración. `pnpm deploy` y probar en el móvil: capturar desde Tareas y desde Hoy.
