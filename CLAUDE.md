# micasaestuya · api

Backend de la plataforma de intercambio de alojamiento por colaboración. Express + MongoDB + Redis.

> **`CLAUDE.md` no se centraliza — se queda en este repo por razones
> técnicas** (las herramientas de código lo leen automáticamente al trabajar
> aquí). Pero **la fuente de verdad del proyecto es `micasaestuya-docs`**:
> arquitectura, decisiones, visión de producto y cualquier cosa de negocio se
> escriben allí, nunca en un `CLAUDE.md`. Este fichero es solo el manual de
> estilo de código de este repo.

| Documento                                | Cuándo abrirlo                                |
| ------------------------------------------ | ------------------------------------------------ |
| `../micasaestuya-docs/product-vision.md` | **Siempre al empezar.** Qué es el proyecto; manda sobre todo lo demás |
| `../micasaestuya-docs/status.md`         | Justo después: dónde estamos, siguiente paso y deuda |
| `docs/gotchas.md`                        | Trampas del toolchain y del modelo de regiones |

> **Vocabulario compartido con `web`** (`region`, `address`, `locale`) — la
> definición completa y el porqué viven en
> `../micasaestuya-docs/Domain-Vocabulary.md`. Antes de renombrar nada de esta
> zona, léelo: estos nombres ya cambiaron dos veces y volver atrás cuesta.

## Stack
- Node.js + Express (ESM — `"type": "module"`)
- MongoDB + Mongoose
- Redis (ioredis) — índice de autocompletado de regiones
- JWT (jsonwebtoken) + bcrypt
- node:test (runner nativo de Node) para tests

## Arquitectura de capas
```
routes/        →  solo define rutas y llama al controller
controllers/   →  lógica HTTP (req/res), llama al model
models/        →  lógica de negocio + queries MongoDB
schemas/       →  Mongoose schemas
utils/         →  config, logger, middleware, redisClient
```

## Modelos existentes
| Modelo   | Schema         | Notas                              |
|----------|----------------|------------------------------------|
| User     | schemas/user   | JWT auth, bcrypt. Sin roles (ADR 007) |
| Listing  | schemas/listing | Alojamiento de un anfitrión (`micasaestuya-docs/Listing.md`) |
| Region   | Redis + JSON   | ver abajo |

## Las regiones: dos índices, una fuente

`data/regions_cu.json` y `data/regions_do.json` son **la fuente de verdad**. Son
datos de referencia de solo lectura, así que van versionados en git y no en
Mongo: se revisan en el diff, se revierten, y la API arranca sin sembrar nada.

De ese árbol salen dos accesos distintos:

- **`/regions/suggest`** lee un índice de Redis por prefijo, para autocompletar.
  La puntuación de cada entrada **es** su nivel (1 provincia, 2 municipio,
  3 localidad), y eso es lo que permite filtrar por `level_type` sin resembrar.
- **`/regions/children`** lee el árbol en memoria, porque un índice por prefijo
  no sabe responder "dame los hijos de X".

**Sembrar Redis (`npm run redis:seed`) empieza con un `flushdb`.** No se lanza
para comprobar nada. Y es caro: más de 600.000 escrituras y otros tantos
`console.log`. Está anotado como deuda.

## Trampas conocidas

**ESLint 8 no parsea los _import attributes_.** Esto revienta el CI aunque Node
lo ejecute sin problema:

```js
import data from '../data/regions_cu.json' with { type: 'json' } // ❌ CI rojo
```

Se lee el JSON con `readFileSync` y `import.meta.url`. Detalle en
`docs/gotchas.md`.

**El lint no se puede correr desde el host.** `node_modules` vive en el volumen
de Docker, así que en el disco está vacío:

```bash
docker compose exec express npm run lint
```

**La imagen se publica en GitHub Container Registry**, en una ruta fija:
`ghcr.io/marlonbdez/micasaestuya-api` (lo consume Render). El proyecto pasó de
llamarse `backend` a `api`; si ves una ruta de registro distinta a esa, está
desactualizada.

## Convenciones de código

Los ejemplos usan `Listing` (el alojamiento que publica un anfitrión). Es un
esquema de la convención, no una copia del código: el real está en
`schemas/`, `models/`, `controllers/` y `routes/` con `listing` en el nombre, y
de momento solo tiene `create`.

### Rutas
```js
// routes/listings.js
import { Router } from 'express'
import { ListingController } from '../controllers/listing.js'
import { auth } from '../utils/middleware.js'

const listingRouter = Router()
listingRouter.get('/', ListingController.getAll)
listingRouter.post('/', auth, ListingController.create)
export { listingRouter }
```

### Controllers
```js
// controllers/listing.js — solo lógica HTTP
export const ListingController = {
  async getAll(req, res) {
    const listings = await ListingModel.getAll(req.query)
    res.json(listings)
  }
}
```

### Models
```js
// models/listing.js — lógica de negocio + queries
import ListingSchema from '../schemas/listing.js'

class ListingModel {
  static async getAll(filters = {}) { ... }
  static async getById(id) { ... }
  static async create(data) { ... }
  static async update(id, data) { ... }
}
export default ListingModel
```

### Schemas Mongoose
```js
// schemas/listing.js
import { Schema, model } from 'mongoose'
import mongooseUniqueValidator from 'mongoose-unique-validator'

const listingSchema = new Schema({
  title: { type: String, required: true },
  // ...
}, { timestamps: true })

listingSchema.plugin(mongooseUniqueValidator)
export default model('Listing', listingSchema)
```

## Endpoints actuales
```
GET  /api/health          → health check
GET  /api/users           → lista de usuarios (auth requerida)
POST /api/users/create    → registro
POST /api/users/login     → login (devuelve JWT)
GET  /api/users/current   → usuario actual (auth requerida)
GET  /api/users/profile   → alias de /current (auth requerida)
GET  /api/regions/suggest   → autocompletado por prefijo (Redis)
                              ?term= &country_code= [&level_type=1|2|3]
GET  /api/regions/children  → hijos de un nodo del árbol (memoria)
                              ?country_code= [&level1= &level2= &level3=]
POST /api/listings          → publicar un alojamiento (auth requerida)
```

## Autenticación
- JWT en Authorization header: `Bearer <token>`
- Token sin expiración (pendiente: añadir expiración + refresh)
- Sin roles (ADR 007 en `micasaestuya-docs`): anfitrión es quien tiene al menos
  un `Listing`. Los documentos antiguos de `users` pueden conservar un campo
  `role`: el schema ya no lo declara y se ignora
- Middleware `auth` en `utils/middleware.js`

## Manejo de errores
- `express-async-errors` captura errores async automáticamente
- Middleware `errorHandler` en `utils/middleware.js`
- NO usar try/catch en controllers — propagarlo al error handler
- SÍ usar try/catch en models cuando sea necesario para logging

## Variables de entorno (.env)
```
MONGODB_URI=
MONGODB_TEST_URI= # solo para npm test (base separada)
PORT=3001
SECRET=           # JWT secret
REDIS_URI=        # Redis connection
REDIS_TEST_URI=   # solo para npm test (db lógica 1)
NODE_ENV=         # development | test | production (los scripts npm ya lo fijan)
```

## Tests
- Framework: node:test con `--test-concurrency=1` (tests secuenciales entre archivos)
- Archivo de setup: `tests/test_helper.js`
- Patrón: `tests/[feature].test.js`
- Usar `supertest` para tests de integración de API

```bash
npm test                    # todos los tests
npm test -- --watch         # modo watch
npm test -- --test-name-pattern="texto"   # correr un test específico
```

## ❌ Prohibido
- Lógica de negocio en routes o controllers
- Queries Mongoose en controllers (van en models)
- `console.log` en producción — usar `utils/logger.js`
- Passwords en texto plano o en logs
- Exponer `passwordHash` en respuestas API

## Comandos útiles
```bash
npm run dev          # nodemon
npm run start        # producción
npm run test         # node:test
npm run redis:seed   # seed de Redis con datos de localización
```
