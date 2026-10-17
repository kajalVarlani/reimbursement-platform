
const {
  generateReimbursementSummary,
} = require("../services/reimbursementSummaryService");

async function generateSummary(req, res) {
  try {
    const { bill, validation } = req.body;

    if (!bill || typeof bill !== "object" || Array.isArray(bill)) {
      return res.status(400).json({
        message: "Valid bill data is required.",
      });
    }

    const summary = await generateReimbursementSummary(
      bill,
      validation
    );

    return res.status(200).json({
      message: "Reimbursement summary generated successfully.",
      summary,
    });
  } catch (error) {
    console.error("Reimbursement summary failed:", error.message);

    return res.status(500).json({
      message: "Failed to generate reimbursement summary.",
    });
  }
}

module.exports = { generateSummary };
