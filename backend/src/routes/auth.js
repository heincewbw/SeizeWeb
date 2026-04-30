const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { register, login, getMe, changePassword } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and a number'),
    body('full_name').trim().notEmpty().withMessage('Full name is required'),
  ],
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

router.get('/me', authenticateToken, getMe);

router.put(
  '/change-password',
  authenticateToken,
  [
    body('current_password').notEmpty().withMessage('Current password required'),
    body('new_password')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Must contain uppercase, lowercase, and a number'),
  ],
  changePassword
);

module.exports = router;
