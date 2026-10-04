const dashboardService = require('../services/dashboardService');

class DashboardController {
  async getStats(req, res, next) {
    try {
      const stats = await dashboardService.getSystemStats();
      
      return res.status(200).json({
        status: 'success',
        data: stats
      });
    } catch (err) {
      next(err);
    }
  }

  async getActivity(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const activity = await dashboardService.getRecentActivity(limit);
      
      return res.status(200).json({
        status: 'success',
        data: activity
      });
    } catch (err) {
      next(err);
    }
  }

  async getReports(req, res, next) {
    try {
      const { type } = req.query;
      if (!type) {
        return res.status(400).json({ status: 'error', message: 'Report type is required.' });
      }

      const reportData = await dashboardService.generateReport(type);
      
      return res.status(200).json({
        status: 'success',
        data: reportData
      });
    } catch (err) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  }
}

module.exports = new DashboardController();
