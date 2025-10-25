const express = require("express");
const multer = require("multer");
const { uploadReport } = require("../controllers/reportController");
const {uploadBranchReport} = require("../controllers/branchTerminalController")
const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("file"), uploadReport);
router.post("/branch", upload.single("file"), uploadBranchReport)

module.exports = router;
