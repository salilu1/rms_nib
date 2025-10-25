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

    // 2. Fetch terminals and exchange rates
    const [terminals, currencies] = await Promise.all([
      prisma.terminal.findMany({
        select: {
          terminal_code: true,
          merchant_name: true,
          grand_total: true,
          grand_total_updated_at: true,
          branch: {
            select: {
              branch_name: true,
              district: { select: { district_name: true } },
            },
          },
        },
      }),
      prisma.currency.findMany({
        select: { currency_code: true, exchange_rate: true, last_updated: true },
      }),
    ]);

    const todayStr = new Date().toISOString().split("T")[0];

    // Map terminals for fast lookup
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

    // Map exchange rates
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
      return res
        .status(400)
        .json({ message: `Update the exchange rates first for: ${missingRates.join(", ")}` });
    }

    // 3. Merge Excel + DB
    const mergedData = [];
    for (const item of excelData) {
      const code = item["TERMINAL ID"];
      const dbInfo = terminalMap[code] || null;

      const sumTotalAmount = Number(item["SUM TOTAL AMOUNT"]) || 0;
      let grandTotal = dbInfo?.grand_total || 0;

      // Update DB only if terminal exists and not updated today
      const lastUpdated = dbInfo?.grand_total_updated_at
        ? dbInfo.grand_total_updated_at.toISOString().split("T")[0]
        : null;

      if (dbInfo && lastUpdated !== todayStr) {
        grandTotal += sumTotalAmount;

        await prisma.terminal.updateMany({
          where: { terminal_code: code },
          data: {
            grand_total: grandTotal.toString(),
            grand_total_updated_at: new Date(),
          },
        });

        // Update map so subsequent rows in same file use updated value
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
        sum_local_txn: item["SUM LOCAL TXN"] || 0,
        sum_local_txn_amount: item["SUM LOCAL TXN AMNT"] || 0,
        sum_visa_txn: item["SUM VISA TXN"] || 0,
        sum_visa_amount: visaAmount,
        visa_dollar: (visaAmount / currencyMap["VC"].rate).toFixed(2),
        sum_mc_txn: item["SUM MC TXN"] || 0,
        sum_mc_amount: mcAmount,
        mc_dollar: (mcAmount / currencyMap["MC"].rate).toFixed(2),
        sum_up_txn: item["SUM UP TXN"] || 0,
        sum_up_amount: cupAmount,
        up_dollar: (cupAmount / currencyMap["CUP"].rate).toFixed(2),
        sum_total_txn: item["SUM TOTAL TXN"] || 0,
        sum_total_amount: sumTotalAmount,
        branch: dbInfo?.branch || "Unknown",
        district: dbInfo?.district || "Unknown",
        grand_total: grandTotal.toFixed(2),
      });
    }

    // 4. Generate Excel
    const newWorkbook = xlsx.utils.book_new();
    const newWorksheet = xlsx.utils.json_to_sheet(mergedData);
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, "MergedReport");

    const dateStr = new Date().toISOString().split("T")[0];
    const fileName = `daily_merchant_pos_performance_${dateStr}.xlsx`;
    const outputPath = `uploads/${fileName}`;
    xlsx.writeFile(newWorkbook, outputPath);

    // 5. Return file
    res.download(outputPath, fileName, () => {
      fs.unlinkSync(filePath);
      fs.unlinkSync(outputPath);
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Something went wrong!");
  } finally {
    await prisma.$disconnect();
  }
};
