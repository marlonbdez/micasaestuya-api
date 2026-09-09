import RegionModel from '../models/region.js'

const VALID_LEVEL_TYPES = ['1', '2', '3']

class RegionController {
  static async suggest (req, res) {
    const term = req.query.term
    const countryCode = req.query.country_code
    const levelType = req.query.level_type

    if (!term || !countryCode) {
      return res.status(400).json({ message: 'Invalid params.' })
    }

    // El nivel acaba siendo una puntuación de Redis, así que se valida antes
    // en vez de dejar pasar cualquier valor.
    if (levelType !== undefined && !VALID_LEVEL_TYPES.includes(levelType)) {
      return res.status(400).json({ message: 'Invalid level_type.' })
    }

    const suggest = await RegionModel.suggest(
      term,
      countryCode,
      levelType ? Number(levelType) : undefined
    )
    res.status(200).json(suggest)
  }

  static async children (req, res) {
    const countryCode = req.query.country_code
    const levels = [req.query.level1, req.query.level2, req.query.level3]

    if (!countryCode) {
      return res.status(400).json({ message: 'Invalid params.' })
    }

    // Se toman los niveles seguidos desde el principio. Si después del corte
    // queda alguno relleno, hay un hueco en la cadena y no identifica nada.
    const parents = []
    for (const level of levels) {
      if (!level) break
      parents.push(level)
    }
    if (levels.slice(parents.length).some(Boolean)) {
      return res.status(400).json({ message: 'Parent levels are required.' })
    }
    const children = RegionModel.children(countryCode, parents)

    if (children === null) {
      return res.status(404).json({ message: 'Region not found.' })
    }

    res.status(200).json(children)
  }
}

export default RegionController
