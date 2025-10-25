const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.updateExchangeRates = async (req, res) => {
  try {
    const { CUP, MC, VC } = req.body;

    if (CUP == null || MC == null || VC == null) {
      return res.status(400).json({
        message: "All exchange rates (CUP, MC, VC) are required.",
      });
    }

    // ✅ Transaction updates
    const updates = await prisma.$transaction([
      prisma.currency.update({
        where: { currency_code: "CUP" },
        data: { exchange_rate: CUP, last_updated: new Date() },
      }),
      prisma.currency.update({
        where: { currency_code: "MC" },
        data: { exchange_rate: MC, last_updated: new Date() },
      }),
      prisma.currency.update({
        where: { currency_code: "VC" },
        data: { exchange_rate: VC, last_updated: new Date() },
      }),
    ]);

    res.status(200).json({
      message: "Exchange rates updated successfully!",
      updates,
    });
  } catch (error) {
    console.error("Error updating exchange rates:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "One or more currency records not found." });
    }
    res.status(500).json({ message: "Server error while updating exchange rates" });
  } finally {
    await prisma.$disconnect();
  }
};
