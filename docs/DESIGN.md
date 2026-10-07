# Diseño — Nexus

> **Nexus se diseña para el móvil primero.** Gran parte de su valor es poder apuntar una tarea en
> la calle, mirar qué toca hoy en la cola del café o revisar un recordatorio desde el sofá.
> El escritorio es la **ampliación** del diseño móvil, no al revés.
>
> Este documento es de obligado cumplimiento para cualquier cambio con UI (ver `AGENTS.md §5` y `§9`).

---

## 1. Principios

1. **El pulgar manda.** Las acciones frecuentes viven en el tercio inferior de la pantalla, donde llega el pulgar con una sola mano.
2. **Capturar en menos de 5 segundos.** Desde abrir la app hasta guardar una tarea: un toque, escribir y enviar.
3. **Una pantalla, un trabajo.** En móvil cada vista tiene un propósito principal; lo secundario va a un *sheet* o a "Más".
4. **Nada depende del hover.** Todo lo que aparece al pasar el ratón tiene que ser accesible con un toque.
5. **Rápido aunque la red sea mala.** Actualizaciones optimistas, *skeletons* en lugar de spinners y un bundle pequeño.
6. **Accesible por defecto:** contraste AA, foco visible, textos en las acciones y `prefers-reduced-motion` respetado.

---

## 2. Viewports de referencia

| Ancho | Qué representa | Exigencia |
|---|---|---|
| **360 px** | Android pequeño/medio | **Diseño base.** Todo se diseña y se prueba aquí primero |
| 390–430 px | iPhone actual | Debe verse igual de bien que a 360 px |
| 320 px | Peor caso (iPhone SE 1.ª gen., zoom de accesibilidad) | No se rompe: sin scroll horizontal ni texto cortado |
| 768 px (`md`) | Tablet / móvil en horizontal | Se aprovecha el ancho: dos columnas donde tenga sentido |
| ≥ 1024 px (`lg`) | Escritorio | Navegación lateral y paneles de detalle junto a la lista |

**Mobile-first en el código:** los estilos sin prefijo son los del móvil y se amplían con `md:` y `lg:`.
**Prohibido** maquetar con `max-width` *media queries* (eso es desktop-first).

---

## 3. Estructura de la app (shell)

### Móvil (< 1024 px)

```text
┌──────────────────────────────┐  ← safe-area-inset-top
│ Hoy                    (⚙)   │  barra superior mínima: título de la vista + 1 acción
│ miércoles 7 oct              │
├──────────────────────────────┤
│                              │
│   contenido con scroll       │
│   (listas en filas, no       │
│    tablas)                   │
│                              │
├──────────────────────────────┤
│ [+ Añadir tarea…         ↑ ] │  barra de captura (siempre al alcance del pulgar)
├──────────────────────────────┤
│  Hoy   Tareas   Notas   Más  │  tab bar inferior (máx. 4 + "Más")
└──────────────────────────────┘  ← safe-area-inset-bottom
```

### Escritorio (≥ 1024 px)

```text
┌────────────┬──────────────────────────────┬──────────────────┐
│ Nexus      │ Hoy · [+ Añadir tarea…     ] │                  │
│            ├──────────────────────────────┤  panel de detalle│
│ Hoy        │                              │  (lo que en móvil│
│ Tareas     │   lista                      │   es un sheet)   │
│ Notas      │                              │                  │
│ Enlaces    │                              │                  │
│ …          │                              │                  │
└────────────┴──────────────────────────────┴──────────────────┘
```

- La **tab bar** se convierte en **barra lateral**; la **barra de captura** pasa a la cabecera y se enfoca con `N`.
- El **sheet** inferior del móvil se convierte en **panel lateral** o **diálogo**.
- El contenido tiene un ancho máximo legible: no se estira una lista a 1.900 px.

---

## 4. Reglas obligatorias para móvil

### Viewport y safe areas

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- **Nunca** `maximum-scale=1` ni `user-scalable=no`: impedir el zoom es un fallo de accesibilidad.
- La tab bar, la barra de captura y los *sheets* respetan `env(safe-area-inset-*)` (notch, barra de gestos).
- Alturas de pantalla completa con `dvh`/`svh`, **nunca** `100vh` (en móvil `100vh` queda por debajo de la barra del navegador).

### Táctil

- **Área táctil mínima de 44 × 44 px** en todo lo que se pueda tocar, aunque el icono sea más pequeño (se amplía con padding).
- Al menos **8 px** de separación entre áreas táctiles contiguas.
- Estilos de hover solo dentro de `@media (hover: hover)`, para que no se queden "pegados" en táctil.
- Los gestos (deslizar para completar, etc.) son **atajos**: toda acción tiene también un botón visible.

### Formularios

- Tamaño de letra de los inputs **≥ 16 px**: con menos, iOS hace zoom al enfocar el campo.
- Siempre con el `type`, `inputmode`, `enterkeyhint` y `autocomplete` correctos (por ejemplo, `enterkeyhint="send"` en la barra de captura).
- **Fechas y horas con inputs nativos** (`date`, `time`, `datetime-local`): los selectores nativos del móvil son mejores que cualquier calendario dibujado a mano.
- El botón de enviar no puede quedar tapado por el teclado virtual.
- Los errores se muestran junto al campo, no en una alerta.

### Overlays

- Un componente `ResponsiveDialog`: **`Drawer` (bottom sheet) en móvil** y `Dialog` o panel lateral en escritorio. Ninguna vista usa `Dialog` directamente.
- Los menús contextuales en móvil son *sheets* con opciones grandes, no menús flotantes diminutos.
- Las notificaciones (toasts) aparecen **arriba** en móvil, para no tapar la tab bar ni la barra de captura.

### Contenido

- **Listas en filas**, no tablas. Si un dato es tabular de verdad (finanzas), en móvil se convierte en filas apiladas.
- Textos largos con `line-clamp` y un "ver más"; nunca truncar sin forma de leer el texto completo.
- **Cero scroll horizontal** de la página. Si algo necesita scroll lateral (por ejemplo, unos chips de filtro), solo ese contenedor lo tiene.
- Números (horas, importes) con `font-variant-numeric: tabular-nums`, para que no "bailen".

### Rendimiento percibido

- **Actualizaciones optimistas** con TanStack Query al crear, completar o borrar (con rollback si falla).
- *Skeletons* con la forma del contenido en lugar de spinners a pantalla completa.
- Code splitting por ruta. Presupuesto orientativo para la carga inicial: **≤ 200 KB de JS comprimido**.
- Las fuentes, self-hosted y con `font-display: swap`.

---

## 5. Dirección visual — propuesta v1

> **Pendiente de validar** en el cambio `add-app-shell`, viéndola en pantalla. Todo vive en *tokens*
> (variables CSS del tema de shadcn), así que cambiarla luego cuesta muy poco.

**Concepto: "olivar".** Nexus nace en Jaén. La paleta sale del olivar (verde oliva, el dorado del
aceite, la piedra caliza) en lugar del azul SaaS de siempre. Sobria para el día a día, con un único
acento cálido que marca "lo de ahora".

### Color

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `background` · cal | `#F6F7F2` | `#14170F` | Fondo de la app |
| `foreground` · tinta | `#1E2419` | `#E8EBE0` | Texto principal |
| `primary` · olivo | `#3E5A2B` | `#9DBA6A` | Acciones principales, navegación activa |
| `accent` · aceite | `#C9A227` | `#D9B83F` | **Solo** para "ahora/hoy": marcador de hoy, recordatorio inminente. Con texto oscuro encima |
| `muted` · piedra | `#E4E6DD` | `#232819` | Fondos secundarios, separadores |
| `destructive` · granada | `#B42318` | `#F0705F` | Borrar, errores |

Reglas de color: el acento **aceite** es escaso a propósito; si aparece en todas partes, deja de
significar "ahora". La prioridad alta se marca con forma o texto, no solo con color.

### Tipografía

| Familia | Rol |
|---|---|
| **Bricolage Grotesque** (variable) | Títulos de vista y la fecha grande de "Hoy". Aporta la personalidad |
| **Atkinson Hyperlegible Next** | Toda la interfaz y el texto. Pensada para leerse bien a tamaños pequeños, justo lo que pide el móvil |

Escala (móvil → `lg`): cuerpo 16 px, secundario 14 px, título de vista 28 → 34 px, fecha de "Hoy" 40 → 56 px.
Interlineado de 1,5 en el cuerpo. Mayúsculas iniciales en textos y botones ("Añadir tarea"), nunca etiquetas en MAYÚSCULAS.

### Forma y jerarquía

- Radios con jerarquía: inputs y botones 10 px, *sheets* 20 px (solo en las esquinas superiores), chips completamente redondeados.
- **Las listas no son tarjetas.** Las filas se separan con líneas finas; las tarjetas se reservan para resúmenes del inicio.
- Sombras solo en lo que flota (sheets, barra de captura). No hay sombras decorativas.
- Movimiento solo como respuesta a una acción (abrir un sheet, completar una tarea), con `prefers-reduced-motion` respetado.

### El elemento distintivo

La valentía visual se gasta en **un solo sitio**: la vista **Hoy**, con la fecha en Bricolage a gran
tamaño y el marcador dorado de "ahora" en la línea del día. El resto de la app queda tranquila y disciplinada.
La firma de interacción es la **barra de captura**, siempre al alcance del pulgar.

### Textos de la interfaz

Español, voz activa, verbos claros. El botón dice lo que hace ("Guardar tarea", no "Enviar") y el
toast confirma con el mismo verbo ("Tarea guardada"). Los estados vacíos invitan a actuar ("Nada
pendiente para hoy. Añade una tarea abajo."), y los errores dicen qué pasó y cómo arreglarlo, sin disculpas.

---

## 6. Cómo se verifica (obligatorio en cada cambio con UI)

### Automático (CI)

Tests de Playwright (`e2e/`) con proyectos de viewport móvil (360 × 780) y escritorio (1280 × 800). Para cada ruta:

- [ ] Sin scroll horizontal: `document.documentElement.scrollWidth <= window.innerWidth`.
- [ ] La acción principal de la vista es visible sin hacer scroll.
- [ ] Los elementos interactivos principales miden ≥ 44 px de alto.

### Manual (antes de pedir revisión del PR)

- [ ] DevTools, modo dispositivo: 360, 390, 768 y 1280 px.
- [ ] 320 px: no se rompe nada.
- [ ] **Móvil real.** Con `pnpm dev --host` y el móvil en la misma wifi, o con la URL de preview del Worker (protegida por Access).
- [ ] Teclado virtual abierto en cada formulario: el botón de enviar sigue visible.
- [ ] Modo oscuro y modo claro.
- [ ] Con el tamaño de letra del sistema al máximo: la interfaz se adapta y no corta textos.
