const path = require("path");

const xlsx = require("xlsx");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ---------------------- MERCHANT HISTORY ----------------------
exports.exportMerchantHistory = async (req, res) => {
  try {
    // 1. Fetch all merchant transaction history
    const history = await prisma.merchanttransactionhistory.findMany();

    if (!history.length) {
      return res.status(404).json({ message: "No merchant transactions found." });
    }

    // 2. Fetch terminals + branch + district in one query
    const terminals = await prisma.terminal.findMany({
      include: {
        branch: {
          select: {
            branch_name: true,
            district: { select: { district_name: true } },
          },
        },
      },
    });

    // 3. Map terminal_id to branch + district
    const terminalMap = {};
    terminals.forEach(t => {
      terminalMap[t.terminal_code] = {
        branch: t.branch.branch_name,
        district: t.branch.district.district_name,
      };
    });

    // 4. Merge merchant history with terminal info, include dollar fields
    const mergedData = history.map(h => ({
      terminal_name: h.terminal_name,
      terminal_id: h.terminal_id,
      branch: terminalMap[h.terminal_id]?.branch || "Unknown",
      district: terminalMap[h.terminal_id]?.district || "Unknown",
      sum_local_txn: h.sum_local_txn || 0,
      sum_local_txn_amnt: Number(h.sum_local_txn_amnt) || 0,
      sum_visa_txn: h.sum_visa_txn || 0,
      sum_visa_amount: Number(h.sum_visa_amount) || 0,
      vc_dollar: Number(h.vc_dollar) || 0,
      sum_mc_txn: h.sum_mc_txn || 0,
      sum_mc_amount: Number(h.sum_mc_amount) || 0,
      mc_dollar: Number(h.mc_dollar) || 0,
      sum_cup_txn: h.sum_cup_txn || 0,
      sum_cup_amount: Number(h.sum_cup_amount) || 0,
      cup_dollar: Number(h.cup_dollar) || 0,
      sum_total_txn: h.sum_total_txn || 0,
      sum_total_amount: Number(h.sum_total_amount) || 0,
      transaction_date: h.transaction_date?.toISOString().split("T")[0] || "",
    }));

    // 5. Create Excel
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(mergedData);
    xlsx.utils.book_append_sheet(workbook, worksheet, "MerchantHistory");

    const fileName = `merchant_transaction_history_${new Date().toISOString().split("T")[0]}.xlsx`;
    const outputPath = `uploads/${fileName}`;
    xlsx.writeFile(workbook, outputPath);

    // 6. Send file
    res.download(outputPath, fileName, () => fs.unlinkSync(outputPath));
  } catch (err) {
    console.error("Error exporting merchant history:", err);
    res.status(500).send("Something went wrong!");
  } finally {
    await prisma.$disconnect();
  }
};

// ---------------------- BRANCH HISTORY ----------------------
exports.exportBranchHistory = async (req, res) => {
  try {
    // 1. Fetch all branch transaction history
    const history = await prisma.branchtransactionhistory.findMany();

    // 2. Fetch terminal details with branch + district
    const terminals = await prisma.terminal.findMany({
      include: {
        branch: {
          select: {
            branch_name: true,
            district: { select: { district_name: true } },
          },
        },
      },
    });

    // 3. Map terminal_id → branch, district
    const terminalMap = {};
    terminals.forEach(t => {
      terminalMap[t.terminal_code] = {
        branch: t.branch?.branch_name || "Unknown",
        district: t.branch?.district?.district_name || "Unknown",
      };
    });

    // 4. Merge transaction history with terminal info
    const mergedData = history.map(h => ({
      terminal_id: h.terminal_id,
      branch: terminalMap[h.terminal_id]?.branch || "Unknown",
      district: terminalMap[h.terminal_id]?.district || "Unknown",

      cash_advance: h.cash_advance || 0,
      cash_advance_amount: Number(h.cash_advance_amount) || 0,

      visa_txn: h.visa_txn || 0,
      visa_amount: Number(h.visa_amount) || 0,
      visa_dollar: Number(h.visa_dollar) || 0,

      mc_txn: h.mc_txn || 0,
      mc_amount: Number(h.mc_amount) || 0,
      mc_dollar: Number(h.mc_dollar) || 0,

      cup_txn: h.cup_txn || 0,
      cup_amount: Number(h.cup_amount) || 0,
      cup_dollar: Number(h.cup_dollar) || 0,

      total_txn: h.total_txn || 0,
      total_amount: Number(h.total_amount) || 0,

      transaction_date: h.transaction_date?.toISOString().split("T")[0] || "",
    }));

    // 5. Create Excel
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(mergedData);
    xlsx.utils.book_append_sheet(workbook, worksheet, "BranchHistory");

    const fileName = `branch_transaction_history_${new Date().toISOString().split("T")[0]}.xlsx`;
    const outputPath = `uploads/${fileName}`;
    xlsx.writeFile(workbook, outputPath);

    // 6. Send file
    res.download(outputPath, fileName, () => fs.unlinkSync(outputPath));
  } catch (err) {
    console.error("Error exporting branch history:", err);
    res.status(500).send("Something went wrong!");
  } finally {
    await prisma.$disconnect();
  }
};

////Export top 10 Merchant/////////////
exports.exportTopMerchants = async (req, res) => {
  try {
    // 1. Fetch top 10 merchants by grand_total
    const terminals = await prisma.terminal.findMany({
      orderBy: { grand_total: "desc" },
      take: 10,
      include: {
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

    // 2. Map data for Excel
    const data = terminals.map(t => ({
      terminal_id: t.terminal_code,
      merchant_name: t.merchant_name || "Unknown",
      branch: t.branch?.branch_name || "Unknown",
      district: t.branch?.district?.district_name || "Unknown",
      grand_total: Number(t.grand_total || 0).toFixed(2),
      last_updated: t.grand_total_updated_at
        ? t.grand_total_updated_at.toISOString().split("T")[0]
        : "",
    }));

    // 3. Create Excel
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(workbook, worksheet, "TopMerchants");

    const fileName = `top_10_merchants_${new Date().toISOString().split("T")[0]}.xlsx`;
    const outputPath = `uploads/${fileName}`;
    xlsx.writeFile(workbook, outputPath);

    // 4. Send file
    res.download(outputPath, fileName, () => fs.unlinkSync(outputPath));
  } catch (err) {
    console.error("Error exporting top merchants:", err);
    res.status(500).send("Something went wrong!");
  } finally {
    await prisma.$disconnect();
  }
};

// ---------------------- MERCHANT HISTORY BY DATE ----------------------
exports.exportMerchantHistoryByDate = async (req, res) => {
  try {
    const { terminal_code, from, to } = req.query;

    if (!terminal_code || !from || !to) {
      return res.status(400).json({ message: "terminal_code, from, and to are required" });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    // 1. Fetch merchant transaction history for given terminal and date range
    const history = await prisma.merchanttransactionhistory.findMany({
      where: {
        terminal_id: terminal_code,
        transaction_date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { transaction_date: "asc" },
    });

    if (history.length === 0) {
      return res.status(404).json({ message: "No transactions found for this terminal in the given date range." });
    }

    // 2. Fetch terminal details with branch + district
    const terminal = await prisma.terminal.findUnique({
      where: { terminal_code },
      include: {
        branch: {
          select: {
            branch_name: true,
            district: { select: { district_name: true } },
          },
        },
      },
    });

    // 3. Map data for Excel including stored dollar fields
    const mergedData = history.map(h => ({
      terminal_name: h.terminal_name,
      terminal_id: h.terminal_id,
      branch: terminal?.branch?.branch_name || "Unknown",
      district: terminal?.branch?.district?.district_name || "Unknown",
      sum_local_txn: h.sum_local_txn || 0,
      sum_local_txn_amnt: Number(h.sum_local_txn_amnt) || 0,
      sum_visa_txn: h.sum_visa_txn || 0,
      sum_visa_amount: Number(h.sum_visa_amount) || 0,
      vc_dollar: Number(h.visa_dollar) || 0,
      sum_mc_txn: h.sum_mc_txn || 0,
      sum_mc_amount: Number(h.sum_mc_amount) || 0,
      mc_dollar: Number(h.mc_dollar) || 0,
      sum_cup_txn: h.sum_cup_txn || 0,
      sum_cup_amount: Number(h.sum_cup_amount) || 0,
      cup_dollar: Number(h.cup_dollar) || 0,
      sum_total_txn: h.sum_total_txn || 0,
      sum_total_amount: Number(h.sum_total_amount) || 0,
      transaction_date: h.transaction_date?.toISOString().split("T")[0] || "",
    }));

    // 4. Create Excel
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(mergedData);
    xlsx.utils.book_append_sheet(workbook, worksheet, "MerchantHistoryByDate");

    const fileName = `merchant_history_${terminal_code}_${from}_to_${to}.xlsx`;
    const outputPath = `uploads/${fileName}`;
    xlsx.writeFile(workbook, outputPath);

    // 5. Send file
    res.download(outputPath, fileName, () => fs.unlinkSync(outputPath));
  } catch (err) {
    console.error("Error exporting merchant history by date:", err);
    res.status(500).send("Something went wrong!");
  } finally {
    await prisma.$disconnect();
  }
};

// ---------------------- BRANCH HISTORY BY DATE ----------------------
exports.exportBranchHistoryByDate = async (req, res) => {
  try {
    const { terminal_code, from, to } = req.query;

    if (!terminal_code || !from || !to) {
      return res.status(400).json({ message: "terminal_code, from, and to are required" });
    }

    // 1. Fetch branch transaction history for given terminal and date range
    const history = await prisma.branchtransactionhistory.findMany({
      where: {
        terminal_id: terminal_code,
        transaction_date: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
    });

    // 2. Fetch terminal details with branch + district
    const terminal = await prisma.terminal.findUnique({
      where: { terminal_code },
      include: {
        branch: {
          select: {
            branch_name: true,
            district: { select: { district_name: true } },
          },
        },
      },
    });

    // 3. Merge data
    const mergedData = history.map(h => ({
      terminal_id: h.terminal_id,
      branch: terminal?.branch?.branch_name || "Unknown",
      district: terminal?.branch?.district?.district_name || "Unknown",

      cash_advance: h.cash_advance || 0,
      cash_advance_amount: Number(h.cash_advance_amount) || 0,

      visa_txn: h.visa_txn || 0,
      visa_amount: Number(h.visa_amount) || 0,
      visa_dollar: Number(h.visa_dollar) || 0,   // ✅ added

      mc_txn: h.mc_txn || 0,
      mc_amount: Number(h.mc_amount) || 0,
      mc_dollar: Number(h.mc_dollar) || 0,       // ✅ added

      cup_txn: h.cup_txn || 0,
      cup_amount: Number(h.cup_amount) || 0,
      cup_dollar: Number(h.cup_dollar) || 0,     // ✅ added

      total_txn: h.total_txn || 0,
      total_amount: Number(h.total_amount) || 0,

      transaction_date: h.transaction_date?.toISOString().split("T")[0] || "",
    }));

    // 4. Create Excel
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(mergedData);
    xlsx.utils.book_append_sheet(workbook, worksheet, "BranchHistoryByDate");

    const fileName = `branch_history_${terminal_code}_${from}_to_${to}.xlsx`;
    const outputPath = `uploads/${fileName}`;
    xlsx.writeFile(workbook, outputPath);

    // 5. Send file
    res.download(outputPath, fileName, () => fs.unlinkSync(outputPath));
  } catch (err) {
    console.error("Error exporting branch history by date:", err);
    res.status(500).send("Something went wrong!");
  } finally {
    await prisma.$disconnect();
  }
};

////////Missed transaction date
exports.getMissingTransactionDates = async (req, res) => {
  try {
    // Fixed start date
    const startDate = new Date("2025-11-01");
    // Dynamic end date
    const endDate = new Date();

    // 1. Fetch all existing transaction dates in range
    const transactions = await prisma.merchanttransactionhistory.findMany({
      where: {
        transaction_date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { transaction_date: true },
    });

    // 2. Build a set of existing transaction dates (as YYYY-MM-DD)
    const existingDates = new Set(
      transactions
        .filter((t) => t.transaction_date)
        .map((t) => t.transaction_date.toISOString().split("T")[0])
    );

    // 3. Generate all possible dates between startDate and endDate
    const missingDates = [];
    const current = new Date(startDate);
    const today = new Date(endDate);

    while (current <= today) {
      const dateStr = current.toISOString().split("T")[0];
      if (!existingDates.has(dateStr)) {
        missingDates.push(dateStr);
      }
      current.setDate(current.getDate() + 1);
    }

    // 4. Return the result
    return res.status(200).json({
      startDate: startDate.toISOString().split("T")[0],
      endDate: today.toISOString().split("T")[0],
      totalMissingDays: missingDates.length,
      missingDates,
    });
  } catch (error) {
    console.error("❌ Error fetching missing transaction dates:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


/////Export All Merchant History

exports.exportAllMerchantHistoryByDate = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: "Please provide from and to dates in YYYY-MM-DD format." });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    // Fetch merchant transaction history for the given date range
    const history = await prisma.merchanttransactionhistory.findMany({
      where: {
        transaction_date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { transaction_date: "asc" },
    });

    if (history.length === 0) {
      return res.status(404).json({ message: "No transactions found in the given date range." });
    }

    // Optional: fetch terminals to include branch/district info
    const terminals = await prisma.terminal.findMany({
      select: {
        terminal_code: true,
        branch: {
          select: {
            branch_name: true,
            district: { select: { district_name: true } },
          },
        },
      },
    });

    const terminalMap = {};
    terminals.forEach(t => {
      terminalMap[t.terminal_code] = {
        branch: t.branch?.branch_name || "Unknown",
        district: t.branch?.district?.district_name || "Unknown",
      };
    });

    // Merge terminal info and include dollar fields
    const mergedData = history.map(h => ({
      terminal_name: h.terminal_name,
      terminal_id: h.terminal_id,
      branch: terminalMap[h.terminal_id]?.branch || "Unknown",
      district: terminalMap[h.terminal_id]?.district || "Unknown",
      sum_local_txn: h.sum_local_txn || 0,
      sum_local_txn_amnt: Number(h.sum_local_txn_amnt) || 0,
      sum_visa_txn: h.sum_visa_txn || 0,
      sum_visa_amount: Number(h.sum_visa_amount) || 0,
      visa_dollar: Number(h.visa_dollar) || 0,  // added
      sum_mc_txn: h.sum_mc_txn || 0,
      sum_mc_amount: Number(h.sum_mc_amount) || 0,
      mc_dollar: Number(h.mc_dollar) || 0,      // added
      sum_cup_txn: h.sum_cup_txn || 0,
      sum_cup_amount: Number(h.sum_cup_amount) || 0,
      cup_dollar: Number(h.cup_dollar) || 0,    // added
      sum_total_txn: h.sum_total_txn || 0,
      sum_total_amount: Number(h.sum_total_amount) || 0,
      transaction_date: h.transaction_date?.toISOString().split("T")[0] || "",
    }));

    // Create Excel
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(mergedData);
    xlsx.utils.book_append_sheet(workbook, worksheet, "MerchantHistory");

    const fileName = `merchant_history_${from}_to_${to}.xlsx`;
    const outputPath = `uploads/${fileName}`;
    xlsx.writeFile(workbook, outputPath);

    // Send file
    res.download(outputPath, fileName, () => fs.unlinkSync(outputPath));
  } catch (err) {
    console.error("Error exporting merchant history by date:", err);
    res.status(500).send("Something went wrong!");
  } finally {
    await prisma.$disconnect();
  }
};


//////Top 10 Merchants

exports.exportTopMerchantsByTxnNumber = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start date and end date are required." });
    }

    // Aggregate total transaction numbers for each terminal within the date range
    const results = await prisma.merchanttransactionhistory.groupBy({
      by: ["terminal_id"],
      _sum: { sum_total_txn: true },
      where: {
        transaction_date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: {
        _sum: { sum_total_txn: "desc" },
      },
      take: 10,
    });

    // Fetch related terminal, branch, and district info
    const terminals = await prisma.terminal.findMany({
      where: {
        terminal_code: { in: results.map(r => r.terminal_id) },
      },
      include: {
        branch: {
          include: {
            district: true,
          },
        },
      },
    });

    // Combine data
    const data = results.map(r => {
      const terminal = terminals.find(t => t.terminal_code === r.terminal_id);
      return {
        terminal_id: r.terminal_id,
        merchant_name: terminal?.merchant_name || "Unknown",
        branch_name: terminal?.branch?.branch_name || "Unknown",
        district_name: terminal?.branch?.district?.district_name || "Unknown",
        total_transactions: Number(r._sum.sum_total_txn || 0),
      };
    });

    // Generate Excel file
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(workbook, worksheet, "TopMerchantsByTxnNumber");

    const fileName = `top_10_merchants_by_txn_${startDate}_to_${endDate}.xlsx`;
    const outputPath = path.join("uploads", fileName);
    xlsx.writeFile(workbook, outputPath);

    res.download(outputPath, fileName, () => fs.unlinkSync(outputPath));
  } catch (error) {
    console.error("Error exporting top merchants by transaction number:", error);
    res.status(500).json({ message: "Server error while exporting report." });
  } finally {
    await prisma.$disconnect();
  }
};

// 💰 Top 10 merchants by transaction amount
exports.exportTopMerchantsByTxnAmount = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start date and end date are required." });
    }

    // Aggregate total transaction amounts for each terminal within the date range
    const results = await prisma.merchanttransactionhistory.groupBy({
      by: ["terminal_id"],
      _sum: { sum_total_amount: true },
      where: {
        transaction_date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: {
        _sum: { sum_total_amount: "desc" },
      },
      take: 10,
    });

    // Fetch related terminal, branch, and district info
    const terminals = await prisma.terminal.findMany({
      where: {
        terminal_code: { in: results.map(r => r.terminal_id) },
      },
      include: {
        branch: {
          include: {
            district: true,
          },
        },
      },
    });

    // Combine data
    const data = results.map(r => {
      const terminal = terminals.find(t => t.terminal_code === r.terminal_id);
      return {
        terminal_id: r.terminal_id,
        merchant_name: terminal?.merchant_name || "Unknown",
        branch_name: terminal?.branch?.branch_name || "Unknown",
        district_name: terminal?.branch?.district?.district_name || "Unknown",
        total_amount: Number(r._sum.sum_total_amount || 0).toFixed(2),
      };
    });

    // Generate Excel file
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(workbook, worksheet, "TopMerchantsByTxnAmount");

    const fileName = `top_10_merchants_by_amount_${startDate}_to_${endDate}.xlsx`;
    const outputPath = path.join("uploads", fileName);
    xlsx.writeFile(workbook, outputPath);

    res.download(outputPath, fileName, () => fs.unlinkSync(outputPath));
  } catch (error) {
    console.error("Error exporting top merchants by transaction amount:", error);
    res.status(500).json({ message: "Server error while exporting report." });
  } finally {
    await prisma.$disconnect();
  }
};

exports.getMissingBranchTransactionDates = async (req, res) => {
  try {
    // Fixed start date
    const startDate = new Date("2025-11-01");
    // Dynamic end date (today)
    const endDate = new Date();

    // 1. Fetch all existing branch transaction dates in the date range
    const transactions = await prisma.branchtransactionhistory.findMany({
      where: {
        transaction_date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { transaction_date: true },
    });

    // 2. Convert existing dates into a Set of YYYY-MM-DD
    const existingDates = new Set(
      transactions
        .filter(t => t.transaction_date)
        .map(t => t.transaction_date.toISOString().split("T")[0])
    );

    // 3. Generate all dates from startDate → endDate
    const missingDates = [];
    const current = new Date(startDate);
    const today = new Date(endDate);

    while (current <= today) {
      const dateStr = current.toISOString().split("T")[0];

      if (!existingDates.has(dateStr)) {
        missingDates.push(dateStr);
      }

      current.setDate(current.getDate() + 1);
    }

    // 4. Respond with the result
    return res.status(200).json({
      startDate: startDate.toISOString().split("T")[0],
      endDate: today.toISOString().split("T")[0],
      totalMissingDays: missingDates.length,
      missingDates,
    });
  } catch (error) {
    console.error("❌ Error fetching missing branch transaction dates:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.exportAllBranchHistoryByDate = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        message: "from and to dates are required in YYYY-MM-DD format.",
      });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    // 1. Fetch ALL branch transaction history
    const history = await prisma.branchtransactionhistory.findMany({
      where: {
        transaction_date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { transaction_date: "asc" },
    });

    if (history.length === 0) {
      return res.status(404).json({
        message: "No branch transaction history found for this date range.",
      });
    }

    // 2. Fetch ALL terminals to map branch + district
    const terminals = await prisma.terminal.findMany({
      select: {
        terminal_code: true,
        branch: {
          select: {
            branch_name: true,
            district: { select: { district_name: true } },
          },
        },
      },
    });

    const terminalMap = {};
    terminals.forEach(t => {
      terminalMap[t.terminal_code] = {
        branch: t.branch?.branch_name || "Unknown",
        district: t.branch?.district?.district_name || "Unknown",
      };
    });

    // 3. Merge data + added *_dollar fields
    const mergedData = history.map(h => ({
      terminal_id: h.terminal_id,
      branch: terminalMap[h.terminal_id]?.branch || "Unknown",
      district: terminalMap[h.terminal_id]?.district || "Unknown",

      cash_advance: h.cash_advance || 0,
      cash_advance_amount: Number(h.cash_advance_amount) || 0,

      visa_txn: h.visa_txn || 0,
      visa_amount: Number(h.visa_amount) || 0,
      visa_dollar: Number(h.visa_dollar) || 0,   // Added

      mc_txn: h.mc_txn || 0,
      mc_amount: Number(h.mc_amount) || 0,
      mc_dollar: Number(h.mc_dollar) || 0,       // Added

      cup_txn: h.cup_txn || 0,
      cup_amount: Number(h.cup_amount) || 0,
      cup_dollar: Number(h.cup_dollar) || 0,     // Added

      total_txn: h.total_txn || 0,
      total_amount: Number(h.total_amount) || 0,

      transaction_date: h.transaction_date
        ? h.transaction_date.toISOString().split("T")[0]
        : "",
    }));

    // ------------------------------------------
    // 4. Build Summary Sheet (per branch)
    // ------------------------------------------

    const summaryMap = {};

    mergedData.forEach(row => {
      const branch = row.branch;

      if (!summaryMap[branch]) {
        summaryMap[branch] = {
          branch,
          total_branch_txn: 0,
          total_branch_amount: 0,
          total_branch_visa_dollar: 0,
          total_branch_mc_dollar: 0,
          total_branch_cup_dollar: 0,
        };
      }

      summaryMap[branch].total_branch_txn += row.total_txn;
      summaryMap[branch].total_branch_amount += row.total_amount;
      summaryMap[branch].total_branch_visa_dollar += row.visa_dollar;
      summaryMap[branch].total_branch_mc_dollar += row.mc_dollar;
      summaryMap[branch].total_branch_cup_dollar += row.cup_dollar;
    });

    const summaryData = Object.values(summaryMap);

    // 5. Create Excel
    const workbook = xlsx.utils.book_new();

    // First sheet = full history
    const worksheet = xlsx.utils.json_to_sheet(mergedData);
    xlsx.utils.book_append_sheet(workbook, worksheet, "AllBranchHistory");

    // Second sheet = summary
    const summarySheet = xlsx.utils.json_to_sheet(summaryData);
    xlsx.utils.book_append_sheet(workbook, summarySheet, "BranchSummary");

    const fileName = `branch_history_all_${from}_to_${to}.xlsx`;
    const outputPath = `uploads/${fileName}`;
    xlsx.writeFile(workbook, outputPath);

    // 6. Send file
    res.download(outputPath, fileName, () => fs.unlinkSync(outputPath));
  } catch (err) {
    console.error("Error exporting all branch history by date:", err);
    res.status(500).json({ message: "Something went wrong!" });
  } finally {
    await prisma.$disconnect();
  }
};



