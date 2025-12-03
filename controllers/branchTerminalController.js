const xlsx = require("xlsx");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.uploadBranchReport = async (req, res) => {
  try {
    const { transaction_date } = req.body;
    if (!transaction_date)
      return res.status(400).json({ message: "transaction_date is required" });

    const trxDate = new Date(transaction_date);
    const trxDateStr = trxDate.toISOString().split("T")[0];

    if (!req.file) return res.status(400).send("No file uploaded");

    // 1. Check if branch report already exists
    const existingHistory = await prisma.branchtransactionhistory.findFirst({
      where: { transaction_date: trxDate },
    });

    if (existingHistory) {
      return res.status(400).json({
        message: `Branch report for ${trxDateStr} already uploaded.`,
      });
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
              district: { select: { district_name: true } },
            },
          },
        },
      }),
      prisma.currency.findMany({
        select: { currency_code: true, exchange_rate: true, last_updated: true },
      }),
    ]);

    // Terminal map
    const terminalMap = {};
    terminals.forEach((t) => {
      terminalMap[t.terminal_code] = {
        merchant_name: t.merchant_name,
        is_deleted: t.is_deleted,
        branch: t.branch?.branch_name || "Unknown",
        district: t.branch?.district?.district_name || "Unknown",
        grand_total: t.grand_total ? Number(t.grand_total) : 0,
        grand_total_updated_at: t.grand_total_updated_at
          ? t.grand_total_updated_at.toISOString().split("T")[0]
          : null,
      };
    });

    // Currency map
    const currencyMap = {};
    currencies.forEach((c) => {
      currencyMap[c.currency_code] = {
        rate: Number(c.exchange_rate),
        last_updated: c.last_updated
          ? c.last_updated.toISOString().split("T")[0]
          : null,
      };
    });

    // Validate exchange rates
    const missingRates = ["VC", "MC", "CUP"].filter(
      (c) => !currencyMap[c] || currencyMap[c].last_updated !== trxDateStr
    );

    if (missingRates.length > 0) {
      return res.status(400).json({
        message: `Currency exchange rates missing/outdated for: ${missingRates.join(
          ", "
        )}`,
      });
    }

    // Read Excel
    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // 3. Insert branch transaction history (skip deleted terminals)
    const historyData = excelData
      .filter((item) => item["Terminal ID"])
      .filter((item) => {
        const code = item["Terminal ID"];
        return terminalMap[code] && !terminalMap[code].is_deleted;
      })
      .map((item) => {
        const visaAmt = Number(item["VISA_AMOUNT"]) || 0;
        const mcAmt = Number(item["MC_AMOUNT"]) || 0;
        const cupAmt = Number(item["CUP_AMOUNT"]) || 0;

        return {
          branch_name: item["Branch Name"] || "Unknown",
          terminal_id: String(item["Terminal ID"]),

          visa_txn: Number(item["VISA_TXN"]) || 0,
          visa_amount: visaAmt,
          visa_dollar: (visaAmt / currencyMap["VC"].rate).toFixed(2),

          mc_txn: Number(item["MC_TXN"]) || 0,
          mc_amount: mcAmt,
          mc_dollar: (mcAmt / currencyMap["MC"].rate).toFixed(2),

          cup_txn: Number(item["CUP_TXN"]) || 0,
          cup_amount: cupAmt,
          cup_dollar: (cupAmt / currencyMap["CUP"].rate).toFixed(2),

          cash_advance: Number(item["Cash Advance"]) || 0,
          cash_advance_amount: Number(item["Cash Advance Amount"]) || 0,

          total_txn: Number(item["TOTAL_TXN"]) || 0,
          total_amount: Number(item["TOTAL_AMOUNT"]) || 0,
          transaction_date: trxDate,
        };
      });

    if (historyData.length > 0) {
      await prisma.branchtransactionhistory.createMany({ data: historyData });
    }

    // 4. Update grand_total (only once per day)
    for (const item of excelData) {
      const code = item["Terminal ID"];
      const t = terminalMap[code];

      if (!t || t.is_deleted) continue;

      const lastUpdated = t.grand_total_updated_at;
      const sumAmount = Number(item["TOTAL_AMOUNT"]) || 0;

      let grandTotal = t.grand_total;

      if (lastUpdated !== trxDateStr) {
        grandTotal += sumAmount;

        await prisma.terminal.updateMany({
          where: { terminal_code: code },
          data: {
            grand_total: grandTotal.toString(),
            grand_total_updated_at: trxDate,
          },
        });

        t.grand_total = grandTotal;
        t.grand_total_updated_at = trxDateStr;
      }
    }

    // 5. Generate merged Excel output
    const mergedData = excelData.map((item) => {
      const code = item["Terminal ID"];
      const dbInfo = terminalMap[code] || {};

      const visaAmt = Number(item["VISA_AMOUNT"]) || 0;
      const mcAmt = Number(item["MC_AMOUNT"]) || 0;
      const cupAmt = Number(item["CUP_AMOUNT"]) || 0;

      return {
        branch_name: item["Branch Name"] || dbInfo.branch,
        terminal_id: code,
        merchant_name: dbInfo.merchant_name || "Unknown",
        district: dbInfo.district || "Unknown",

        visa_txn: Number(item["VISA_TXN"]) || 0,
        visa_amount: visaAmt,
        visa_dollar: (visaAmt / currencyMap["VC"].rate).toFixed(2),

        mc_txn: Number(item["MC_TXN"]) || 0,
        mc_amount: mcAmt,
        mc_dollar: (mcAmt / currencyMap["MC"].rate).toFixed(2),

        cup_txn: Number(item["CUP_TXN"]) || 0,
        cup_amount: cupAmt,
        cup_dollar: (cupAmt / currencyMap["CUP"].rate).toFixed(2),

        cash_advance: Number(item["Cash Advance"]) || 0,
        cash_advance_amount: Number(item["Cash Advance Amount"]) || 0,

        total_txn: Number(item["TOTAL_TXN"]) || 0,
        total_amount: Number(item["TOTAL_AMOUNT"]) || 0,

        grand_total: Number(dbInfo.grand_total || 0).toFixed(2),
      };
    });

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(mergedData);
    xlsx.utils.book_append_sheet(wb, ws, "Branch Report");

    const outFile = `branch_report_${trxDateStr}.xlsx`;
    const outPath = `uploads/${outFile}`;
    xlsx.writeFile(wb, outPath);

    res.download(outPath, outFile, () => {
      fs.unlinkSync(filePath);
      fs.unlinkSync(outPath);
    });
  } catch (err) {
    console.error("Branch report upload error:", err);
    res.status(500).send("Something went wrong!");
  } finally {
    await prisma.$disconnect();
  }
};
