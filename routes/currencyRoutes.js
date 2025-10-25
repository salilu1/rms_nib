const express = require("express");
const router = express.Router();
const { updateExchangeRates } = require("../controllers/currencyController");

// PUT /api/currency/update-all
router.put("/update-all", updateExchangeRates);

module.exports = router;
