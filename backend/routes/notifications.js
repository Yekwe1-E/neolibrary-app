const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const checkAuth = require('../middleware/auth');

router.use(checkAuth);

router.get('/', notificationController.getNotifications);
router.put('/read-all', notificationController.markAllAsRead);
router.put('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
