


const express = require("express");
const router = express.Router();
const exportController = require("../controllers/exportController");

// existing exports
router.get("/merchant-history", exportController.exportMerchantHistory);
router.get("/branch-history", exportController.exportBranchHistory);
router.get("/top-merchants", exportController.exportTopMerchants);

// new date-range exports
router.get("/merchant-history/date", exportController.exportMerchantHistoryByDate);
router.get("/branch-history/date", exportController.exportBranchHistoryByDate);

module.exports = router;
