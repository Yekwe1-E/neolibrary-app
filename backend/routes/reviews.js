const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { validate } = require('../middleware/validation');
const checkAuth = require('../middleware/auth');

router.use(checkAuth);

router.post('/', validate('review'), reviewController.addReview);
router.put('/:id', validate('review'), reviewController.updateReview);
router.delete('/:id', reviewController.deleteReview);

module.exports = router;
