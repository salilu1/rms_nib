// const xlsx = require("xlsx");
// const fs = require("fs");
// const { PrismaClient } = require("@prisma/client");
// const prisma = new PrismaClient();

// exports.uploadBranchReport = async (req, res) => {
//   try {
//     if (!req.file) return res.status(400).send("No file uploaded");

//     // 1. Read uploaded Excel file
//     const filePath = req.file.path;
//     const workbook = xlsx.readFile(filePath);
//     const sheetName = workbook.SheetNames[0];
//     const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

//     // 2. Fetch latest exchange rates
//     const currencies = await prisma.currency.findMany({
//       where: {
//         currency_code: { in: ["VC", "MC", "CUP"] },
//       },
//     });

//     const todayStr = new Date().toISOString().split("T")[0];

//     const exchangeMap = {};
//     const outdatedCurrencies = [];

//     currencies.forEach(c => {
//       const lastUpdatedStr = c.last_updated
//         ? c.last_updated.toISOString().split("T")[0]
//         : null;

//       if (lastUpdatedStr !== todayStr) {
//         outdatedCurrencies.push(c.currency_code);
//       } else {
//         exchangeMap[c.currency_code] = Number(c.exchange_rate);
//       }
//     });

//     // 3. If any currency is outdated, stop and return error
//     if (outdatedCurrencies.length > 0) {
//       return res.status(400).json({
//         message: `Exchange rate(s) for ${outdatedCurrencies.join(
//           ", "
//         )} are not updated for today. Please update the currency rates first.`,
//       });
//     }

//     // 4. Fetch terminal info
//     const terminals = await prisma.terminal.findMany({
//       select: {
//         terminal_code: true,
//         merchant_name: true,
//         grand_total: true,
//         grand_total_updated_at: true,
//         branch: {
//           select: {
//             branch_name: true,
//             district: { select: { district_name: true } },
//           },
//         },
//       },
//     });

//     const terminalMap = {};
//     terminals.forEach(t => {
//       terminalMap[t.terminal_code] = {
//         merchant_name: t.merchant_name,
//         branch: t.branch.branch_name,
//         district: t.branch.district.district_name,
//         grand_total: t.grand_total || 0,
//         grand_total_updated_at: t.grand_total_updated_at,
//       };
//     });

//     // 5. Merge Excel + DB, update grand_total once per day
//     const mergedData = [];
//     for (const item of excelData) {
//       const code = item["Terminal ID"];
//       const dbInfo = terminalMap[code] || {};
//       const sumTotalAmount = Number(item["TOTAL_AMOUNT"]) || 0;
//       let grandTotal = dbInfo.grand_total || 0;

//       const lastUpdated = dbInfo.grand_total_updated_at
//         ? dbInfo.grand_total_updated_at.toISOString().split("T")[0]
//         : null;

//       if (dbInfo && lastUpdated !== todayStr && code) {
//   grandTotal += sumTotalAmount;

//   // Ensure grandTotal is a Number with max 2 decimals
//   grandTotal = Math.round(grandTotal * 100) / 100;

//   await prisma.terminal.updateMany({
//     where: { terminal_code: code },
//     data: {
//       grand_total: grandTotal, // ✅ number, not string
//       grand_total_updated_at: new Date(),
//     },
//   });
// }


//       // Apply exchange rates
//       mergedData.push({
//         branch_name: item["Branch Name"] || dbInfo.branch || "Unknown",
//         terminal_id: code,
//         cash_advance_txn: item["Cash Advance"] || 0,
//         cash_advance_amount: Number(item["Cash Advance Amount"]) || 0,
//         visa_txn: item["VISA_TXN"] || 0,
//         visa_amount: Number(item["VISA_AMOUNT"]) || 0,
//         visa_dollar: ((Number(item["VISA_AMOUNT"]) || 0) / exchangeMap["VC"]).toFixed(2),
//         mc_txn: item["MC_TXN"] || 0,
//         mc_amount: Number(item["MC_AMOUNT"]) || 0,
//         mc_dollar: ((Number(item["MC_AMOUNT"]) || 0) / exchangeMap["MC"]).toFixed(2),
//         cup_txn: item["CUP_TXN"] || 0,
//         cup_amount: Number(item["CUP_AMOUNT"]) || 0,
//         cup_dollar: ((Number(item["CUP_AMOUNT"]) || 0) / exchangeMap["CUP"]).toFixed(2),
//         total_txn: item["TOTAL_TXN"] || 0,
//         total_amount: sumTotalAmount,
//         merchant_name: dbInfo.merchant_name || "Unknown",
//         district: dbInfo.district || "Unknown",
//         grand_total: Number(grandTotal).toFixed(2),
//       });
//     }

//     // 6. Generate new Excel file
//     const newWorkbook = xlsx.utils.book_new();
//     const newWorksheet = xlsx.utils.json_to_sheet(mergedData);
//     xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, "BranchReport");

//     const dateStr = new Date().toISOString().split("T")[0];
//     const fileName = `daily_branch_pos_performance_${dateStr}.xlsx`;
//     const outputPath = `uploads/${fileName}`;
//     xlsx.writeFile(newWorkbook, outputPath);

//     res.download(outputPath, fileName, () => {
//       fs.unlinkSync(filePath);
//       fs.unlinkSync(outputPath);
//     });
//   } catch (err) {
//     console.error("Error:", err);
//     res.status(500).send("Something went wrong!");
//   } finally {
//     await prisma.$disconnect();
//   }
// };



/////////////////branch transaction history

const xlsx = require("xlsx");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.uploadBranchReport = async (req, res) => {
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
          branch: { select: { branch_name: true, district: { select: { district_name: true } } } },
        },
      }),
      prisma.currency.findMany({
        select: { currency_code: true, exchange_rate: true, last_updated: true },
      }),
    ]);

    const todayStr = new Date().toISOString().split("T")[0];

    // 3. Map terminals
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

    // 4. Map currencies and check if updated today
    const currencyMap = {};
    currencies.forEach(c => {
      currencyMap[c.currency_code] = {
        rate: Number(c.exchange_rate),
        last_updated: c.last_updated ? c.last_updated.toISOString().split("T")[0] : null,
      };
    });

    const missingRates = ["VC", "MC", "CUP"].filter(
      code => !currencyMap[code] || currencyMap[code].last_updated !== todayStr
    );
    if (missingRates.length > 0) {
      return res
        .status(400)
        .json({ message: `Currency exchange rate is outdated. Please update: ${missingRates.join(", ")}` });
    }

    // 5. Check if branch transaction history already exists for today
    const startOfDay = new Date(todayStr); // ISO date at 00:00:00
    const existingHistory = await prisma.branchtransactionhistory.findFirst({
      where: { transaction_date: startOfDay },
    });

    if (!existingHistory) {
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
      await prisma.branchtransactionhistory.createMany({ data: historyData });
    }

    // 6. Merge Excel + DB, update grand_total once per terminal if not updated today
    const mergedData = [];
    for (const item of excelData) {
      const code = item["Terminal ID"];
      const dbInfo = terminalMap[code] || null;

      const sumTotalAmount = parseFloat(item["TOTAL_AMOUNT"]) || 0;
      let grandTotal = dbInfo?.grand_total || 0;

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

        terminalMap[code].grand_total = grandTotal;
        terminalMap[code].grand_total_updated_at = new Date();
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

    // 7. Generate new Excel file
    const newWorkbook = xlsx.utils.book_new();
    const newWorksheet = xlsx.utils.json_to_sheet(mergedData);
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, "BranchReport");

    const dateStr = todayStr;
    const fileName = `daily_branch_pos_performance_${dateStr}.xlsx`;
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
