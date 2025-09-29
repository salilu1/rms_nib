// server.js
require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");

const app = express();
const port = 3000;

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });

// MySQL connection pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,  // your database
});
console.log("Upload route hit");

app.get('/', (req, res) => {
  res.send('Hello');
});

// API to upload Excel, merge with DB, and return merged Excel
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    // 1. Read uploaded Excel file
    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // 2. Fetch terminal info from DB
    const [rows] = await db.query(`
      SELECT terminal_id, terminal_name, district, branch
      FROM Terminals
    `);

    // Convert DB rows to a map for fast lookup
    const terminalMap = {};
    rows.forEach(row => {
      terminalMap[row.terminal_id] = row;
    });

    // 3. Merge Excel with DB data
    const mergedData = excelData.map(item => {
      const dbInfo = terminalMap[item.terminal_id] || {};
      return {
        terminal_id: item.terminal_id,
        transaction_volume: item.transaction_volume,
        transaction_amount: item.transaction_amount,
        terminal_name: dbInfo.terminal_name || "Unknown",
        branch: dbInfo.branch || "Unknown",
        district: dbInfo.district || "Unknown",
      };
    });

    // 4. Create new Excel file
    const newWorkbook = xlsx.utils.book_new();
    const newWorksheet = xlsx.utils.json_to_sheet(mergedData);
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, "MergedReport");

    const outputPath = "uploads/merged_report.xlsx";
    xlsx.writeFile(newWorkbook, outputPath);

    // 5. Send file to user
    res.download(outputPath, "merged_report.xlsx", () => {
      fs.unlinkSync(filePath); // remove uploaded file
      fs.unlinkSync(outputPath); // remove result after sending
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Something went wrong!");
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
