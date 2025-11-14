


const express = require("express");
const router = express.Router();
const exportController = require("../controllers/exportController");

// existing exports
router.get("/merchant-history", exportController.exportMerchantHistory);
router.get("/branch-history", exportController.exportBranchHistory);
router.get("/top-merchants", exportController.exportTopMerchants);
router.get("/top-merchants_txn", exportController.exportTopMerchantsByTxnNumber);
router.get("/top-merchants_amount", exportController.exportTopMerchantsByTxnAmount);

// new date-range exports
router.get("/merchant-history/date", exportController.exportMerchantHistoryByDate);
router.get("/branch-history/date", exportController.exportBranchHistoryByDate);
router.get("/missing-transactions", exportController.getMissingTransactionDates);
router.get("/all-merchant-history-date", exportController.exportAllMerchantHistoryByDate);


module.exports = router;
