const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const checkAuth = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(checkAuth);
router.use(requireRole('admin', 'librarian'));

router.get('/stats', dashboardController.getStats);
router.get('/activity', dashboardController.getActivity);
router.get('/reports', dashboardController.getReports);

module.exports = router;
