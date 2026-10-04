const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const checkAuth = require('../middleware/auth');
const { requireRole, requireSelfOrAdmin } = require('../middleware/rbac');

router.use(checkAuth);

// Admin only lists
router.get('/', requireRole('admin'), userController.getUsers);
router.put('/:id/role', requireRole('admin'), userController.updateUserRole);
router.delete('/:id', requireRole('admin'), userController.deactivateUser);

// User or Admin endpoints
router.get('/:id', requireSelfOrAdmin, userController.getUserById);
router.put('/:id', requireSelfOrAdmin, userController.updateUser);
router.get('/:id/borrowings', requireSelfOrAdmin, userController.getUserBorrowings);
router.get('/:id/fines', requireSelfOrAdmin, userController.getUserFines);
router.post('/:id/pay-fines', requireSelfOrAdmin, userController.payFines);

module.exports = router;
