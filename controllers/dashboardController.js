const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getActiveCounts = async (req, res) => {
  try {
    // Get active (non-deleted) counts in parallel
    const [branches, districts, terminals] = await Promise.all([
      prisma.branch.count({ where: { is_deleted: false } }),
      prisma.district.count({ where: { is_deleted: false } }),
      prisma.terminal.count({ where: { is_deleted: false } }),
    ]);

    res.status(200).json({
      branches,
      districts,
      terminals,
    });
  } catch (error) {
    console.error("❌ Error fetching active counts:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    await prisma.$disconnect();
  }
};
