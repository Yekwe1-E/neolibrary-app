const bookService = require('../services/bookService');
const reviewService = require('../services/reviewService');
const { supabaseAdmin } = require('../config/supabase');
const fs = require('fs');
const path = require('path');

class BookController {
  async getBooks(req, res, next) {
    try {
      const { search, genre, availability, page, limit, includeArchived } = req.query;
      
      const result = await bookService.getBooks({
        search,
        genre,
        availability,
        page,
        limit,
        includeArchived: includeArchived === 'true'
      });

      return res.status(200).json({
        status: 'success',
        ...result
      });
    } catch (err) {
      next(err);
    }
  }

  async getBookById(req, res, next) {
    try {
      const { id } = req.params;
      const book = await bookService.getBookById(id);
      
      if (!book) {
        return res.status(404).json({ status: 'error', message: 'Book not found' });
      }

      return res.status(200).json({
        status: 'success',
        data: book
      });
    } catch (err) {
      next(err);
    }
  }

  async createBook(req, res, next) {
    try {
      const book = await bookService.createBook(req.body, req.user.id);
      return res.status(201).json({
        status: 'success',
        message: 'Book created successfully.',
        data: book
      });
    } catch (err) {
      next(err);
    }
  }

  async updateBook(req, res, next) {
    try {
      const { id } = req.params;
      const book = await bookService.updateBook(id, req.body, req.user.id);

      if (!book) {
        return res.status(404).json({ status: 'error', message: 'Book not found' });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Book updated successfully.',
        data: book
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteBook(req, res, next) {
    try {
      const { id } = req.params;
      const success = await bookService.deleteBook(id, req.user.id);

      if (!success) {
        return res.status(404).json({ status: 'error', message: 'Book not found' });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Book archived successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  async uploadCover(req, res, next) {
    try {
      const { id } = req.params;
      if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'No image file uploaded.' });
      }

      const book = await bookService.getBookById(id);
      if (!book) {
        return res.status(404).json({ status: 'error', message: 'Book not found' });
      }

      const isMock = process.env.MOCK_MODE === 'true';
      let publicCoverUrl = '';

      if (isMock) {
        // Copy uploaded temp file to local public folder
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const ext = path.extname(req.file.originalname) || '.jpg';
        const fileName = `cover_${id}_${Date.now()}${ext}`;
        const finalPath = path.join(uploadDir, fileName);
        
        fs.renameSync(req.file.path, finalPath);
        publicCoverUrl = `/uploads/${fileName}`;
      } else {
        // Real Supabase storage upload
        const fileBuffer = fs.readFileSync(req.file.path);
        const ext = path.extname(req.file.originalname) || '.jpg';
        const fileName = `${id}/${Date.now()}${ext}`;
        
        const { data, error } = await supabaseAdmin.storage
          .from('book-covers')
          .upload(fileName, fileBuffer, {
            contentType: req.file.mimetype,
            upsert: true
          });

        if (error) {
          // Cleanup temp file
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ status: 'error', message: error.message });
        }

        // Get public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('book-covers')
          .getPublicUrl(fileName);
        
        publicCoverUrl = publicUrl;
        fs.unlinkSync(req.file.path); // Delete local temp file
      }

      const updatedBook = await bookService.updateBookCover(id, publicCoverUrl, req.user.id);
      return res.status(200).json({
        status: 'success',
        message: 'Book cover image uploaded successfully.',
        data: updatedBook
      });
    } catch (err) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path); // Cleanup temp file on failure
      }
      next(err);
    }
  }

  async getBookReviews(req, res, next) {
    try {
      const { id } = req.params;
      const reviews = await reviewService.getBookReviews(id);
      return res.status(200).json({
        status: 'success',
        data: reviews
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BookController();
