const reservationService = require('../services/reservationService');

class ReservationController {
  async getReservations(req, res, next) {
    try {
      const { patron_id } = req.query;
      const reservations = await reservationService.getReservations(
        req.user.id,
        req.user.role,
        { patron_id }
      );

      return res.status(200).json({
        status: 'success',
        data: reservations
      });
    } catch (err) {
      next(err);
    }
  }

  async createReservation(req, res, next) {
    try {
      const { book_id } = req.body;
      const reservation = await reservationService.createReservation(req.user.id, book_id, req.user.id);
      
      return res.status(201).json({
        status: 'success',
        message: 'Book reserved successfully. You will be notified when a copy becomes available.',
        data: reservation
      });
    } catch (err) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  }

  async cancelReservation(req, res, next) {
    try {
      const { id } = req.params;
      const reservation = await reservationService.cancelReservation(id, req.user.id);

      return res.status(200).json({
        status: 'success',
        message: 'Reservation cancelled successfully.',
        data: reservation
      });
    } catch (err) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  }

  async fulfillReservation(req, res, next) {
    try {
      const { id } = req.params;
      const reservation = await reservationService.fulfillReservation(id, req.user.id);

      return res.status(200).json({
        status: 'success',
        message: 'Reservation fulfilled. Patron has been notified.',
        data: reservation
      });
    } catch (err) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  }
}

module.exports = new ReservationController();
