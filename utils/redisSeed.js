import { createHash } from 'crypto'
import { readFileSync } from 'fs'

import redisClient, { connectRedis } from './redisClient.js'

// Se lee con readFileSync y no con `import ... with { type: 'json' }`: esa
// sintaxis es de ES2025 y ESLint 8 ni siquiera la parsea.
const readTree = (file) =>
  JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8'))

// Create a unique ID with MD5
const generateUniqueID = (regionName) => {
  return createHash('md5').update(regionName).digest('hex')
}

// Helper to index terms in Redis with sorted sets (using country and priority)
const addToAutocomplete = async (key, term, id, countryCode, level1, level2, level3, levelType, priority) => {
  const words = term.toUpperCase().split(' ') // Split into words to create prefixes separately

  // Los nombres de campo del hash son snake_case a propósito: es el contrato
  // que leen el modelo y el frontend. Solo cambia el nombre de la variable.
  const hashValue = {
    term,
    country_code: countryCode,
    level1,
    level2,
    level3,
    level_type: levelType
  }
  await redisClient.hset(`${key}-data`, id, JSON.stringify(hashValue))
  console.log(`Saved in hash: ${key}-data`, id, JSON.stringify(hashValue))

  // Create prefixes for each word
  for (const word of words) {
    for (let i = 1; i <= word.length; i++) {
      const prefix = word.substring(0, i)
      // Include the country in the prefix key and add it with a score
      await redisClient.zadd(`${key}-index:${countryCode}:${prefix}`, priority, id)
      console.log(`Prefix: ${key}-index:${countryCode}:${prefix} -> id: ${id} with priority: ${priority}`)
    }
  }
}

// Load data into Redis
const loadDataToRedis = async (data) => {
  try {
    for (const level1 of data) {
      // Add regions with high priority (for example, 1)
      const regionNameLevel1 = `${level1.name}`
      const idLevel1 = generateUniqueID(regionNameLevel1)
      await addToAutocomplete('regions', regionNameLevel1, idLevel1, level1.country_code, level1.name, null, null, 1, 1)

      for (const level2 of level1.children) {
        // Add regions and municipalities with medium priority (for example, 2)
        const regionNameLevel2 = `${level1.name}, ${level2.name}`
        const idLevel2 = generateUniqueID(regionNameLevel2)
        await addToAutocomplete('regions', regionNameLevel2, idLevel2, level1.country_code, level1.name, level2.name, null, 2, 2)

        for (const level3 of level2.children) {
          // Add regions, municipalities, and localities with low priority (for example, 3)
          const regionNameLevel3 = `${level1.name}, ${level2.name}, ${level3.name}`
          const idLevel3 = generateUniqueID(regionNameLevel3)
          await addToAutocomplete('regions', regionNameLevel3, idLevel3, level1.country_code, level1.name, level2.name, level3.name, 3, 3)
        }
      }
    }
    console.log('Data loaded successfully.')
  } catch (err) {
    console.error('Error loading data into Redis:', err)
  }
}

// Initialize Redis
const initializeRedis = async () => {
  try {
    await connectRedis()
    await redisClient.flushdb() // Clear the current database
    await loadDataToRedis(readTree('regions_cu.json'))
    await loadDataToRedis(readTree('regions_do.json'))
  } catch (err) {
    console.error('Error initializing Redis:', err)
  } finally {
    redisClient.quit()
  }
}

initializeRedis()
