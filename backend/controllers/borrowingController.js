const borrowingService = require('../services/borrowingService');

class BorrowingController {
  async getBorrowings(req, res, next) {
    try {
      const { status, patron_id } = req.query;
      const borrowings = await borrowingService.getBorrowings(
        req.user.id,
        req.user.role,
        { status, patron_id }
      );

      return res.status(200).json({
        status: 'success',
        data: borrowings
      });
    } catch (err) {
      next(err);
    }
  }

  async checkoutBook(req, res, next) {
    try {
      const { book_id } = req.body;
      let { patron_id } = req.body;

      // In case a patron is borrowing, patron_id defaults to their own user id.
      // Librarians/Admins can borrow on behalf of other patrons by specifying patron_id.
      if (req.user.role === 'patron') {
        patron_id = req.user.id;
      } else if (!patron_id) {
        return res.status(400).json({ status: 'error', message: 'Patron ID is required for checkout.' });
      }

      const borrowing = await borrowingService.checkoutBook(patron_id, book_id, req.user.id);
      return res.status(201).json({
        status: 'success',
        message: 'Book borrowed successfully.',
        data: borrowing
      });
    } catch (err) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  }

  async returnBook(req, res, next) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const borrowing = await borrowingService.returnBook(id, req.user.id, notes);

      return res.status(200).json({
        status: 'success',
        message: 'Book returned successfully.',
        data: borrowing
      });
    } catch (err) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  }

  async renewBook(req, res, next) {
    try {
      const { id } = req.params;
      const renewed = await borrowingService.renewBook(id, req.user.id);

      return res.status(200).json({
        status: 'success',
        message: 'Borrowing renewed successfully.',
        data: renewed
      });
    } catch (err) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  }

  async getOverdueBorrowings(req, res, next) {
    try {
      const overdue = await borrowingService.getOverdueBorrowings();
      return res.status(200).json({
        status: 'success',
        data: overdue
      });
    } catch (err) {
      next(err);
    }
  }

  async getStats(req, res, next) {
    try {
      // General stats are routed to dashboard controller.
      // Borrowing specific stats:
      const list = await borrowingService.getBorrowings(req.user.id, req.user.role);
      const total = list.length;
      const active = list.filter(b => b.return_date === null).length;
      const returned = list.filter(b => b.return_date !== null).length;
      const overdue = list.filter(b => b.return_date === null && new Date(b.due_date) < new Date()).length;

      return res.status(200).json({
        status: 'success',
        data: {
          total_borrowings: total,
          active_loans: active,
          returned_loans: returned,
          overdue_loans: overdue
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BorrowingController();
