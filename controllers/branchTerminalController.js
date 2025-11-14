const xlsx = require("xlsx");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.uploadBranchReport = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // 1. Get transaction_date from request body
    const { transaction_date } = req.body;
    if (!transaction_date)
      return res.status(400).json({ message: "transaction_date is required (YYYY-MM-DD)" });

    const startOfDay = new Date(transaction_date);
    const dateStr = transaction_date;

    // 2. Check if branch transaction history already exists for that date
    const existingHistory = await prisma.branchtransactionhistory.findFirst({
      where: { transaction_date: startOfDay },
    });
    if (existingHistory) {
      return res
        .status(400)
        .json({ message: `Branch report already uploaded for ${dateStr}` });
    }

    // 3. Read uploaded Excel file
    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // 4. Fetch terminals and currency rates
    const [terminals, currencies] = await Promise.all([
      prisma.terminal.findMany({
        select: {
          terminal_code: true,
          merchant_name: true,
          grand_total: true,
          grand_total_updated_at: true,
          branch: { select: { branch_name: true, district: { select: { district_name: true } } } },
        },
      }),
      prisma.currency.findMany({
        select: { currency_code: true, exchange_rate: true, last_updated: true },
      }),
    ]);

    // 5. Map terminals
    const terminalMap = {};
    terminals.forEach(t => {
      terminalMap[t.terminal_code] = {
        merchant_name: t.merchant_name,
        branch: t.branch?.branch_name || "Unknown",
        district: t.branch?.district?.district_name || "Unknown",
        grand_total: t.grand_total ? Number(t.grand_total) : 0,
        grand_total_updated_at: t.grand_total_updated_at
          ? t.grand_total_updated_at.toISOString().split("T")[0]
          : null,
      };
    });

    // 6. Map currencies and validate rates
    const currencyMap = {};
    currencies.forEach(c => {
      currencyMap[c.currency_code] = {
        rate: Number(c.exchange_rate),
        last_updated: c.last_updated ? c.last_updated.toISOString().split("T")[0] : null,
      };
    });

    const missingRates = ["VC", "MC", "CUP"].filter(
      code => !currencyMap[code] || currencyMap[code].last_updated !== dateStr
    );
    if (missingRates.length > 0) {
      return res.status(400).json({
        message: `Currency exchange rates not updated for ${dateStr}. Missing: ${missingRates.join(
          ", "
        )}`,
      });
    }

    // 7. Insert branch transaction history
    const historyData = excelData.map(item => ({
      branch_name: item["Branch Name"] || "Unknown",
      terminal_id: item["Terminal ID"] || "Unknown",
      cash_advance: parseInt(item["Cash Advance"]) || 0,
      cash_advance_amount: parseFloat(item["Cash Advance Amount"]) || 0,
      visa_txn: parseInt(item["VISA_TXN"]) || 0,
      visa_amount: parseFloat(item["VISA_AMOUNT"]) || 0,
      mc_txn: parseInt(item["MC_TXN"]) || 0,
      mc_amount: parseFloat(item["MC_AMOUNT"]) || 0,
      cup_txn: parseInt(item["CUP_TXN"]) || 0,
      cup_amount: parseFloat(item["CUP_AMOUNT"]) || 0,
      total_txn: parseInt(item["TOTAL_TXN"]) || 0,
      total_amount: parseFloat(item["TOTAL_AMOUNT"]) || 0,
      transaction_date: startOfDay,
    }));

    if (historyData.length > 0) {
      await prisma.branchtransactionhistory.createMany({ data: historyData });
    }

    // 8. Merge Excel + DB for grand_total update
    const mergedData = [];
    for (const item of excelData) {
      const code = item["Terminal ID"];
      if (!code) continue;

      const dbInfo = terminalMap[code] || null;
      let grandTotal = dbInfo?.grand_total || 0;
      const sumTotalAmount = parseFloat(item["TOTAL_AMOUNT"]) || 0;

      // Update grand_total if not updated for this date
      if (dbInfo && dbInfo.grand_total_updated_at !== dateStr) {
        grandTotal += sumTotalAmount;
        await prisma.terminal.updateMany({
          where: { terminal_code: code },
          data: {
            grand_total: grandTotal.toString(),
            grand_total_updated_at: startOfDay,
          },
        });
        terminalMap[code].grand_total = grandTotal;
        terminalMap[code].grand_total_updated_at = dateStr;
      }

      // Apply exchange rates
      const visaAmount = parseFloat(item["VISA_AMOUNT"]) || 0;
      const mcAmount = parseFloat(item["MC_AMOUNT"]) || 0;
      const cupAmount = parseFloat(item["CUP_AMOUNT"]) || 0;

      mergedData.push({
        branch_name: item["Branch Name"] || dbInfo?.branch || "Unknown",
        terminal_id: code,
        cash_advance: parseInt(item["Cash Advance"]) || 0,
        cash_advance_amount: parseFloat(item["Cash Advance Amount"]) || 0,
        visa_txn: parseInt(item["VISA_TXN"]) || 0,
        visa_amount: visaAmount,
        visa_dollar: (visaAmount / currencyMap["VC"].rate).toFixed(2),
        mc_txn: parseInt(item["MC_TXN"]) || 0,
        mc_amount: mcAmount,
        mc_dollar: (mcAmount / currencyMap["MC"].rate).toFixed(2),
        cup_txn: parseInt(item["CUP_TXN"]) || 0,
        cup_amount: cupAmount,
        cup_dollar: (cupAmount / currencyMap["CUP"].rate).toFixed(2),
        total_txn: parseInt(item["TOTAL_TXN"]) || 0,
        total_amount: sumTotalAmount,
        merchant_name: dbInfo?.merchant_name || "Unknown",
        district: dbInfo?.district || "Unknown",
        grand_total: grandTotal.toFixed(2),
      });
    }

    // 9. Generate Excel file
    const newWorkbook = xlsx.utils.book_new();
    const newWorksheet = xlsx.utils.json_to_sheet(mergedData);
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, "BranchReport");

    const fileName = `branch_report_${dateStr}.xlsx`;
    const outputPath = `uploads/${fileName}`;
    xlsx.writeFile(newWorkbook, outputPath);

    // 10. Return downloadable file
    res.download(outputPath, fileName, () => {
      fs.unlinkSync(filePath);
      fs.unlinkSync(outputPath);
    });
  } catch (err) {
    console.error("Error uploading branch report:", err);
    res.status(500).send("Something went wrong!");
  } finally {
    await prisma.$disconnect();
  }
};
