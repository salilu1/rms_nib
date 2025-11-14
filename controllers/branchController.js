const ExcelJS = require("exceljs");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();


// Create Branch
exports.createBranch = async (req, res) => {
  try {
    const { branch_name, district_id } = req.body;
    const branch = await prisma.branch.create({
      data: { branch_name, district_id: Number(district_id) },
    });
    res.status(201).json(branch);
  } catch (error) {
    res.status(500).json({ error: "Failed to create branch" });
  }
};

// //Get All Branches (active only)
// exports.getBranches = async (req, res) => {
//   try {
//     const branches = await prisma.branch.findMany({
//       where: { is_deleted: false },
//       include: {
//         district: { select: { district_name: true } },
//       },
//     });
//     res.json(branches);
//   } catch (error) {
//     res.status(500).json({ error: "Failed to fetch branches" });
//   }
// };
exports.getBranches = async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { branch_name: "asc" }, // sort alphabetically
      select: {
        branch_id: true,
        branch_name: true,
        is_deleted: true,
        district: {
          select: {
            district_name: true,
          },
        },
      },
    });

    // Format result to include status
    const formattedBranches = branches.map(branch => ({
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
      district_name: branch.district?.district_name || null,
      status: branch.is_deleted ? "Inactive" : "Active",
    }));

    res.status(200).json(formattedBranches);
  } catch (error) {
    console.error("❌ Error fetching branches:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Branch by ID
exports.getBranchById = async (req, res) => {
  try {
    const { id } = req.params;
    const branch = await prisma.branch.findFirst({
      where: { branch_id: Number(id), is_deleted: false },
      include: { district: { select: { district_name: true } } },
    });
    if (!branch) return res.status(404).json({ error: "Branch not found" });
    res.json(branch);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch branch" });
  }
};

// Update Branch (branch_name and district_id)
exports.updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const { branch_name, district_id } = req.body;

    const updated = await prisma.branch.update({
      where: { branch_id: Number(id) },
      data: {
        branch_name,
        district_id: Number(district_id),
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update branch" });
  }
};

// Soft Delete Branch
exports.deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (user.role !== "admin")
      return res.status(403).json({ error: "Only admin can delete" });

    await prisma.branch.update({
      where: { branch_id: Number(id) },
      data: { is_deleted: true },
    });

    res.json({ message: "Branch soft-deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete branch" });
  }
};

exports.downloadBranches = async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { is_deleted: false },
      include: {
        district: { select: { district_name: true } },
      },
    });

    if (!branches.length)
      return res.status(404).json({ message: "No branches found" });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Branches");

    worksheet.columns = [
      { header: "Branch ID", key: "branch_id", width: 15 },
      { header: "Branch Name", key: "branch_name", width: 30 },
      { header: "District Name", key: "district_name", width: 30 },
    ];

    branches.forEach((b) =>
      worksheet.addRow({
        branch_id: b.branch_id,
        branch_name: b.branch_name,
        district_name: b.district.district_name,
      })
    );

    // Style header
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center" };
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=branches_${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error downloading branches:", error);
    res.status(500).json({ message: "Server error" });
  }
};

