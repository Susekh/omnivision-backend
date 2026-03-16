const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authAdmin = require('../middlewares/auth.admin');

// registration/login/logout endpoints
router.post('/register', adminController.registerAdmin); 
router.post('/login', adminController.loginAdmin);
router.post('/logout', authAdmin, adminController.logoutAdmin);

// Check Authentication Route
router.get('/check-auth', authAdmin, (req, res) => {
  res.status(200).json({
    message: 'Authenticated',
    admin: {
      id: req.admin._id,
      email: req.admin.email,
      fullname: req.admin.fullname || 'Admin'
    }
  });
});

module.exports = router;
