const xlsx = require("xlsx");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ---------------------- MERCHANT HISTORY ----------------------
exports.exportMerchantHistory = async (req, res) => {
  try {
    // 1. Fetch all merchant transaction history
    const history = await prisma.merchanttransactionhistory.findMany();

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

    // 4. Merge merchant history with terminal info
    const mergedData = history.map(h => ({
      terminal_name: h.terminal_name,
      terminal_id: h.terminal_id,
      branch: terminalMap[h.terminal_id]?.branch || "Unknown",
      district: terminalMap[h.terminal_id]?.district || "Unknown",
      sum_local_txn: h.sum_local_txn || 0,
      sum_local_txn_amnt: Number(h.sum_local_txn_amnt) || 0,
      sum_visa_txn: h.sum_visa_txn || 0,
      sum_visa_amount: Number(h.sum_visa_amount) || 0,
      sum_mc_txn: h.sum_mc_txn || 0,
      sum_mc_amount: Number(h.sum_mc_amount) || 0,
      sum_cup_txn: h.sum_cup_txn || 0,
      sum_cup_amount: Number(h.sum_cup_amount) || 0,
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

    // 4. Merge branch history with terminal info
    const mergedData = history.map(h => ({
      terminal_id: h.terminal_id,
      branch: terminalMap[h.terminal_id]?.branch || "Unknown",
      district: terminalMap[h.terminal_id]?.district || "Unknown",
      cash_advance: h.cash_advance || 0,
      cash_advance_amount: Number(h.cash_advance_amount) || 0,
      visa_txn: h.visa_txn || 0,
      visa_amount: Number(h.visa_amount) || 0,
      mc_txn: h.mc_txn || 0,
      mc_amount: Number(h.mc_amount) || 0,
      cup_txn: h.cup_txn || 0,
      cup_amount: Number(h.cup_amount) || 0,
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

    // 1. Fetch merchant transaction history for given terminal and date range
    const history = await prisma.merchanttransactionhistory.findMany({
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
      terminal_name: h.terminal_name,
      terminal_id: h.terminal_id,
      branch: terminal?.branch?.branch_name || "Unknown",
      district: terminal?.branch?.district?.district_name || "Unknown",
      sum_local_txn: h.sum_local_txn || 0,
      sum_local_txn_amnt: Number(h.sum_local_txn_amnt) || 0,
      sum_visa_txn: h.sum_visa_txn || 0,
      sum_visa_amount: Number(h.sum_visa_amount) || 0,
      sum_mc_txn: h.sum_mc_txn || 0,
      sum_mc_amount: Number(h.sum_mc_amount) || 0,
      sum_cup_txn: h.sum_cup_txn || 0,
      sum_cup_amount: Number(h.sum_cup_amount) || 0,
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
      mc_txn: h.mc_txn || 0,
      mc_amount: Number(h.mc_amount) || 0,
      cup_txn: h.cup_txn || 0,
      cup_amount: Number(h.cup_amount) || 0,
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
