# Workflow — cómo se trabaja en Nexus

> Proceso **humano**: roles, rituales de sesión, git, revisión y modelos.
> Las reglas para los agentes están en `AGENTS.md`; el estado actual, en `docs/PROGRESS.md`.

---

## 1. Roles

| Rol | Quién | Responsabilidades |
|---|---|---|
| **Tech lead / Product owner** | Juanma | Decide qué se construye y en qué orden, aprueba propuestas, revisa y mergea PRs, despliega, gestiona secretos |
| **Arquitecto / revisor** | Claude (claude.ai) | Directrices, revisión de propuestas y diseños grandes, segunda opinión en PRs delicados (auth, migraciones) |
| **Implementador** | OpenCode + modelos gratuitos (modo anónimo) | Genera artefactos de OpenSpec y código siguiendo `AGENTS.md` |

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

### Probar en el móvil real

- **Misma wifi:** `pnpm dev --host` y abre en el móvil la URL de red que muestra Vite (`http://192.168.x.x:5173`). Si la wifi de la oficina aísla los dispositivos, usa la siguiente opción.
- **Desde cualquier sitio:** sube una versión de preview (`pnpm wrangler versions upload`) y abre su URL de preview en el móvil; Access la protege igual que producción.

### Lo que NO viaja por git (y debe existir en cada equipo)

| Cosa | Cómo se replica |
|---|---|
| `.dev.vars` (secretos locales) | Guárdalo en tu gestor de contraseñas y cópialo a mano. Plantilla: `.dev.vars.example` |
| Sesión de Cloudflare | `pnpm wrangler login` en cada equipo |
| Datos de la D1 local | No se replican: `pnpm db:migrate:local` + datos de ejemplo. Los datos reales están en producción |

---

## 3. Ciclo de un cambio (OpenSpec + git)

```text
 1. Elegir el siguiente cambio de ROADMAP.md
 2. git switch main && git pull && git switch -c change/<change-id>
 3. (opcional) /opsx-explore  → pensar el enfoque
 4. /opsx-propose <change-id>  (pega el prompt del ROADMAP)
 5. ✋ REVISIÓN de proposal.md, specs/, design.md y tasks.md  (checklist §4.1)
      └─ si algo no te convence, pide cambios y repite; NO pases a apply
 6. commit "docs(openspec): propose <change-id>" + push
 7. Contexto limpio en OpenCode (sesión nueva) → /opsx-apply
 8. Durante apply: commits pequeños y push al final de cada sesión
 9. Abrir PR hacia main (descripción en español, enlazando el cambio)
10. ✋ REVISIÓN del PR  (checklist §4.2) + CI en verde
11. Revisión OK → /opsx-archive EN LA MISMA RAMA → commit "docs(openspec): archive <change-id>" + push
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
- [ ] Si hay UI: ¿el diseño describe **primero el layout móvil** (360 px) y tiene escenarios móviles en las specs?
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
- [ ] `pnpm test:e2e` en verde (proyectos móvil y escritorio).
- [ ] Checklist manual de `docs/DESIGN.md §6` hecha: 360 px, 320 px, **móvil real**, teclado virtual, modo oscuro.
- [ ] Capturas de móvil y escritorio adjuntas en la descripción del PR (también sirven de escaparate en GitHub).
- [ ] Si toca auth, secretos o migraciones destructivas → pide una segunda revisión a Claude con el diff.

---

## 5. Modelos (estrategia 100 % gratuita)

Decisión del proyecto: **coste cero también en IA.** OpenCode se usa en **modo anónimo** con sus
modelos gratuitos, sin cuenta ni API key. Esto tiene consecuencias que conviene asumir:

| Condición | Qué implica |
|---|---|
| Los prompts pueden usarse para entrenar el modelo | El repo es público, así que el código no es problema. **Los secretos sí**: nunca deben entrar en el contexto (`.dev.vars`, tokens, IDs de chat) |
| Los límites no están publicados | Si un día va muy lento o te corta, cambia de modelo o usa el plan B |
| La lista de modelos gratuitos cambia | El modelo se fija en `opencode.json`; si desaparece, se cambia ahí y en `PROGRESS.md` |

La calidad la ponen las specs y la revisión, no el modelo:

| Fase del ciclo | Quién | Por qué |
|---|---|---|
| `/opsx-explore`, `/opsx-propose` | Modelo gratuito de OpenCode | Genera los artefactos |
| **Revisión de la propuesta** | **Claude (claude.ai)** | Es donde más importa la calidad: se pegan `proposal.md`, `design.md` y `tasks.md` antes de `/opsx-apply` |
| `/opsx-apply` | Modelo gratuito de OpenCode | Ejecuta tareas pequeñas y bien especificadas, que es donde un modelo gratuito rinde mejor |
| Revisión del PR | Tú, y Claude si toca auth, secretos o migraciones | Segunda opinión donde un fallo cuesta caro |
| Plan B | OpenRouter `:free` (`qwen/qwen3-coder:free`, `openai/gpt-oss-120b:free`) | Límite de 50 peticiones al día: solo para consultas puntuales |

Reglas prácticas:

- El modelo se fija en **`opencode.json` en la raíz del repo** (versionado), para que oficina y casa usen el mismo.
- Apunta en `PROGRESS.md › Modelos en uso` qué modelo usas y desde cuándo. Reevalúalo tras cada fase.
- Si el modelo gratuito se atasca dos veces seguidas en la misma tarea, **no insistas**: trae el problema a Claude con el error y el fichero, o divide la tarea en otras más pequeñas actualizando `tasks.md` con `/opsx-update`.
- **Contexto limpio** al empezar `/opsx-apply`: una sesión nueva de OpenCode por cambio, o por bloque de tareas si el cambio es largo.

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
