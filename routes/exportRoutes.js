// routes/exportRoutes.js
const express = require("express");
const router = express.Router();
const { exportMerchantHistory, exportBranchHistory,exportTopMerchants } = require("../controllers/exportController");

// Route to export merchant transaction history
router.get("/merchant-history", exportMerchantHistory);

// Route to export branch transaction history
router.get("/branch-history", exportBranchHistory);
router.get("/top-merchants", exportTopMerchants);

module.exports = router;
