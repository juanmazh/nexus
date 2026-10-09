# Proposal

## Why

La sección **Notas** existe desde `add-app-shell`, pero vacía. Lo que no es una tarea (una idea, una
lista de la compra, los pasos de algo que se hace una vez al año, una dirección) hoy no tiene sitio en
Nexus y acaba en otra app. Es la Fase 2, cambio **2.1**, y la base de la página de inicio (2.3), que
enseñará las notas fijadas.

## What Changes

Decidido con la persona dueña:

- **El título es la primera línea**, como en Keep o Notas de Apple: no hay campo de título.
- **Autoguardado**: un segundo después de dejar de escribir y al salir, con un indicador "Guardado".
- **La barra de captura crea una nota estando en Notas** y la abre para seguir escribiendo. En el resto
  de secciones sigue creando tareas.
- **La nota se lee con formato**: Markdown renderizado al abrirla y un botón **Editar** que pasa al
  texto.

Además:

- **Lista** con las fijadas arriba y, después, las demás por última modificación. Cada fila con su
  título, un extracto y la fecha.
- **Búsqueda** por título y contenido, sin distinguir mayúsculas ni tildes ("cancion" encuentra
  "Canción").
- **Fijar y desfijar**, y **eliminar** con confirmación, como las tareas.
- Cada nota tiene su URL (`/notes/:id`): el botón atrás del móvil vuelve a la lista y una nota se puede
  abrir directamente.
- API `GET`/`POST /api/notes`, `GET`/`PATCH`/`DELETE /api/notes/:id`.

### Fuera de alcance

- Etiquetas, carpetas o colores.
- Imágenes y adjuntos. Una imagen externa en el Markdown no se carga: la CSP solo permite imágenes
  propias (`img-src 'self' data:`), y así se queda.
- Edición simultánea desde dos dispositivos: gana la última escritura (es una app de una persona).
- Historial de versiones y papelera.
- Casillas `- [ ]` que se marcan al tocarlas: se ven, pero se cambian editando el texto.

## Capabilities

### New Capabilities

- `notes`: crear, leer, editar con autoguardado, buscar, fijar y eliminar notas en Markdown.

### Modified Capabilities

- `app-shell`: la barra de captura crea una nota en Notas y no se muestra en el detalle de una nota.

## Impact

- **D1**: tabla `notes` nueva (migración 0003, solo `CREATE TABLE` y un índice).
- **Worker**: `routes/notes.ts`, `services/notes.ts`; `shared/notes.ts` con los esquemas y las reglas
  de título y búsqueda.
- **SPA**: `features/notes/` (lista, detalle, editor, renderizado) y la ruta `/notes/:id`; la barra de
  captura según la sección.
- **Dependencias**: `marked` y `dompurify`, solo en el fichero de la sección Notas: no cuentan en la
  carga inicial.
