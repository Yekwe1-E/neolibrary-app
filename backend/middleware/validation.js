const validate = (type) => {
  return (req, res, next) => {
    const body = req.body;
    const errors = [];

    if (type === 'register') {
      if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        errors.push("A valid email address is required.");
      }
      if (!body.password || body.password.length < 6) {
        errors.push("Password must be at least 6 characters long.");
      }
      if (!body.full_name || body.full_name.trim().length === 0) {
        errors.push("Full name is required.");
      }
    }

    else if (type === 'login') {
      if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        errors.push("A valid email address is required.");
      }
      if (!body.password) {
        errors.push("Password is required.");
      }
    }

    else if (type === 'book') {
      if (!body.title || body.title.trim().length === 0) {
        errors.push("Book title is required.");
      }
      if (!body.author || body.author.trim().length === 0) {
        errors.push("Book author is required.");
      }
      if (body.isbn) {
        const isbnClean = body.isbn.replace(/[-\s]/g, '');
        if (isbnClean.length !== 10 && isbnClean.length !== 13) {
          errors.push("ISBN must be exactly 10 or 13 digits.");
        }
      } else {
        errors.push("Book ISBN is required.");
      }
      if (body.total_copies === undefined || parseInt(body.total_copies) < 0) {
        errors.push("Total copies must be a non-negative number.");
      }
    }

    else if (type === 'borrowing') {
      if (!body.book_id) {
        errors.push("Book ID is required.");
      }
      // patron_id can be inferred from req.user except when librarians borrow on behalf of patrons
      if (!body.patron_id && !req.user) {
        errors.push("Patron ID is required.");
      }
    }

    else if (type === 'reservation') {
      if (!body.book_id) {
        errors.push("Book ID is required.");
      }
    }

    else if (type === 'review') {
      if (body.rating === undefined || parseInt(body.rating) < 1 || parseInt(body.rating) > 5) {
        errors.push("Review rating must be an integer between 1 and 5.");
      }
      if (!body.comment || body.comment.trim().length === 0) {
        errors.push("Review comment is required.");
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "Validation failed.",
        errors
      });
    }

    next();
  };
};

module.exports = {
  validate
};
