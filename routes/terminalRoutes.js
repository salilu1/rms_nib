const express = require("express");
const multer = require("multer");
const { uploadTerminals } = require("../controllers/terminalController");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("file"), uploadTerminals);

module.exports = router;
