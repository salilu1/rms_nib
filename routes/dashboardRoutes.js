const express = require("express");
const router = express.Router();
const { getActiveCounts } = require("../controllers/dashboardController");

router.get("/active-counts", getActiveCounts);

module.exports = router;
