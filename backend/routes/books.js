const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const bookController = require('../controllers/bookController');
const { validate } = require('../middleware/validation');
const checkAuth = require('../middleware/auth');
const { requireRole, requireOwnership } = require('../middleware/rbac');

// Setup multer for temp local uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'tmp');
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only image files (jpeg/jpg/png/webp) are supported."));
  }
});

// Public read endpoints
router.get('/', bookController.getBooks);
router.get('/:id', bookController.getBookById);
router.get('/:id/reviews', bookController.getBookReviews);

// Protected endpoints (Admins & Librarians)
router.use(checkAuth);
router.use(requireRole('admin', 'librarian'));

router.post('/', validate('book'), bookController.createBook);
router.put('/:id', validate('book'), bookController.updateBook);
router.delete('/:id', requireRole('admin'), bookController.deleteBook);
router.post('/:id/cover', upload.single('cover'), bookController.uploadCover);

module.exports = router;
