
const xlsx = require("xlsx");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.uploadReport = async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("No file uploaded");

    // 1. Read uploaded Excel file
    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // 2. Fetch terminals and currencies
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

    const todayStr = new Date().toISOString().split("T")[0];

    // Map terminals
    const terminalMap = {};
    terminals.forEach(t => {
      terminalMap[t.terminal_code] = {
        merchant_name: t.merchant_name,
        branch: t.branch?.branch_name || "Unknown",
        district: t.branch?.district?.district_name || "Unknown",
        grand_total: t.grand_total ? Number(t.grand_total) : 0,
        grand_total_updated_at: t.grand_total_updated_at,
      };
    });

    // Map currencies
    const currencyMap = {};
    currencies.forEach(c => {
      currencyMap[c.currency_code] = {
        rate: Number(c.exchange_rate),
        last_updated: c.last_updated ? c.last_updated.toISOString().split("T")[0] : null,
      };
    });

    // Ensure all exchange rates are updated today
    const missingRates = ["VC", "MC", "CUP"].filter(
      code => !currencyMap[code] || currencyMap[code].last_updated !== todayStr
    );
    if (missingRates.length > 0) {
      return res.status(400).json({
        message: `Currency exchange rate is outdated. Please update currency before uploading the report. Missing: ${missingRates.join(", ")}`
      });
    }

    // 3. Check if transaction history already exists for today
    const existingHistory = await prisma.merchanttransactionhistory.findFirst({
      where: { transaction_date: new Date(todayStr) },
    });

    // 4. Insert transaction history only if first upload today
    if (!existingHistory) {
      const historyData = excelData
        .filter(item => item["TERMINAL ID"]) // skip invalid rows
        .map(item => ({
          terminal_name: item["MER_ENSE"] || "Unknown",
          terminal_id: String(item["TERMINAL ID"]),
          sum_local_txn: Number(item["SUM LOCAL TXN"]) || 0,
          sum_local_txn_amnt: Number(item["SUM LOCAL TXN AMNT"]) || 0,
          sum_visa_txn: Number(item["SUM VISA TXN"]) || 0,
          sum_visa_amount: Number(item["SUM VISA AMOUNT"]) || 0,
          sum_mc_txn: Number(item["SUM MC TXN"]) || 0,
          sum_mc_amount: Number(item["SUM MC AMOUNT"]) || 0,
          sum_cup_txn: Number(item["SUM UP TXN"]) || 0,
          sum_cup_amount: Number(item["SUM UP AMOUNT"]) || 0,
          sum_total_txn: Number(item["SUM TOTAL TXN"]) || 0,
          sum_total_amount: Number(item["SUM TOTAL AMOUNT"]) || 0,
        }));

      if (historyData.length > 0) {
        await prisma.merchanttransactionhistory.createMany({ data: historyData });
      }
    }

    // 5. Merge Excel + DB, update grand_total once per terminal
    const mergedData = [];
    const exchangeRateMap = {
      VC: currencyMap["VC"].rate,
      MC: currencyMap["MC"].rate,
      CUP: currencyMap["CUP"].rate,
    };

    for (const item of excelData) {
      const code = item["TERMINAL ID"];
      if (!code) continue;

      const dbInfo = terminalMap[code] || null;
      let grandTotal = dbInfo?.grand_total || 0;

      const lastUpdated = dbInfo?.grand_total_updated_at
        ? dbInfo.grand_total_updated_at.toISOString().split("T")[0]
        : null;

      const sumTotalAmount = Number(item["SUM TOTAL AMOUNT"]) || 0;

      // Update grand_total if not updated today
      if (dbInfo && lastUpdated !== todayStr) {
        grandTotal += sumTotalAmount;

        await prisma.terminal.updateMany({
          where: { terminal_code: code },
          data: {
            grand_total: grandTotal.toString(),
            grand_total_updated_at: new Date(),
          },
        });

        terminalMap[code].grand_total = grandTotal;
        terminalMap[code].grand_total_updated_at = new Date();
      }

      // Apply exchange rates
      const visaAmount = Number(item["SUM VISA AMOUNT"]) || 0;
      const mcAmount = Number(item["SUM MC AMOUNT"]) || 0;
      const cupAmount = Number(item["SUM UP AMOUNT"]) || 0;

      mergedData.push({
        merchant_name: item["MER_ENSE"] || dbInfo?.merchant_name || "Unknown",
        terminal_id: code,
        sum_local_txn: Number(item["SUM LOCAL TXN"]) || 0,
        sum_local_txn_amount: Number(item["SUM LOCAL TXN AMNT"]) || 0,
        sum_visa_txn: Number(item["SUM VISA TXN"]) || 0,
        sum_visa_amount: visaAmount,
        visa_dollar: (visaAmount / exchangeRateMap.VC).toFixed(2),
        sum_mc_txn: Number(item["SUM MC TXN"]) || 0,
        sum_mc_amount: mcAmount,
        mc_dollar: (mcAmount / exchangeRateMap.MC).toFixed(2),
        sum_up_txn: Number(item["SUM UP TXN"]) || 0,
        sum_up_amount: cupAmount,
        up_dollar: (cupAmount / exchangeRateMap.CUP).toFixed(2),
        sum_total_txn: Number(item["SUM TOTAL TXN"]) || 0,
        sum_total_amount: sumTotalAmount,
        branch: dbInfo?.branch || "Unknown",
        district: dbInfo?.district || "Unknown",
        grand_total: grandTotal.toFixed(2),
      });
    }

    // 6. Generate Excel file
    const newWorkbook = xlsx.utils.book_new();
    const newWorksheet = xlsx.utils.json_to_sheet(mergedData);
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, "MergedReport");

    const dateStr = new Date().toISOString().split("T")[0];
    const fileName = `daily_merchant_pos_performance_${dateStr}.xlsx`;
    const outputPath = `uploads/${fileName}`;
    xlsx.writeFile(newWorkbook, outputPath);

    // 7. Return file
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
