# Tasks

## 1. Dependencias, tipos y comprobación temprana del entorno de pruebas

- [x] 1.1 `pnpm add @fontsource-variable/bricolage-grotesque @fontsource-variable/atkinson-hyperlegible-next`
  y `pnpm remove @fontsource-variable/geist`; verificar con `git diff package.json` que aparecen las
  dos altas y la baja, que no hay ningún otro cambio y que `pnpm typecheck` sigue devolviendo `0`.
- [x] 1.2 `pnpm add -D @playwright/test` y `pnpm exec playwright install chromium`; verificar que
  `pnpm exec playwright --version` responde y que el navegador queda instalado en el equipo
  (`~/.cache/ms-playwright` o su equivalente en Windows).
- [x] 1.3 `pnpm exec shadcn add drawer dialog toast`; verificar que existen
  `src/components/ui/drawer.tsx`, `src/components/ui/dialog.tsx` y `src/components/ui/toast.tsx`, y
  que `git diff package.json` **no** muestra ninguna dependencia nueva (los tres se apoyan en
  `@base-ui/react`, que ya estaba).
- [x] 1.4 Crear `tsconfig.e2e.json` (target `es2022`, `lib` con `dom`, `types` con
  `@playwright/test` y `node`, `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`,
  `noEmit`) con `include: ["e2e"]`, añadirlo a `references` de `tsconfig.json` y añadir
  `playwright.config.ts` al `include` de `tsconfig.node.json`; crear `playwright.config.ts` con los
  dos proyectos y el `webServer`, todavía sin tests; verificar que `pnpm typecheck` sigue en `0`.
- [x] 1.5 **Riesgo temprano** (`design.md D8`): ejecutar `pnpm build` y después
  `pnpm exec vite preview --port 4173 --strictPort`, y comprobar que `/` devuelve el `index.html` con
  `200` y que `dist/client/_headers` existe con la CSP de la SPA. Verificado en la revisión
  de la propuesta: `vite preview` ejecuta el Worker y aplica `_headers` también al fallback de la SPA.
  **No** cambiar a `pnpm dev` aunque algo falle: Vite en modo dev no aplica `_headers` y la suite
  dejaría de detectar fallos de CSP. Si `preview` falla, parar y avisar.

## 2. Tema "olivar" y tipografía

- [x] 2.1 Crear `src/lib/theme.ts` con `resolveTheme(stored, prefersDark)` como función pura y
  `applyTheme(document)` que pone la clase en `<html>` y guarda la elección en `localStorage`
  (`nexus:theme`) con el acceso envuelto en `try/catch`; escribir `src/lib/theme.test.ts` con las
  cuatro combinaciones de preferencia y elección, más el caso de `localStorage` que lanza; verificar
  que `pnpm test` deja verde el proyecto `web`.
- [x] 2.2 Crear `src/components/theme-provider.tsx` (contexto, escucha `prefers-color-scheme` solo
  mientras no haya elección manual) y `src/components/theme-toggle.tsx` (conmutador con las tres
  opciones: sistema, claro, oscuro), montado en la barra de vista de **Más**; escribir
  `src/components/theme-provider.test.tsx` que compruebe la clase en `<html>`, que sigue al sistema
  mientras no se elija, y que una elección manual persiste y deja de seguir al sistema; verificar con
  `pnpm test`.
- [x] 2.3 Sustituir en `src/index.css` los tokens de `:root` y `.dark` por la paleta de
  `docs/DESIGN.md §5` (cal, tinta, olivo, aceite, piedra, granada), derivando y **documentando en el
  propio fichero** los tokens que el documento no fija (`muted-foreground`, `border`, `input`, `ring`,
  `chart-*`, `sidebar-*`); añadir `color-scheme: light dark` en `:root`; verificar que ningún
  componente usa un color literal con una búsqueda de `#` y `rgb(` en `src/**/*.tsx`.
- [x] 2.4 Cambiar en `src/index.css` `--font-heading` a Bricolage Grotesque y `--font-sans` a
  Atkinson Hyperlegible Next, quitando el alias `--font-heading: var(--font-sans)` y la importación de
  Geist; verificar con `pnpm build` que los `.woff2` salen en `dist/client/assets` y que la hoja de
  estilos los referencia desde el propio origen (sin peticiones a terceros).
- [x] 2.5 Añadir `--accent-strong` (`#A8841A` en claro, igual que `--accent` en oscuro) y usarlo en el
  marcador de "ahora"; fijar `--muted-foreground` en `#5F635A` (claro) y `#A8ABA1` (oscuro). Crear
  `src/lib/contrast.test.ts`, que importe `src/index.css?raw`, extraiga los tokens de `:root` y `.dark`
  y compruebe ≥ 4,5:1 en `foreground`/`background`, `muted-foreground` sobre `background` y sobre
  `muted`, `primary-foreground`/`primary`, `accent-foreground`/`accent` y `destructive`/`background`,
  y ≥ 3:1 en `accent-strong`/`background` y `ring`/`background`, en los dos modos; verificar con
  `pnpm test` que pasa, y que cambiar `--muted-foreground` a tinta al 55 % lo hace fallar (deshaciendo
  después el cambio).
- [x] 2.6 Añadir en `src/index.css` el bloque `@media (prefers-reduced-motion: reduce)` que desactiva
  transiciones y animaciones; verificar que `pnpm build` sigue en `0` y que las utilidades
  `data-starting-style` de `Drawer` y `Dialog` quedan anuladas.

## 3. Overlays responsivos y avisos

- [x] 3.1 Crear `src/lib/use-media-query.ts` sobre `useSyncExternalStore`, devolviendo `boolean` y
  manejando el caso de que `matchMedia` no exista en el entorno; escribir `src/lib/use-media-query.test.ts` que
  simule `matchMedia` y compruebe el valor inicial y que un cambio de la media query re-renderiza;
  verificar con `pnpm test`.
- [x] 3.2 Crear `src/components/responsive-dialog.tsx` con una única interfaz
  (`open`, `onOpenChange`, `title`, `description`, `actions`, `children`) que monta el `Drawer` de
  shadcn por debajo de 1024 px y el `Dialog` a partir de 1024 px, con el `max-h` en unidades de
  viewport dinámicas y el contenido desplazable; escribir `src/components/responsive-dialog.test.tsx`
  que compruebe qué componente se monta a 360 px y a 1280 px, que `Escape` cierra y que el foco vuelve
  al elemento que lo abrió; verificar con `pnpm test`.
- [x] 3.3 Añadir el `ToastHost` y su `ToastProvider` **una sola vez** en el layout del shell, con la
  posición arriba en móvil y abajo a la derecha en escritorio mediante las clases de posición del
  componente (sin estilos en línea); escribir `src/components/toast-host.test.tsx` que emite un aviso
  desde un consumidor de prueba y comprueba que se anuncia y que desaparece solo; verificar con
  `pnpm test`.
- [x] 3.4 Comprobar la regla de "ninguna vista usa `Dialog` ni `Drawer` directamente" con una búsqueda
  en `src/` que solo encuentre imports en `src/components/responsive-dialog.tsx` y en los componentes
  generados; dejar anotado en `design.md` que esta comprobación es candidata a convertirse en test
  unitario de `docs/DESIGN.md`.

## 4. Shell

- [x] 4.1 Crear `src/app/navigation.ts` con `NAV_ITEMS` (**Hoy**, **Tareas**, **Notas**, **Más**) y
  sus iconos de `lucide-react`; escribir `src/app/navigation.test.ts` que compruebe que hay cuatro
  entradas, que las cuatro rutas son distintas, que cada etiqueta es no vacía y que cada entrada tiene
  icono; verificar con `pnpm test`.
- [x] 4.2 Crear `src/components/empty-state.tsx` (título, texto que invita a actuar y acción) y
  `src/components/skeleton.tsx` (la forma del contenido, sin spinner); escribir
  `src/components/empty-state.test.tsx` que compruebe que el texto y la acción son alcanzables por rol;
  verificar con `pnpm test`.
- [x] 4.3 Crear `src/app/layout/view-header.tsx` (título de la vista y un hueco para una acción, con
  `env(safe-area-inset-top)`) y `src/app/layout/capture-bar.tsx` (campo con `enterkeyhint="send"` y
  botón de enviar de al menos 44 × 44 px, atajo `N` para enfocar el campo, **sin** persistencia ni
  llamada a la API); escribir `src/app/layout/capture-bar.test.tsx` y `view-header.test.tsx` que
  comprueben los atributos del campo, que el botón mide 44 px o más, que enviar no llama a `client` y
  que `N` enfoca el campo y que **no** lo hace con el foco en otro campo, con un overlay abierto ni
  con Ctrl, Cmd o Alt pulsados; verificar con `pnpm test`.
- [x] 4.4 Crear `src/app/layout/tab-bar.tsx` (visible por debajo de 1024 px, altura mínima de 44 px,
  `padding-bottom: env(safe-area-inset-bottom)`) y `src/app/layout/sidebar.tsx` (visible a partir de
  1024 px), ambos recorriendo `NAV_ITEMS` y marcando la activa con
  `aria-current="page"`; escribir `src/app/layout/tab-bar.test.tsx` y `sidebar.test.tsx` que
  comprueben que en 360 px existe la tab bar y **no** la barra lateral, y a 1280 px lo contrario;
  verificar con `pnpm test`.
- [x] 4.5 Crear `src/app/layout/app-shell.tsx` con `h-dvh`, cabecera `shrink-0`, `<Outlet/>` dentro de
  `flex-1 min-h-0 overflow-y-auto` y barra inferior `shrink-0`, de modo que el documento nunca haga
  scroll y el contenido vuelva al principio al cambiar de ruta; escribir
  `src/app/layout/app-shell.test.tsx` que compruebe la estructura, que el `ToastHost` está montado una
  sola vez y que cambiar de sección devuelve el scroll al principio; verificar con `pnpm test`.
- [x] 4.6 Reescribir `src/app/router.tsx` con una ruta raíz de layout que anida `/`, `/tasks`,
  `/notes` y `/more`, las cuatro con `lazy()`, más `*` → `src/app/layout/not-found-view.tsx` con su
  enlace a **Hoy**; verificar con `pnpm typecheck` que `client.api` sigue exponiendo las mismas rutas
  del Worker y que la raíz ya no renderiza `HealthPage`.

## 5. Vistas

- [x] 5.1 Crear `src/features/today/today-page.tsx`, `src/features/tasks/tasks-page.tsx` y
  `src/features/notes/notes-page.tsx` como marcadores de posición con su título y su estado vacío
  (texto que explica qué cabrá ahí e invita a añadirlo, sin datos); escribir
  `src/features/today/today-page.test.tsx` que compruebe el estado vacío y que no hay scroll horizontal
  con el ancho de 360 px simulado; verificar con `pnpm test`.
- [x] 5.2 Convertir `src/features/health/health-page.tsx` en `src/features/health/health-panel.tsx`
  (componente de diagnóstico, no página) y adaptar `health-page.test.tsx` a `health-panel.test.tsx`
  con sus cuatro casos (carga, éxito, error y reintento); verificar con `pnpm test` que
  `src/features/health/api.ts` y `use-health.ts` no han necesitado cambios.
- [x] 5.3 Crear `src/features/more/use-session.ts` con `useQuery` sobre `client.api.me.$get()` y
  `src/features/more/more-page.tsx` con el indicador de sesión y el panel de salud; escribir
  `src/features/more/more-page.test.tsx` que cubra los estados de carga y de error de la sesión, que
  la consulta **no** se lanza desde las otras secciones (renderizando `app-shell` con `/` y
  comprobando que `$get` no se ha llamado) y que aparece el panel de salud; verificar con `pnpm test`.
- [x] 5.4 Montar `ThemeToggle` en la barra de vista de **Más** y comprobar que en 360 px la barra de
  captura, la tab bar y el conmutador caben sin scroll horizontal; ampliar el test de
  `more-page.test.tsx` con esa comprobación; verificar con `pnpm test`.

## 6. Verificación responsive con Playwright

- [ ] 6.1 Crear `e2e/fixtures.ts` con el stub de `**/api/**` (que devuelve `{ user: { email:
  "owner@nexus.test" } }` y `{ status: "ok" }`) y los ayudantes de aserción de `docs/DESIGN.md §6`
  (sin scroll horizontal, acción principal visible, altura de los interactivos con 0,5 px de
  tolerancia); verificar con `git grep -in "@nexus.test" -- ':!e2e'` que el email ficticio solo aparece
  dentro de `e2e/`.
- [ ] 6.2 Crear `e2e/shell.spec.ts` con las tres comprobaciones de `docs/DESIGN.md §6` aplicadas a
  cada ruta (`/`, `/tasks`, `/notes`, `/more` y una ruta inexistente) en los dos proyectos; ejecutar
  `pnpm exec playwright install chromium` si hace falta y `pnpm test:e2e`; verificar que está en verde
  y que un test que rompe a propósito el ancho falla, quitando después el cambio.
- [ ] 6.3 Ampliar `e2e/shell.spec.ts` con la navegación a las cuatro secciones, con la comprobación de
  que la tecla `N` enfoca la barra de captura en escritorio y de que en 360 px la barra de captura es
  visible sin desplazamiento; verificar con `pnpm test:e2e` en verde en los dos proyectos.
- [ ] 6.4 Añadir a `.github/workflows/ci.yml` el job `e2e` (checkout, `pnpm/action-setup`,
  `setup-node` con caché, `pnpm install --frozen-lockfile`, `pnpm build`,
  `pnpm exec playwright install --with-deps chromium` y `pnpm test:e2e`) con `needs` ninguno para que
  corra en paralelo a `verify`; verificar que el fichero sigue siendo YAML válido y que el job no
  despliega ni usa secretos.
- [ ] 6.5 Añadir `"test:e2e": "playwright test"` al `scripts` de `package.json` y quitar de
  `AGENTS.md §4` la nota de que `pnpm test:e2e` todavía no existe; verificar que `pnpm test:e2e`
  funciona tal cual desde la raíz.

## 7. Documentación

- [ ] 7.1 Actualizar `docs/ARCHITECTURE.md`: `§2.2` con las piezas nuevas del front y la regla de un
  único overlay, y añadir **ADR-010 · El tema se resuelve en JavaScript y sin script en línea, por la
  CSP**; enmendar **ADR-008** para dejar constancia de que la verificación responsive se ejecuta sin
  credenciales, interceptando `**/api/*`; verificar con `git diff` que ambas entradas explican el
  porqué y no solo el qué.
- [ ] 7.2 Actualizar `docs/DESIGN.md §5` para quitar "pendiente de validar" y dejar la decisión
  adoptada, y `docs/PROGRESS.md` con el estado del cambio 0.3, el siguiente paso exacto y
  `pnpm exec playwright install chromium` en la sección "Preparar un equipo nuevo"; verificar que la
  tabla de cambios de OpenSpec refleja el estado real.
- [ ] 7.3 Revisar `README.md` y `AGENTS.md` por si describen la pantalla inicial o la ausencia de
  `test:e2e`; verificar con `git diff` que ninguna afirmación queda desactualizada.

## 8. Verificación manual y cierre

- [ ] 8.1 Verificación manual de `docs/DESIGN.md §6` en DevTools a 360, 390, 768 y 1280 px, más 320 px
  sin roturas, teclado virtual abierto en la barra de captura, modo claro y oscuro, conmutador del
  tema y tamaño de letra del sistema al máximo; anotar en `docs/PROGRESS.md` el resultado.
- [ ] 8.2 Medir el JS comprimido de la carga inicial de la build de producción (por ejemplo, con
  `pnpm build` y el tamaño que informa Vite) y confirmar que no pasa de **200 KB**; si lo pasa,
  ajustar por `lazy()` en las rutas y repetir la medición.
- [ ] 8.3 Comprobar la definición de hecho de `AGENTS.md §9` punto por punto: `pnpm typecheck`,
  `pnpm lint`, `pnpm test`, `pnpm test:e2e` y `pnpm build` en verde; `pnpm db:generate` sin generar
  ningún `.sql` (este cambio no toca el esquema, así que no hay migración que aplicar);
  `openspec validate add-app-shell --strict` sin errores; y `git grep -iE "(token|secret|password)\s*[:=]\s*['\"][^'\"]{8}"`
  sin resultados.

## Workflow follow-up

Pasos que no puede hacer el agente porque los ejecuta la persona propietaria del proyecto:

- Descripción del pull request con el resultado de la verificación, revisión y merge a `main`.
- `pnpm deploy` y comprobación en el despliegue real de que la SPA carga sin violaciones de CSP, que
  las fuentes se sirven desde el propio origen y que el tema no destella de forma molesta.
- Validar en un **móvil real** la dirección visual "olivar" y anotar el resultado en
  `docs/DESIGN.md §5` (paso manual ya previsto para el cambio 0.3 en `docs/PROGRESS.md`).
- Archivar el cambio con `/opsx-archive` una vez revisado y mergeado.
