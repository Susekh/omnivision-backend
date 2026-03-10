const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authAdmin = require('../middlewares/auth.admin');

// registration/login/logout endpoints
router.post('/register', adminController.registerAdmin); 
router.post('/login', adminController.loginAdmin);
router.post('/logout', authAdmin, adminController.logoutAdmin);

module.exports = router;
