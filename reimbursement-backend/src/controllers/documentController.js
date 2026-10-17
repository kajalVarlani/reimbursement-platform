
const {
  extractBillFromPdf,
} = require("../services/documentProcessingService");

const {
  validateExtractedBill,
} = require("../services/billValidationService");

async function extractBill(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please upload a PDF bill using the 'receipt' field.",
      });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({
        message: "Only PDF files are supported by this endpoint.",
      });
    }

    const extractedData = await extractBillFromPdf(req.file.buffer);
    const validation = validateExtractedBill(extractedData);

    return res.status(200).json({
      message: "Bill information extracted successfully.",
      verified: false,
      data: extractedData,
      validation,
    });
  } catch (error) {
    console.error("Bill extraction failed:", error.message);

    return res.status(500).json({
      message: "Failed to extract bill information. Please try again.",
    });
  }
}

module.exports = { extractBill };
