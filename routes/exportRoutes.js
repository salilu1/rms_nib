


const express = require("express");
const router = express.Router();
const exportController = require("../controllers/exportController");

// existing exports
router.get("/merchant-history", exportController.exportMerchantHistory);
router.get("/branch-history", exportController.exportBranchHistory);
router.get("/top-merchants", exportController.exportTopMerchants);
router.get("/top-merchants-txn", exportController.exportTopMerchantsByTxnNumber);
router.get("/top-merchants-amount", exportController.exportTopMerchantsByTxnAmount);

// new date-range exports
router.get("/merchant-history/date", exportController.exportMerchantHistoryByDate);
router.get("/branch-history/date", exportController.exportBranchHistoryByDate);
router.get("/missing-transactions", exportController.getMissingTransactionDates);

router.get("/all-merchant-history-date", exportController.exportAllMerchantHistoryByDate);
router.get("/all-branch-history-date", exportController.exportAllBranchHistoryByDate);
router.get("/missing-branch-transaction-dates", exportController.getMissingBranchTransactionDates);


module.exports = router;
