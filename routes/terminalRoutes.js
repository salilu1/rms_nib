// routes/terminalRoutes.js
// routes/terminalRoutes.js
const express = require("express");
const router = express.Router();
const terminalController = require("../controllers/terminalController");
const { authGuard, adminGuard } = require("../middleware/auth");

// CREATE terminal — only admin
router.post("/", authGuard, adminGuard, terminalController.createTerminal);

// GET all terminals — any authenticated user
router.get("/", authGuard, terminalController.getTerminals);

// GET terminal by ID — any authenticated user
router.get("/:id", authGuard, terminalController.getTerminalById);

// UPDATE terminal — only admin
router.put("/:id", authGuard, adminGuard, terminalController.updateTerminal);

// SOFT DELETE terminal — only admin
router.delete("/:id", authGuard, adminGuard, terminalController.deleteTerminal);

module.exports = router;


// const express = require("express");
// const router = express.Router();
// const terminalController = require("../controllers/terminalController");

// router.post("/", terminalController.createTerminal);          // Create terminal
// router.get("/", terminalController.getTerminals);             // Get all terminals
// router.get("/:id", terminalController.getTerminalById);       // Get terminal by ID
// router.put("/:id", terminalController.updateTerminal);        // Update terminal
// router.delete("/:id", terminalController.deleteTerminal);     // Soft delete terminal

// module.exports = router;
