const express = require("express");
const multer = require("multer");
const { uploadReport } = require("../controllers/reportController");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("file"), uploadReport);

module.exports = router;
