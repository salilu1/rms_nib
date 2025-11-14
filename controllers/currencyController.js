const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.updateExchangeRates = async (req, res) => {
  try {
    const { CUP, MC, VC, date } = req.body;

    if (CUP == null || MC == null || VC == null || !date) {
      return res.status(400).json({
        message: "All exchange rates (CUP, MC, VC) and 'date' are required.",
      });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format." });
    }

    // ✅ Transaction updates
    const updates = await prisma.$transaction([
      prisma.currency.update({
        where: { currency_code: "CUP" },
        data: { exchange_rate: CUP, last_updated: parsedDate },
      }),
      prisma.currency.update({
        where: { currency_code: "MC" },
        data: { exchange_rate: MC, last_updated: parsedDate },
      }),
      prisma.currency.update({
        where: { currency_code: "VC" },
        data: { exchange_rate: VC, last_updated: parsedDate },
      }),
    ]);

    res.status(200).json({
      message: `Exchange rates updated successfully for ${date}!`,
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
