const ExcelJS = require("exceljs");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create District
exports.createDistrict = async (req, res) => {
  try {
    const { district_name } = req.body;
    const district = await prisma.district.create({
      data: { district_name },
    });
    res.status(201).json(district);
  } catch (error) {
    console.error("Error creating district:", error);
    res.status(500).json({ error: "Failed to create district" });
  }
};

// Get All Districts (only active)
// exports.getDistricts = async (req, res) => {
//   try {
//     const districts = await prisma.district.findMany({
//       where: { is_deleted: false },
//       include: {
//         branch: {
//           where: { is_deleted: false },
//           select: { branch_id: true, branch_name: true },
//         },
//       },
//     });
//     res.json(districts);
//   } catch (error) {
//     console.error("Error fetching districts:", error);
//     res.status(500).json({ error: "Failed to fetch districts" });
//   }
// };


// Get all districts (sorted by district_name)
exports.getDistricts = async (req, res) => {
  try {
    const districts = await prisma.district.findMany({
      orderBy: { district_name: "asc" }, // Sort alphabetically
      select: {
        district_id: true,
        district_name: true,
        is_deleted: true,
      },
    });

    // Add readable status
    const formattedDistricts = districts.map(district => ({
      district_id: district.district_id,
      district_name: district.district_name,
      status: district.is_deleted ? "Inactive" : "Active",
    }));

    res.status(200).json(formattedDistricts);
  } catch (error) {
    console.error("❌ Error fetching districts:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// Get District by ID
exports.getDistrictById = async (req, res) => {
  try {
    const { id } = req.params;
    const district = await prisma.district.findFirst({
      where: { district_id: Number(id), is_deleted: false },
      include: {
        branch: {
          where: { is_deleted: false },
          select: { branch_id: true, branch_name: true },
        },
      },
    });
    if (!district) return res.status(404).json({ error: "District not found" });
    res.json(district);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch district" });
  }
};

// Update District (only district_name)
exports.updateDistrict = async (req, res) => {
  try {
    const { id } = req.params;
    const { district_name } = req.body;

    const updated = await prisma.district.update({
      where: { district_id: Number(id) },
      data: { district_name },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update district" });
  }
};

// Soft Delete District (admin only)
exports.deleteDistrict = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (user.role !== "admin")
      return res.status(403).json({ error: "Only admin can delete" });

    // Check if district has active branches
    const hasBranches = await prisma.branch.findFirst({
      where: { district_id: Number(id), is_deleted: false },
    });

    if (hasBranches)
      return res
        .status(400)
        .json({ error: "Cannot delete district with active branches." });

    await prisma.district.update({
      where: { district_id: Number(id) },
      data: { is_deleted: true },
    });

    res.json({ message: "District soft-deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete district" });
  }
};

exports.downloadDistricts = async (req, res) => {
    
  try {
    const districts = await prisma.district.findMany({
      where: { is_deleted: false },
      include: {
        branch: { select: { branch_name: true } },
      },
    });

    if (!districts.length)
      return res.status(404).json({ message: "No districts found" });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Districts");

    worksheet.columns = [
      { header: "District ID", key: "district_id", width: 15 },
      { header: "District Name", key: "district_name", width: 30 },
      { header: "Total Branches", key: "total_branches", width: 20 },
    ];

    districts.forEach((d) =>
      worksheet.addRow({
        district_id: d.district_id,
        district_name: d.district_name,
        total_branches: d.branch.length,
      })
    );

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
      `attachment; filename=districts_${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error downloading districts:", error);
    res.status(500).json({ message: "Server error" });
  }
};


