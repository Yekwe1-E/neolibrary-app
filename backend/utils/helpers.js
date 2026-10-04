const { BUSINESS_RULES } = require('./constants');

/**
 * Calculates the fine amount for a borrowing record.
 * Fine: ₦50 per day overdue.
 * @param {string|Date} dueDate - The date by which the book was supposed to be returned
 * @param {string|Date|null} returnDate - The actual return date (or null if not returned yet)
 * @returns {number} The calculated fine amount
 */
const calculateFine = (dueDate, returnDate = null) => {
  const due = new Date(dueDate);
  const end = returnDate ? new Date(returnDate) : new Date();

  // Reset time portions to calculate whole days
  due.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffTime = end.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return diffDays * BUSINESS_RULES.FINE_RATE_PER_DAY;
  }

  return 0.00;
};

module.exports = {
  calculateFine
};
