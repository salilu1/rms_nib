const xlsx = require("xlsx");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.uploadReport = async (req, res) => {
  try {
    const { transaction_date } = req.body;
    if (!transaction_date) return res.status(400).json({ message: "transaction_date is required" });

    const trxDate = new Date(transaction_date);
    const trxDateStr = trxDate.toISOString().split("T")[0];

    if (!req.file) return res.status(400).send("No file uploaded");

    // 1. Check if report for this date already exists
    const existingHistory = await prisma.merchanttransactionhistory.findFirst({
      where: { transaction_date: trxDate },
    });

    if (existingHistory) {
      return res.status(400).json({ message: `Report for ${trxDateStr} has already been uploaded.` });
    }

    // 2. Fetch terminals & currencies
    const [terminals, currencies] = await Promise.all([
      prisma.terminal.findMany({
        select: {
          terminal_code: true,
          merchant_name: true,
          grand_total: true,
          grand_total_updated_at: true,
          is_deleted: true,
          branch: {
            select: {
              branch_name: true,
              district: {
                select: { district_name: true }
              }
            }
          }
        }
      }),
      prisma.currency.findMany({
        select: { currency_code: true, exchange_rate: true, last_updated: true },
      })
    ]);

    // Terminal map
    const terminalMap = {};
    terminals.forEach(t => {
      terminalMap[t.terminal_code] = {
        merchant_name: t.merchant_name,
        is_deleted: t.is_deleted,
        branch: t.branch?.branch_name || "Unknown",
        district: t.branch?.district?.district_name || "Unknown",
        grand_total: t.grand_total ? Number(t.grand_total) : 0,
        grand_total_updated_at: t.grand_total_updated_at,
      };
    });

    // Currency map
    const currencyMap = {};
    currencies.forEach(c => {
      currencyMap[c.currency_code] = {
        rate: Number(c.exchange_rate),
        last_updated: c.last_updated ? c.last_updated.toISOString().split("T")[0] : null,
      };
    });

    // Ensure exchange rate exists for required currencies
    const missingRates = ["VC", "MC", "CUP"].filter(code =>
      !currencyMap[code] || currencyMap[code].last_updated !== trxDateStr
    );

    if (missingRates.length > 0) {
      return res.status(400).json({
        message: `Currency exchange rate missing or outdated for ${trxDateStr}. Update rates for: ${missingRates.join(", ")}`
      });
    }

    // Read uploaded Excel file
    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // 4. Insert transaction history (skip deleted terminals)
    const historyData = excelData
      .filter(item => item["TERMINAL ID"])
      .filter(item => {
        const code = item["TERMINAL ID"];
        return terminalMap[code] && !terminalMap[code].is_deleted;  // SKIP deleted terminal
      })
      .map(item => {
        const visaAmt = Number(item["SUM VISA AMOUNT"]) || 0;
        const mcAmt = Number(item["SUM MC AMOUNT"]) || 0;
        const cupAmt = Number(item["SUM UP AMOUNT"]) || 0;

        return {
          terminal_name: item["MER_ENSE"] || "Unknown",
          terminal_id: String(item["TERMINAL ID"]),
          sum_local_txn: Number(item["SUM LOCAL TXN"]) || 0,
          sum_local_txn_amnt: Number(item["SUM LOCAL TXN AMNT"]) || 0,

          sum_visa_txn: Number(item["SUM VISA TXN"]) || 0,
          sum_visa_amount: visaAmt,
          visa_dollar: (visaAmt / currencyMap["VC"].rate).toFixed(2),

          sum_mc_txn: Number(item["SUM MC TXN"]) || 0,
          sum_mc_amount: mcAmt,
          mc_dollar: (mcAmt / currencyMap["MC"].rate).toFixed(2),

          sum_cup_txn: Number(item["SUM UP TXN"]) || 0,
          sum_cup_amount: cupAmt,
          cup_dollar: (cupAmt / currencyMap["CUP"].rate).toFixed(2),

          sum_total_txn: Number(item["SUM TOTAL TXN"]) || 0,
          sum_total_amount: Number(item["SUM TOTAL AMOUNT"]) || 0,
          transaction_date: trxDate,
        };
      });

    if (historyData.length > 0) {
      await prisma.merchanttransactionhistory.createMany({ data: historyData });
    }

    // 5. Update grand_total only for ACTIVE terminals
    for (const item of excelData) {
      const code = item["TERMINAL ID"];
      if (!code || !terminalMap[code] || terminalMap[code].is_deleted) continue; // skip deleted

      const dbInfo = terminalMap[code];
      let grandTotal = dbInfo.grand_total;
      const lastUpdated = dbInfo.grand_total_updated_at
        ? dbInfo.grand_total_updated_at.toISOString().split("T")[0]
        : null;

      const sumTotalAmount = Number(item["SUM TOTAL AMOUNT"]) || 0;

      if (lastUpdated !== trxDateStr) {
        grandTotal += sumTotalAmount;

        await prisma.terminal.updateMany({
          where: { terminal_code: code },
          data: { grand_total: grandTotal.toString(), grand_total_updated_at: trxDate }
        });

        terminalMap[code].grand_total = grandTotal;
        terminalMap[code].grand_total_updated_at = trxDate;
      }
    }

    // 6. Generate Excel report
    const mergedData = excelData.map(item => {
      const code = item["TERMINAL ID"];
      const dbInfo = terminalMap[code] || {};

      const visaAmount = Number(item["SUM VISA AMOUNT"]) || 0;
      const mcAmount = Number(item["SUM MC AMOUNT"]) || 0;
      const cupAmount = Number(item["SUM UP AMOUNT"]) || 0;

      return {
        merchant_name: item["MER_ENSE"] || dbInfo.merchant_name || "Unknown",
        terminal_id: code,
        sum_local_txn: Number(item["SUM LOCAL TXN"]) || 0,
        sum_local_txn_amount: Number(item["SUM LOCAL TXN AMNT"]) || 0,

        sum_visa_txn: Number(item["SUM VISA TXN"]) || 0,
        sum_visa_amount: visaAmount,
        visa_dollar: (visaAmount / currencyMap["VC"].rate).toFixed(2),

        sum_mc_txn: Number(item["SUM MC TXN"]) || 0,
        sum_mc_amount: mcAmount,
        mc_dollar: (mcAmount / currencyMap["MC"].rate).toFixed(2),

        sum_up_txn: Number(item["SUM UP TXN"]) || 0,
        sum_up_amount: cupAmount,
        up_dollar: (cupAmount / currencyMap["CUP"].rate).toFixed(2),

        sum_total_txn: Number(item["SUM TOTAL TXN"]) || 0,
        sum_total_amount: Number(item["SUM TOTAL AMOUNT"]) || 0,
        branch: dbInfo.branch || "Unknown",
        district: dbInfo.district || "Unknown",
        grand_total: dbInfo.grand_total?.toFixed(2) || "0.00",
      };
    });

    const newWorkbook = xlsx.utils.book_new();
    const newWorksheet = xlsx.utils.json_to_sheet(mergedData);
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, "MergedReport");

    const fileName = `daily_merchant_pos_performance_${trxDateStr}.xlsx`;
    const outputPath = `uploads/${fileName}`;
    xlsx.writeFile(newWorkbook, outputPath);

    res.download(outputPath, fileName, () => {
      fs.unlinkSync(filePath);
      fs.unlinkSync(outputPath);
    });

  } catch (err) {
    console.error("Error uploading report:", err);
    res.status(500).send("Something went wrong!");
  } finally {
    await prisma.$disconnect();
  }
};
