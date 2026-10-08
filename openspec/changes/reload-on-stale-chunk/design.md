# Design

## Context

El build de Vite envuelve cada `import()` dinámico con su helper de precarga. Cuando falla el
módulo o uno de sus CSS, el helper lanza el evento `vite:preloadError` en `window`; si nadie llama a
`preventDefault()`, propaga el error. Es el punto de enganche que documenta Vite para este caso.

## Decisions

### D1 · Recargar una vez, con una marca en `sessionStorage`

Al recibir `vite:preloadError`:

1. sin conexión (`navigator.onLine === false`) no se hace nada: el error llega a la sección (D2);
2. si `sessionStorage` tiene una recarga de hace menos de **10 s**, tampoco: la versión nueva
   tampoco carga y recargar otra vez sería un bucle;
3. si no, se guarda el instante, se llama a `preventDefault()` y se recarga.

`sessionStorage` y no una variable: la marca tiene que sobrevivir a la recarga. Si el
almacenamiento no está disponible (lanza), no se recarga: sin la marca no hay forma de evitar el
bucle, y el error de sección sigue ofreciendo recargar a mano.

10 s cubren de sobra el tiempo de una recarga en móvil y permiten que un segundo deploy, horas
después, vuelva a recargar sola.

### D2 · Error de sección dentro de la shell

Una ruta sin `path` con `errorElement` envuelve las cinco rutas hijas de la shell. Un error al
cargar o pintar una sección se muestra en el hueco de la sección, con `role="alert"`, "No se ha
podido cargar esta sección" y un botón "Recargar" de 44 px. La shell no se desmonta: se puede
navegar a otra sección o capturar una tarea.

## Risks / Trade-offs

- Entre el `preventDefault()` y la recarga, la sección recibe un módulo vacío y puede pintar el
  error de sección un instante. Es un parpadeo justo antes de recargar.
