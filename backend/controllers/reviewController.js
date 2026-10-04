const reviewService = require('../services/reviewService');

class ReviewController {
  async addReview(req, res, next) {
    try {
      const { book_id, rating, comment } = req.body;
      const review = await reviewService.addReview(book_id, req.user.id, rating, comment);
      
      return res.status(201).json({
        status: 'success',
        message: 'Review added successfully.',
        data: review
      });
    } catch (err) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  }

  async updateReview(req, res, next) {
    try {
      const { id } = req.params;
      const { rating, comment } = req.body;
      
      const review = await reviewService.updateReview(id, req.user.id, rating, comment);
      
      return res.status(200).json({
        status: 'success',
        message: 'Review updated successfully.',
        data: review
      });
    } catch (err) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  }

  async deleteReview(req, res, next) {
    try {
      const { id } = req.params;
      await reviewService.deleteReview(id, req.user.id, req.user.role);
      
      return res.status(200).json({
        status: 'success',
        message: 'Review deleted successfully.'
      });
    } catch (err) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  }
}

module.exports = new ReviewController();
