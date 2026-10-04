const userService = require('../services/userService');

class UserController {
  async getUsers(req, res, next) {
    try {
      const users = await userService.getUsers();
      return res.status(200).json({
        status: 'success',
        data: users
      });
    } catch (err) {
      next(err);
    }
  }

  async getUserById(req, res, next) {
    try {
      const { id } = req.params;
      const user = await userService.getUserById(id);
      
      if (!user) {
        return res.status(404).json({ status: 'error', message: 'User not found' });
      }

      return res.status(200).json({
        status: 'success',
        data: user
      });
    } catch (err) {
      next(err);
    }
  }

  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      // Prevent role or status update via this endpoint (use specific endpoints instead)
      const { full_name, phone, address, avatar_url } = req.body;
      
      const user = await userService.updateUser(id, { full_name, phone, address, avatar_url }, req.user.id);
      
      if (!user) {
        return res.status(404).json({ status: 'error', message: 'User not found' });
      }

      return res.status(200).json({
        status: 'success',
        message: 'User profile updated successfully.',
        data: user
      });
    } catch (err) {
      next(err);
    }
  }

  async updateUserRole(req, res, next) {
    try {
      const { id } = req.params;
      const { role } = req.body;
      
      if (!['admin', 'librarian', 'patron'].includes(role)) {
        return res.status(400).json({ status: 'error', message: 'Invalid role specified.' });
      }

      const user = await userService.updateUserRole(id, role, req.user.id);
      
      if (!user) {
        return res.status(404).json({ status: 'error', message: 'User not found' });
      }

      return res.status(200).json({
        status: 'success',
        message: 'User role updated successfully.',
        data: user
      });
    } catch (err) {
      next(err);
    }
  }

  async deactivateUser(req, res, next) {
    try {
      const { id } = req.params;
      const success = await userService.deactivateUser(id, req.user.id);
      
      if (!success) {
        return res.status(404).json({ status: 'error', message: 'User not found' });
      }

      return res.status(200).json({
        status: 'success',
        message: 'User account suspended.'
      });
    } catch (err) {
      next(err);
    }
  }

  async getUserBorrowings(req, res, next) {
    try {
      const { id } = req.params;
      const borrowings = await userService.getUserBorrowings(id);
      
      return res.status(200).json({
        status: 'success',
        data: borrowings
      });
    } catch (err) {
      next(err);
    }
  }

  async getUserFines(req, res, next) {
    try {
      const { id } = req.params;
      const fines = await userService.getUserFines(id);
      
      return res.status(200).json({
        status: 'success',
        data: fines
      });
    } catch (err) {
      next(err);
    }
  }

  async payFines(req, res, next) {
    try {
      const { id } = req.params;
      const { amount } = req.body;

      const result = await userService.payFines(id, amount, req.user.id);
      
      return res.status(200).json({
        status: 'success',
        message: `Payment of ₦${result.original_paid} processed successfully.`,
        data: result
      });
    } catch (err) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  }
}

module.exports = new UserController();
