// controllers/terminalController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Create a new terminal
const createTerminal = async (req, res) => {
  try {
    const { terminal_code, merchant_name, branch_id } = req.body;

    // terminal_code must be unique
    const existing = await prisma.terminal.findUnique({
      where: { terminal_code },
    });

    if (existing) {
      return res.status(400).json({ message: "Terminal code already exists" });
    }

    const terminal = await prisma.terminal.create({
      data: {
        terminal_code,
        merchant_name,
        branch_id,
        is_deleted: false, // default
      },
    });

    res.status(201).json(terminal);
  } catch (err) {
    console.error("Error creating terminal:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all non-deleted terminals
const getTerminals = async (req, res) => {
  try {
    const terminals = await prisma.terminal.findMany({
      include: {
        branch: {
          select: {
            branch_name: true,
            district: {
              select: { district_name: true },
            },
          },
        },
      },
    });

    // Map terminals to include a status label
    const formatted = terminals.map(t => ({
      terminal_code: t.terminal_code,
      merchant_name: t.merchant_name,
      branch_name: t.branch?.branch_name || "Unknown",
      district_name: t.branch?.district?.district_name || "Unknown",
      grand_total: t.grand_total,
      grand_total_updated_at: t.grand_total_updated_at,
      status: t.is_deleted ? "Inactive" : "Active", // ✅ status field
    }));

    res.status(200).json(formatted);
  } catch (error) {
    console.error("Error fetching terminals:", error);
    res.status(500).json({ message: "Server error" });
  }
};



// Get terminal by ID (ignores deleted)
const getTerminalById = async (req, res) => {
  try {
    const { id } = req.params;

    const terminal = await prisma.terminal.findFirst({
      where: {
        terminal_id: Number(id),
        is_deleted: false,
      },
      include: {
        branch: { select: { branch_name: true, district_id: true } },
      },
    });

    if (!terminal) {
      return res.status(404).json({ message: "Terminal not found" });
    }

    res.json(terminal);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update terminal (only merchant_name and branch_id)
const updateTerminal = async (req, res) => {
  try {
    const { id } = req.params;
    const { merchant_name, branch_id } = req.body;

    const existingTerminal = await prisma.terminal.findFirst({
      where: { terminal_id: Number(id), is_deleted: false },
    });

    if (!existingTerminal) {
      return res.status(404).json({ message: "Terminal not found or deleted" });
    }

    const updatedTerminal = await prisma.terminal.update({
      where: { terminal_id: Number(id) },
      data: { merchant_name, branch_id },
    });

    res.json(updatedTerminal);
  } catch (err) {
    console.error("Error updating terminal:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Soft delete terminal
const deleteTerminal = async (req, res) => {
  try {
    const { id } = req.params;

    const terminal = await prisma.terminal.findFirst({
      where: { terminal_id: Number(id), is_deleted: false },
    });

    if (!terminal) {
      return res.status(404).json({ message: "Terminal not found or already deleted" });
    }

    await prisma.terminal.update({
      where: { terminal_id: Number(id) },
      data: { is_deleted: true },
    });

    res.json({ message: "Terminal soft-deleted successfully" });
  } catch (err) {
    console.error("Error deleting terminal:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createTerminal,
  getTerminals,
  getTerminalById,
  updateTerminal,
  deleteTerminal,
};


// const xlsx = require("xlsx");
// const fs = require("fs");
// const db = require("../config/db");

// exports.uploadTerminals = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).send("No file uploaded");
//     }

//     const workbook = xlsx.readFile(req.file.path);
//     const sheetName = workbook.SheetNames[0];
//     const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

//     for (const row of data) {
//       if (row.terminal_code && row.merchant_name && row.branch_id) {
//         await db.query(
//           "INSERT INTO terminal (terminal_code, merchant_name, branch_id) VALUES (?, ?, ?)",
//           [row.terminal_code, row.merchant_name, row.branch_id]
//         );
//       }
//     }

//     fs.unlinkSync(req.file.path);
//     res.send("Terminals inserted successfully!");
//   } catch (error) {
//     console.error("Error inserting terminals:", error);
//     res.status(500).send("Failed to insert terminals");
//   }
// };
