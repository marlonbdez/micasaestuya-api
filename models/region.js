import { readFileSync } from 'fs'
import redisClient from '../utils/redisClient.js'

const RESULT_LIMIT = 10

// Se lee con readFileSync y no con `import ... with { type: 'json' }`: esa
// sintaxis es de ES2025 y ESLint 8 ni siquiera la parsea, así que rompía el
// lint del CI. Se ejecuta una vez al arrancar, no en cada petición.
const readTree = (file) =>
  JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8'))

// La jerarquía se lee del fichero fuente, no de Redis: el índice de Redis
// está construido por prefijo para el autocompletado y no sabe responder
// "dame los hijos de X". Son datos estáticos, así que en memoria basta.
const TREES = { CU: readTree('regions_cu.json'), DO: readTree('regions_do.json') }

class RegionModel {
  static async suggest (term, countryCode, levelType) {
    // Dividir el término en palabras separadas por espacios
    const searchTerms = term.split(' ').map(t => t.trim()).filter(t => t)
    const cacheKey = `regions-cache:${countryCode}:${searchTerms.join('|')}` // Clave de caché usando el país y el término
    let result = []

    // Filtrar por nivel es filtrar por puntuación: al sembrar (redisSeed.js)
    // las provincias se guardan con 1, los municipios con 2 y las localidades
    // con 3. El filtro se aplica siempre en el mismo sitio, venga el conjunto
    // de la caché o del índice, para que ambos devuelvan lo mismo.
    const readIds = (key) => levelType
      ? redisClient.zrangebyscore(key, levelType, levelType, 'LIMIT', 0, RESULT_LIMIT)
      : redisClient.zrange(key, 0, RESULT_LIMIT - 1)

    try {
      let ids = await readIds(cacheKey)

      if (ids.length === 0) {
        const prefixedKeys = searchTerms.map(prefix => `regions-index:${countryCode}:${prefix.toUpperCase()}`)

        if (prefixedKeys.length === 1) {
          ids = await readIds(prefixedKeys[0])
        } else {
          const tempSetKey = `regions-temp:${Date.now()}`
          // AGGREGATE MIN conserva la puntuación original. Por defecto Redis
          // suma la de cada prefijo, así que con dos palabras una provincia
          // pasaría a valer 2 y el filtro por nivel dejaría de encontrarla.
          await redisClient.zinterstore(tempSetKey, prefixedKeys.length, ...prefixedKeys, 'AGGREGATE', 'MIN')
          await redisClient.expire(tempSetKey, 600)
          ids = await readIds(tempSetKey)
          if (ids.length > 0) {
            await redisClient.rename(tempSetKey, cacheKey) // Guardar en caché
          }
        }
      }

      if (ids.length > 0) {
        result = await redisClient.hmget('regions-data', ...ids)
        result = result.map(r => JSON.parse(r))
      }

      const formattedResults = result.map((region) => {
        let highlightedText = region.term

        searchTerms.forEach(searchTerm => {
          const regex = new RegExp(`(${searchTerm})`, 'gi')
          highlightedText = highlightedText.replace(regex, '<b>$1</b>')
        })

        return {
          ...region,
          highlighted_text: highlightedText
        }
      })

      return formattedResults
    } catch (error) {
      console.error('Error fetching suggest', error)
    }
  }

  // Hijos del nodo indicado: sin padres son las provincias, con uno sus
  // municipios, con dos sus localidades. Devuelve null si el nodo no existe.
  static children (countryCode, parents = []) {
    let nodes = TREES[countryCode]
    if (!nodes) return null

    for (const parent of parents) {
      const node = nodes.find((candidate) => candidate.name === parent)
      if (!node) return null
      nodes = node.children || []
    }

    return nodes.map(({ name }) => ({ name }))
  }
}

export default RegionModel
