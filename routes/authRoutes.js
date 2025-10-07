const express = require("express");
const router = express.Router();
const authCtrl = require("../controllers/authController");
const { authGuard, adminGuard } = require("../middleware/auth");

// Public
router.post("/login", authCtrl.login);
// User can change their own password
router.post("/change-password", authGuard, authCtrl.changePassword);

// Protected
router.get("/me", authGuard, authCtrl.getProfile);
router.post("/logout", authGuard, authCtrl.logout);

// Admin-only
router.post("/create", authGuard, adminGuard, authCtrl.createUser);
router.post("/deactivate/:user_id", authGuard, adminGuard, authCtrl.softDeleteUser);

module.exports = router;
//eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzU5Mzk5MTEyLCJleHAiOjE3NTk0MDI3MTJ9.SrmM2d3Mp3j8slxl6Ytl8I8cxs3nZ8ZtDpSKKBHNf8g