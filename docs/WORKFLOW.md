# Workflow — cómo se trabaja en Nexus

> Proceso **humano**: roles, rituales de sesión, git, revisión y modelos.
> Las reglas para los agentes están en `AGENTS.md`; el estado actual, en `docs/PROGRESS.md`.

---

## 1. Roles

| Rol | Quién | Responsabilidades |
|---|---|---|
| **Tech lead / Product owner** | Juanma | Decide qué se construye y en qué orden, aprueba propuestas, revisa y mergea PRs, despliega, gestiona secretos |
| **Arquitecto / revisor** | Claude (claude.ai) | Directrices, revisión de propuestas y diseños grandes, segunda opinión en PRs delicados (auth, migraciones) |
| **Implementador** | OpenCode + modelos vía OpenRouter | Genera artefactos de OpenSpec y código siguiendo `AGENTS.md` |

**Principio:** el agente propone e implementa; **tú decides y validas**. Nada llega a `main` sin tu revisión.

---

## 2. Ritual de sesión (oficina ↔ casa)

El repositorio de GitHub es la **única fuente de verdad** entre equipos. Si algo no está pusheado, no existe.

### Al empezar (en cualquier equipo)

```bash
git fetch --all --prune
git switch <rama-en-curso>     # la que indique PROGRESS.md › "Ahora mismo"
git pull
pnpm install                   # por si cambiaron dependencias
openspec list                  # cambios activos
```

1. Abre `docs/PROGRESS.md` y lee **"Ahora mismo"** → ahí está el siguiente paso exacto.
2. Si en este equipo es la primera vez, sigue la checklist **"Preparar un equipo nuevo"** de `PROGRESS.md`.

### Al terminar (aunque sea a medias)

```bash
git add -A
git commit -m "wip(<scope>): <dónde lo dejo>"   # en la rama del cambio, nunca en main
git push
```

1. Actualiza **"Ahora mismo"** en `docs/PROGRESS.md`: qué quedó hecho y **el siguiente paso concreto** (comando o tarea de `tasks.md`).
2. Commit y push de ese cambio también.

> Los commits `wip` están permitidos **solo en ramas de cambio**. Al mergear se hace *squash*, así
> que `main` queda limpio con un commit convencional por cambio.

### Lo que NO viaja por git (y debe existir en cada equipo)

| Cosa | Cómo se replica |
|---|---|
| `.dev.vars` (secretos locales) | Guárdalo en tu gestor de contraseñas y cópialo a mano. Plantilla: `.dev.vars.example` |
| API key de OpenRouter | `opencode auth login` en cada equipo |
| Sesión de Cloudflare | `pnpm wrangler login` en cada equipo |
| Datos de la D1 local | No se replican: `pnpm db:migrate:local` + datos de ejemplo. Los datos reales están en producción |

---

## 3. Ciclo de un cambio (OpenSpec + git)

```text
 1. Elegir el siguiente cambio de ROADMAP.md
 2. git switch main && git pull && git switch -c change/<change-id>
 3. (opcional) /opsx:explore  → pensar el enfoque
 4. /opsx:propose <change-id>  (pega el prompt del ROADMAP)
 5. ✋ REVISIÓN de proposal.md, specs/, design.md y tasks.md  (checklist §4.1)
      └─ si algo no te convence, pide cambios y repite; NO pases a apply
 6. commit "docs(openspec): propose <change-id>" + push
 7. Contexto limpio en OpenCode (sesión nueva) → /opsx:apply
 8. Durante apply: commits pequeños y push al final de cada sesión
 9. Abrir PR hacia main (descripción en español, enlazando el cambio)
10. ✋ REVISIÓN del PR  (checklist §4.2) + CI en verde
11. Revisión OK → /opsx:archive EN LA MISMA RAMA → commit "docs(openspec): archive <change-id>" + push
12. Squash merge → main  (código + specs actualizadas llegan juntos en un solo commit)
13. Desplegar (§6) y actualizar PROGRESS.md
```

Archivar **antes** del merge hace que `openspec/specs/` en `main` nunca describa algo distinto de lo
que hay en el código.

**¿Por qué una sesión nueva de OpenCode para `apply`?** Los propios autores de OpenSpec recomiendan
empezar la implementación con el contexto limpio: el agente trabaja a partir de los artefactos y no del
historial de la conversación, que suele arrastrar ideas que ya se descartaron.

---

## 4. Checklists de revisión

### 4.1 Revisar una propuesta (antes de `apply`)

- [ ] ¿Resuelve un problema real que tengo **ahora**? ¿O es una funcionalidad "por si acaso"?
- [ ] ¿La sección "Fuera de alcance" existe y es concreta?
- [ ] ¿Cabe en un PR que pueda revisar en una sentada?
- [ ] ¿Cada requisito tiene escenarios de error y de bordes, no solo el camino feliz?
- [ ] ¿Las fechas especifican UTC en BD y Europe/Madrid en la UI?
- [ ] ¿Añade dependencias? ¿Están justificadas en `design.md`?
- [ ] ¿La migración es destructiva? ¿Hay plan de vuelta atrás?
- [ ] ¿Estimó el coste en el plan gratuito?
- [ ] ¿Las tareas son pequeñas, ordenadas e incluyen tests junto a cada funcionalidad?

### 4.2 Revisar un PR (antes de mergear)

- [ ] CI en verde (lint, typecheck, test, build).
- [ ] Todas las tareas de `tasks.md` marcadas; no hay código **fuera** del alcance de la propuesta.
- [ ] Ningún secreto, email, chat ID ni dato personal en el diff.
- [ ] Rutas nuevas bajo `/api/*` → pasan por el middleware de Access (hay un test que lo demuestra).
- [ ] Entradas validadas con Zod; nada de SQL concatenado.
- [ ] No hay N+1 ni queries sin índice sobre tablas que crecen.
- [ ] Probado a mano en `pnpm dev`, también en vista móvil (DevTools a ~375 px).
- [ ] Si toca auth, secretos o migraciones destructivas → pide una segunda revisión a Claude con el diff.

---

## 5. Modelos con OpenRouter (estrategia de coste)

OpenRouter **se paga por token**. Los modelos gratuitos tienen límites de uso y algunos proveedores
registran los prompts. La calidad del resultado depende sobre todo de las specs, no de quemar tokens.

| Fase del ciclo | Tipo de modelo | Por qué |
|---|---|---|
| `explore`, `propose`, revisión de diseño | **Fuerte** (razonamiento alto) | Aquí se toman las decisiones; un error cuesta caro después |
| `apply` de tareas bien especificadas | **Bueno en código y económico** | Ejecuta un plan cerrado; no necesita el modelo más caro |
| Depurar un fallo que el económico no resuelve en 2 intentos | **Fuerte** | Escalar es más barato que 10 iteraciones fallidas |

Reglas prácticas:

- Fija los modelos en un **`opencode.json` en la raíz del repo** (versionado). Así oficina y casa usan exactamente los mismos. La API key **no** va ahí: se configura con `opencode auth login` en cada equipo.
- Apunta en `PROGRESS.md › Modelos en uso` qué modelo usas para cada rol y revísalo cada pocas semanas; los modelos y sus precios cambian rápido.
- Pon un **límite de crédito** en tu cuenta de OpenRouter para evitar sorpresas.
- Nunca pegues el contenido de `.dev.vars` ni tokens en un prompt.

---

## 6. Despliegue

**Fases 0 y 1 (manual, para aprender el proceso):**

```bash
git switch main && git pull
pnpm db:migrate:remote   # solo si el cambio trae migraciones — SIEMPRE antes del deploy
pnpm deploy
```

Después del despliegue: abre la URL de producción, comprueba el login de Access y prueba el flujo del cambio.

**A partir de la fase 2:** GitHub Actions despliega automáticamente al hacer merge en `main`
(con el secreto `CLOUDFLARE_API_TOKEN`). Las migraciones remotas siguen siendo un paso manual y consciente.

---

## 7. Git: resumen

| Elemento | Convención |
|---|---|
| Rama principal | `main` (protegida: solo PR + CI en verde) |
| Ramas de cambio | `change/<change-id>` |
| Ramas triviales | `chore/<descripcion>` |
| Commits | Conventional Commits en inglés |
| Merge | Squash merge (un commit limpio por cambio) |
| Etiquetas | `v0.1.0` al terminar la fase 1, `v0.2.0` en la fase 2, etc. |
