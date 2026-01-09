const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth, adminAuth } = require('../middleware/auth');

// Public routes
router.post('/login', authController.login);

// Protected routes
router.get('/profile', auth, authController.getProfile);
router.put('/profile', auth, authController.updateProfile);
router.put('/change-password', auth, authController.changePassword);

// Admin routes
router.post('/register', adminAuth, authController.register);
router.get('/users', adminAuth, authController.getUsers);
router.get('/users/:id', adminAuth, authController.getUser);
router.put('/users/:id', adminAuth, authController.updateUser);
router.delete('/users/:id', adminAuth, authController.deleteUser);
router.put('/users/:id/status', adminAuth, authController.toggleUserStatus);
router.post('/users/:id/reset-password', adminAuth, authController.resetPassword);

module.exports = router;
