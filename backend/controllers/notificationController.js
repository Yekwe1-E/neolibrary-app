const notificationService = require('../services/notificationService');

class NotificationController {
  async getNotifications(req, res, next) {
    try {
      const notifications = await notificationService.getNotifications(req.user.id);
      
      return res.status(200).json({
        status: 'success',
        data: notifications
      });
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      const success = await notificationService.markAsRead(id, req.user.id);
      
      if (!success) {
        return res.status(404).json({ status: 'error', message: 'Notification not found' });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Notification marked as read.'
      });
    } catch (err) {
      next(err);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      await notificationService.markAllAsRead(req.user.id);
      
      return res.status(200).json({
        status: 'success',
        message: 'All notifications marked as read.'
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteNotification(req, res, next) {
    try {
      const { id } = req.params;
      const success = await notificationService.deleteNotification(id, req.user.id);
      
      if (!success) {
        return res.status(404).json({ status: 'error', message: 'Notification not found' });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Notification deleted successfully.'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NotificationController();
