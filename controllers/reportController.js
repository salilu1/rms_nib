const xlsx = require("xlsx");
const fs = require("fs");
const db = require("../config/db");

exports.uploadReport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    // 1. Read uploaded Excel file
    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // 2. Fetch terminal info from DB with branch and district
    const [rows] = await db.query(`
      SELECT 
        t.terminal_code,
        t.merchant_name,
        d.district_name AS district,
        b.branch_name AS branch
      FROM Terminal t
      JOIN branch b ON t.branch_id = b.branch_id
      JOIN district d ON b.district_id = d.district_id
    `);

    // 3. Convert DB rows to a map for fast lookup using terminal_code
    const terminalMap = {};
    rows.forEach(row => {
      terminalMap[row.terminal_code] = row;
    });

    const exchangeRate = 137; // Birr to USD conversion rate

    // 4. Merge Excel with DB data + Add USD conversion columns
    const mergedData = excelData.map(item => {
      const dbInfo = terminalMap[item["TERMINAL ID"]] || {};

      // safely convert to numbers before dividing
      const visaAmount = Number(item["SUM VISA AMOUNT"]) || 0;
      const mcAmount = Number(item["SUM MC AMOUNT"]) || 0;
      const upAmount = Number(item["SUM UP AMOUNT"]) || 0;

      return {
        merchant_name: item["MER_ENSE"] || "Unknown",
        terminal_id: item["TERMINAL ID"],
        sum_local_txn: item["SUM LOCAL TXN"] || 0,
        sum_local_txn_amount: item["SUM LOCAL TXN AMNT"] || 0,
        sum_visa_txn: item["SUM VISA TXN"] || 0,
        sum_visa_amount: visaAmount,
        visa_dollar: (visaAmount / exchangeRate).toFixed(2),
        sum_mc_txn: item["SUM MC TXN"] || 0,
        sum_mc_amount: mcAmount,
        mc_dollar: (mcAmount / exchangeRate).toFixed(2),
        sum_up_txn: item["SUM UP TXN"] || 0,
        sum_up_amount: upAmount,
        up_dollar: (upAmount / exchangeRate).toFixed(2),
        sum_total_txn: item["SUM TOTAL TXN"] || 0,
        sum_total_amount: item["SUM TOTAL AMOUNT"] || 0,
       // terminal_name: dbInfo.terminal_name || "Unknown",
        branch: dbInfo.branch || "Unknown",
        district: dbInfo.district || "Unknown",
      };
    });

    // 5. Create new Excel file
    const newWorkbook = xlsx.utils.book_new();
    const newWorksheet = xlsx.utils.json_to_sheet(mergedData);
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, "MergedReport");

    const outputPath = "uploads/merged_report.xlsx";
    xlsx.writeFile(newWorkbook, outputPath);

    // 6. Send file to user
    res.download(outputPath, "merged_report.xlsx", () => {
      fs.unlinkSync(filePath);   // remove uploaded file
      fs.unlinkSync(outputPath); // remove result after sending
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Something went wrong!");
  }
};
