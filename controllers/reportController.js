const xlsx = require("xlsx");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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

    // 2. Fetch terminal info using Prisma
    const terminals = await prisma.terminal.findMany({
      select: {
        terminal_code: true,
        merchant_name: true,
        branch: {
          select: {
            branch_name: true,
            district: {
              select: {
                district_name: true,
              },
            },
          },
        },
      },
    });

    // 3. Convert to map for fast lookup
    const terminalMap = {};
    terminals.forEach(t => {
      terminalMap[t.terminal_code] = {
        merchant_name: t.merchant_name,
        branch: t.branch.branch_name,
        district: t.branch.district.district_name,
      };
    });

    const exchangeRate = 137;

    // 4. Merge Excel + DB data
    const mergedData = excelData.map(item => {
      const dbInfo = terminalMap[item["TERMINAL ID"]] || {};

      const visaAmount = Number(item["SUM VISA AMOUNT"]) || 0;
      const mcAmount = Number(item["SUM MC AMOUNT"]) || 0;
      const upAmount = Number(item["SUM UP AMOUNT"]) || 0;

      return {
        merchant_name: item["MER_ENSE"] || dbInfo.merchant_name || "Unknown",
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
        branch: dbInfo.branch || "Unknown",
        district: dbInfo.district || "Unknown",
      };
    });

    // 5. Create new Excel file
    const newWorkbook = xlsx.utils.book_new();
    const newWorksheet = xlsx.utils.json_to_sheet(mergedData);
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, "MergedReport");

    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    const fileName = `daily_merchant_pos_performance_${dateStr}.xlsx`;

    const outputPath = `uploads/${fileName}`;
    xlsx.writeFile(newWorkbook, outputPath);

    // 6. Send file to user
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

