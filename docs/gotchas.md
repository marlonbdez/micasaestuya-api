# Errores y trampas de api

Trampas de este repo que no se ven ejecutando la app en local — solo se notan
en el CI o leyendo el código con cuidado.

## 1. Que Node lo ejecute no significa que el linter lo entienda

`models/region.js` cargaba el árbol así:

```js
import regionsCU from '../data/regions_cu.json' with { type: 'json' }
```

Funcionaba perfectamente en local y el endpoint respondía. Pero el CI falló con
`Parsing error: Unexpected token with`. Los _import attributes_ son ES2025:
Node los ejecuta, **ESLint 8 no los parsea**, y no hay `ecmaVersion` que lo
arregle — probamos 2023, 2024, 2025 y `latest`. El soporte llega en ESLint 9,
que obliga a migrar a flat config, y `eslint-config-standard@17` aún no lo
soporta.

Se resolvió sin tocar la versión de ESLint:

```js
const readTree = (file) =>
  JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8'))
```

Corre una sola vez al arrancar, igual que el import.

**Lo que enseña:** "funciona en mi máquina" y "pasa el lint" son dos preguntas
distintas, y el toolchain puede ir por detrás del runtime. Además, esto se nos
escapó porque `api/node_modules` está **vacío en el host** — las dependencias
viven en el volumen de Docker — así que el lint de `api` no se puede ejecutar
desde fuera del contenedor. Para correrlo:
`docker compose exec express npm run lint`.

De paso, `utils/redisSeed.js` salió de `.eslintignore` (que quedó vacío y se
borró) y pasó a estilo `standard`. Ojo con un detalle al hacerlo: el parámetro
`country_code` tuvo que pasar a `countryCode` por la regla `camelcase`, pero el
campo que se guarda en Redis **sigue siendo `country_code`**, porque es el
contrato que leen el modelo y el frontend:

```js
const hashValue = { term, country_code: countryCode, ..., level_type: levelType }
```

## 2. El filtro por nivel en `/regions/suggest`

`suggest` devolvía los diez primeros resultados sin poder filtrar, y buscar
"Haba" daba una provincia y nueve municipios: cero localidades. La clave estaba
en el sembrado (`redisSeed.js`): cada entrada se indexa con
`zadd(clave, prioridad, id)` donde la prioridad es **1 para provincias, 2 para
municipios y 3 para localidades**. La puntuación de Redis ya _es_ el nivel, y
`zrange(clave, 0, 9)` ordena por puntuación, así que las localidades nunca
entraban en el corte.

```js
const readIds = (key) =>
  levelType
    ? redisClient.zrangebyscore(
        key,
        levelType,
        levelType,
        'LIMIT',
        0,
        RESULT_LIMIT
      )
    : redisClient.zrange(key, 0, RESULT_LIMIT - 1)
```

Con dos detalles que no son opcionales:

**`AGGREGATE MIN` en el `zinterstore`.** Las búsquedas de varias palabras cruzan
una lista por prefijo, y Redis **suma** las puntuaciones por defecto: "La Habana"
convertiría una localidad de nivel 3 en un 6. `MIN` conserva la puntuación y no
altera el orden.

**El filtro se aplica al leer, no al guardar.** Por eso la clave de caché no
lleva el nivel: la caché almacena el cruce completo y cada petición se queda con
lo suyo.

## 3. `/regions/children` lee el árbol en memoria, no Redis

El índice de Redis está construido por prefijo para el autocompletado y no sabe
responder "dame los hijos de X". Los ficheros `data/regions_*.json` son datos
estáticos de solo lectura, así que en memoria basta, y de paso evita tener que
resembrar Redis para servir esta ruta.

---

## Guardarraíles en el código

| Dónde                                | Qué protege                                                |
| -------------------------------------- | ------------------------------------------------------------ |
| `models/region.js` · `readIds`        | Filtrar por nivel es filtrar por puntuación de Redis.       |
| `models/region.js` · `AGGREGATE MIN`  | Sin esto, el filtro falla en búsquedas de varias palabras.  |
| `models/region.js` · `TREES`          | La jerarquía se lee del fichero, no de Redis, y por qué.    |
