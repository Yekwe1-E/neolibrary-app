const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const { validate } = require('../middleware/validation');
const checkAuth = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(checkAuth);

router.get('/', reservationController.getReservations);
router.post('/', validate('reservation'), reservationController.createReservation);
router.put('/:id/cancel', reservationController.cancelReservation);

// Admin / Librarian only
router.put('/:id/fulfill', requireRole('admin', 'librarian'), reservationController.fulfillReservation);

module.exports = router;
