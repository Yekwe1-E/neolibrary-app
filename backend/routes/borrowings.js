const express = require('express');
const router = express.Router();

const borrowingController = require('../controllers/borrowingController');
const { validate } = require('../middleware/validation');
const checkAuth = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(checkAuth);

// All roles can view their own borrowings
router.get('/', borrowingController.getBorrowings);

// Patron Actions
router.post('/', validate('borrowing'), borrowingController.checkoutBook);
router.put('/:id/renew', borrowingController.renewBook);

// Admin / Librarian Actions
router.get('/overdue', requireRole('admin', 'librarian'), borrowingController.getOverdueBorrowings);
router.get('/stats', requireRole('admin', 'librarian'), borrowingController.getStats);
router.put('/:id/return', requireRole('admin', 'librarian'), borrowingController.returnBook);

module.exports = router;
