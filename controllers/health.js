class HealthController {
  static async getHealth (req, res) {
    res.status(200).json({
      uptime: process.uptime(),
      message: 'OK',
      timestamp: Date.now()
    })
  }
}

export default HealthController
