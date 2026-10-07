# Spec Delta

## Purpose

Andamiaje inicial del proyecto: un Worker con static assets y una SPA mínima pero ya ejecutable,
las herramientas de calidad acordadas y una CI que verifique cada PR, de modo que los cambios
siguientes se construyan sobre una base verde.

## ADDED Requirements

### Requirement: Comandos de desarrollo documentados

El proyecto SHALL ofrecer, a través del gestor de paquetes, los comandos `dev`, `build`,
`typecheck`, `lint`, `format`, `test`, `db:generate`, `db:migrate:local`, `db:migrate:remote`,
`cf-typegen` y `deploy`, con el comportamiento descrito en `AGENTS.md §4`. El comando `dev` SHALL
levantar a la vez el servidor de Vite y el Worker con la base de datos D1 local, de forma que la SPA
y la API estén disponibles en el mismo origen sin pasos adicionales.

#### Scenario: Levantar el proyecto en local

- **WHEN** se ejecutan `pnpm install` y después `pnpm dev` en un equipo limpio
- **THEN** el proceso arranca y sirve tanto la SPA como `GET /api/health` en el mismo origen
- **AND** el comando no requiere credenciales de Cloudflare

#### Scenario: Verificación de calidad en local

- **WHEN** se ejecutan `pnpm typecheck`, `pnpm lint` y `pnpm test` sobre el proyecto recién creado
- **THEN** los tres terminan con código de salida `0`
- **AND** `pnpm build` produce los assets de producción sin errores

### Requirement: CI que verifica cada PR

El proyecto SHALL incluir un workflow de GitHub Actions que, en cada pull request y en `main`,
instale las dependencias y ejecute lint, typecheck, test y build. Los jobs SHALL fallar si cualquiera
de esos pasos falla.

#### Scenario: PR con todo en verde

- **WHEN** se abre un pull request y lint, typecheck, test y build terminan correctamente
- **THEN** el job aparece como correcto y el pull request queda listo para revisión

#### Scenario: PR con un test roto

- **WHEN** un pull request introduce un fallo que `pnpm test` detecta
- **THEN** el job termina en fallo y señala el paso responsable

#### Scenario: La CI no despliega

- **WHEN** el workflow se ejecuta sobre `main`
- **THEN** no despliega el Worker ni publica los assets en ningún entorno

### Requirement: Página inicial mínima que consulta la API

La SPA SHALL servir una página inicial que consulta `GET /api/health` y refleja su resultado en tres
estados visibles: **cargando**, **éxito** y **error**. La acción visible SHALL ser la consulta a la
API, SHALL tener un área táctil de al menos 44 × 44 px y SHALL funcionar a 360 px de ancho sin scroll
horizontal. La página no SHALL depender de `hover`. El `meta viewport` SHALL ser
`width=device-width, initial-scale=1, viewport-fit=cover` y no SHALL impedir el zoom.

#### Scenario: Carga con la API disponible

- **WHEN** se abre la aplicación con la API disponible
- **THEN** se muestra un estado de carga mientras dura la petición
- **AND** al responder `200`, la página indica que la API responde con estado `ok`
- **AND** a 360 px de ancho no hay scroll horizontal y la acción es alcanzable con el pulgar

#### Scenario: Carga con la API no disponible

- **WHEN** la consulta a `GET /api/health` falla o la respuesta no es correcta
- **THEN** la página muestra un estado de error que dice qué ha fallado
- **AND** ofrece una forma de reintentar la consulta
- **AND** no muestra un estado de éxito

#### Scenario: Zoom del navegador

- **WHEN** se inspecciona el `meta viewport` de la página
- **THEN** su contenido es `width=device-width, initial-scale=1, viewport-fit=cover`
- **AND** no contiene `maximum-scale` ni `user-scalable`

### Requirement: Base de datos configurada sin tablas

El proyecto SHALL tener D1 enlazado al Worker con el nombre `nexus-db`, la factoría de Drizzle
disponible para el código del Worker y el esquema declarado como fuente única del modelo de datos,
pero **no SHALL** contener ninguna tabla ni migración aplicada en este cambio.

#### Scenario: El Worker arranca con el binding disponible

- **WHEN** el Worker se ejecuta con su configuración
- **THEN** el binding `DB` está disponible para el código del Worker
- **AND** arrancar no falla por una base de datos ausente

#### Scenario: El identificador de la base de datos está pendiente

- **WHEN** alguien abre la configuración del proyecto antes de crear la base de datos
- **THEN** el identificador es un placeholder claramente marcado como pendiente de sustituir
- **AND** la documentación indica el comando exacto que crea la base de datos y que debe ejecutar la
  persona dueña del proyecto

#### Scenario: Generación de migraciones sin cambios de esquema

- **WHEN** se ejecuta `pnpm db:generate` sin cambios en el esquema
- **THEN** el comando termina sin generar migraciones ni modificar ficheros de esquema

### Requirement: Estructura de carpetas lista para crecer

El proyecto SHALL separar el código en `worker/` (API, servicios, esquema y trabajos programados),
`shared/` (código compartido entre front y Worker), `src/` (SPA) y `e2e/` (vacío, reservado para
Playwright), sinacketear ninguna lógica de negocio en el proyecto inicial.

#### Scenario: El endpoint de salud vive en la capa HTTP

- **WHEN** se busca el manejador de `GET /api/health`
- **THEN** está en la capa de rutas del Worker y no contiene lógica de negocio ni acceso a la base
  de datos

#### Scenario: El cliente de la API es tipado

- **WHEN** la SPA llama a `GET /api/health` a través del cliente de la API
- **AND** la ruta cambia en el Worker (por ejemplo, pasa a exigir autenticación y devuelve otro
  cuerpo)
- **THEN** la comprobación de tipos del front falla hasta que el código del front se adapte