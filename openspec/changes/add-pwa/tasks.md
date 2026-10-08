# Tasks

## 1. Iconos

- [x] 1.1 `public/icons/icon.svg` con el monograma de `design.md D3` y `public/favicon.svg`.
- [x] 1.2 `scripts/icons.mjs`: rasteriza el SVG con el Chromium de Playwright a `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` y `apple-touch-icon.png`. Revisar el resultado a ojo, también el *maskable* recortado en círculo.

## 2. Manifest y documento

- [x] 2.1 `public/manifest.webmanifest` con los campos de `D2`; `link rel="manifest"`, `icon`, `apple-touch-icon` y `meta name="theme-color"` en `index.html`.
- [x] 2.2 `THEME_COLORS` en `src/lib/theme.ts` y `applyTheme` actualiza `theme-color` (`D4`).
- [x] 2.3 Tests: el manifest tiene los campos y sus colores coinciden con `src/index.css`; cada PNG mide lo que declara; `applyTheme` pone el color de cada tema en el `meta`.

## 3. End-to-end

- [x] 3.1 `e2e/pwa.spec.ts` contra `vite preview`: el manifest está enlazado y se sirve; los iconos se sirven; `theme-color` cambia al cambiar de tema en **Más**; no hay *service worker* registrado. Además, Chromium mismo confirma por CDP (`Page.getInstallabilityErrors`) que la app es instalable: solo objeta `in-incognito`, propio de los contextos de Playwright.

## 4. Documentación y definición de hecho

- [ ] 4.1 ADR-011 en `docs/ARCHITECTURE.md` (sin *service worker*), el texto de 1.3 en `docs/ROADMAP.md` y `docs/PROGRESS.md` con los pasos de instalación.
- [ ] 4.2 Definición de hecho de `AGENTS.md §9`: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e` y `openspec validate add-pwa --strict` en verde.
