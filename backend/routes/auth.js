const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate } = require('../middleware/validation');
const checkAuth = require('../middleware/auth');

// Public endpoints
router.post('/register', validate('register'), authController.register);
router.post('/login', validate('login'), authController.login);

// Protected endpoints
router.use(checkAuth); // All routes below require token
router.get('/me', authController.me);
router.put('/me', authController.updateMe);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);

module.exports = router;
