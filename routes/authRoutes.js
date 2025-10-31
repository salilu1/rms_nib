const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authGuard, adminGuard } = require("../middleware/auth");

// Public route
router.post('/login', authController.login);

// Routes for authenticated users
router.get('/profile', authGuard, authController.getProfile);
router.post('/change-password', authGuard, authController.changePassword);

// Routes only for admin
router.post('/users', authGuard, adminGuard, authController.createUser);
router.get('/users', authGuard, adminGuard, authController.getUsers);
router.get('/users/:id', authGuard, adminGuard, authController.getUserById);
router.put('/users/:id', authGuard, adminGuard, authController.updateUser);
router.delete('/users/:user_id', authGuard, adminGuard, authController.softDeleteUser);

module.exports = router;

// const express = require("express");
// const router = express.Router();
// const authCtrl = require("../controllers/authController");
// const { authGuard, adminGuard } = require("../middleware/auth");

// // Public
// router.post("/login", authCtrl.login);
// // User can change their own password
// router.post("/change-password", authGuard, authCtrl.changePassword);

// // Protected
// router.get("/me", authGuard, authCtrl.getProfile);


// // Admin-only
// router.post("/create", authGuard, adminGuard, authCtrl.createUser);
// router.post("/deactivate/:user_id", authGuard, adminGuard, authCtrl.softDeleteUser);

// module.exports = router;
