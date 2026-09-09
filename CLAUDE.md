# micasaestuya · api

Backend del portal de clasificados. Express + MongoDB + Redis.

> **Vocabulario compartido con `web`, y es lo más fácil de romper:**
>
> - **`region`** — un nodo del árbol administrativo: provincia, municipio,
>   localidad. Nunca lleva calle ni coordenadas.
> - **`address`** — la región **más** la calle y el número. Vive en el anuncio.
> - **`locale`** — país + idioma (`es-CU`, `en-DO`).
>
> El porqué está en `web/docs/regions.md`. Antes de renombrar nada de esta zona,
> léelo: estos nombres ya cambiaron dos veces y volver atrás cuesta.

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
| User     | schemas/user   | JWT auth, bcrypt, roles pendientes |
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
`web/docs/tooling.md`.

**El lint no se puede correr desde el host.** `node_modules` vive en el volumen
de Docker, así que en el disco está vacío:

```bash
docker compose exec express npm run lint
```

**En el CI usa `CI_REGISTRY_IMAGE`**, nunca una ruta de registro escrita a mano:
el proyecto pasó de llamarse `backend` a `api` y las rutas fijas se quedaron
apuntando a un sitio que ya no existe.

## Convenciones de código

### Rutas
```js
// routes/properties.js
import { Router } from 'express'
import { PropertyController } from '../controllers/property.js'
import { auth } from '../utils/middleware.js'

const propertyRouter = Router()
propertyRouter.get('/', PropertyController.getAll)
propertyRouter.post('/', auth, PropertyController.create)
export { propertyRouter }
```

### Controllers
```js
// controllers/property.js — solo lógica HTTP
export const PropertyController = {
  async getAll(req, res) {
    const properties = await PropertyModel.getAll(req.query)
    res.json(properties)
  }
}
```

### Models
```js
// models/property.js — lógica de negocio + queries
import PropertySchema from '../schemas/property.js'

class PropertyModel {
  static async getAll(filters = {}) { ... }
  static async getById(id) { ... }
  static async create(data) { ... }
  static async update(id, data) { ... }
}
export default PropertyModel
```

### Schemas Mongoose
```js
// schemas/property.js
import { Schema, model } from 'mongoose'
import mongooseUniqueValidator from 'mongoose-unique-validator'

const propertySchema = new Schema({
  title: { type: String, required: true },
  // ...
}, { timestamps: true })

propertySchema.plugin(mongooseUniqueValidator)
export default model('Property', propertySchema)
```

## Endpoints actuales
```
GET  /api/health          → health check
POST /api/users/create    → registro
POST /api/users/login     → login (devuelve JWT)
GET  /api/users/current   → usuario actual (auth requerida)
GET  /api/regions/suggest   → autocompletado por prefijo (Redis)
                              ?term= &country_code= [&level_type=1|2|3]
GET  /api/regions/children  → hijos de un nodo del árbol (memoria)
                              ?country_code= [&level1= &level2= &level3=]
```

## Autenticación
- JWT en Authorization header: `Bearer <token>`
- Token sin expiración (pendiente: añadir expiración + refresh)
- Roles pendientes: `guest` | `host` | `admin`
- Middleware `auth` en `utils/middleware.js`

## Manejo de errores
- `express-async-errors` captura errores async automáticamente
- Middleware `errorHandler` en `utils/middleware.js`
- NO usar try/catch en controllers — propagarlo al error handler
- SÍ usar try/catch en models cuando sea necesario para logging

## Variables de entorno (.env)
```
MONGODB_URI=
PORT=3001
SECRET=           # JWT secret
REDIS_URI=        # Redis connection
NODE_ENV=         # development | test | production
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
