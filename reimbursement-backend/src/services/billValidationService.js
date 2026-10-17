
const ALLOWED_CATEGORIES = [
  "TRAVEL",
  "FOOD",
  "ACCOMMODATION",
  "EQUIPMENT",
  "OFFICE_SUPPLIES",
  "OTHER",
];

function validateExtractedBill(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      passed: false,
      errors: ["Invalid extraction data."],
      warnings: [],
    };
  }

  // 1. Validate required identifying fields.
  if (typeof data.vendorName !== "string" || !data.vendorName.trim()) {
    warnings.push("Vendor name is missing.");
  }

  if (
    typeof data.invoiceNumber !== "string" ||
    !data.invoiceNumber.trim()
  ) {
    warnings.push("Invoice number is missing.");
  }

  if (!data.currency) {
    warnings.push("Currency could not be identified.");
  }

  // 2. Validate the invoice date.
  if (data.billDate == null || data.billDate === "") {
    warnings.push("Invoice date is missing.");
  } else {
    const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(data.billDate);
    const parsedDate = new Date(`${data.billDate}T00:00:00Z`);

    if (
      typeof data.billDate !== "string" ||
      !validFormat ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== data.billDate
    ) {
      warnings.push("Invoice date is invalid or unclear.");
    }
  }

  // 3. Validate monetary fields.
  for (const field of ["subtotal", "taxAmount", "amount"]) {
    const value = data[field];

    if (value === null || value === undefined) {
      warnings.push(`${field} could not be extracted.`);
      continue;
    }

    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0
    ) {
      errors.push(`${field} must be a non-negative number.`);
    }
  }

  // 4. Compare subtotal + tax with the extracted total.
  const monetaryValuesValid = ["subtotal", "taxAmount", "amount"].every(
    (field) =>
      typeof data[field] === "number" &&
      Number.isFinite(data[field]) &&
      data[field] >= 0
  );

  if (monetaryValuesValid) {
    const calculatedTotal = data.subtotal + data.taxAmount;

    if (Math.abs(calculatedTotal - data.amount) > 0.02) {
      warnings.push(
        `Amount mismatch: subtotal plus tax is ${calculatedTotal}, ` +
        `but the extracted total is ${data.amount}. ` +
        "Check for discounts, additional fees or extraction errors."
      );
    }
  }

  if (data.amount === 0) {
    warnings.push("The extracted bill total is zero.");
  }

  // 5. Validate the expense category.
  if (!ALLOWED_CATEGORIES.includes(data.category)) {
    warnings.push("Expense category is missing or unrecognized.");
  }

  // 6. Validate line items.
  if (!Array.isArray(data.lineItems)) {
    warnings.push("Line items could not be read.");
  } else {
    data.lineItems.forEach((item, index) => {
      if (
        !item ||
        typeof item.description !== "string" ||
        !item.description.trim()
      ) {
        warnings.push(`Line item ${index + 1} has no description.`);
      }

      if (
        item?.amount != null &&
        (typeof item.amount !== "number" ||
          !Number.isFinite(item.amount) ||
          item.amount < 0)
      ) {
        errors.push(`Line item ${index + 1} has an invalid amount.`);
      }
    });
  }

  return {
    passed: errors.length === 0 && warnings.length === 0,
    errors,
    warnings,
    checkedAt: new Date().toISOString(),
  };
}

module.exports = { validateExtractedBill };
