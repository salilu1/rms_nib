const express = require("express");
const multer = require("multer");
const { uploadReport } = require("../controllers/reportController");
const {uploadBranchReport} = require("../controllers/branchTerminalController")
const { authGuard, adminGuard } = require("../middleware/auth");
const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/", authGuard, adminGuard, upload.single("file"), uploadReport);

router.post("/branch", authGuard, adminGuard, upload.single("file"), uploadBranchReport);


module.exports = router;


