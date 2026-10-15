const ExcelJS = require("exceljs");
const prisma = require("../prisma/client");

/**
 * Generates an official Excel Indent (.xlsx) specifically for the Treasurer
 * reconciling monthly buffer allocation, all paid claims, buffer exhaustion status,
 * and physical paper bill checklists.
 */
async function exportTreasurerMonthlyIndent(req, res) {
  try {
    const { month } = req.query;
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const targetMonth = month || defaultMonth;

    const [yearStr, monthStr] = targetMonth.split("-");
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1;

    const startOfMonth = new Date(year, monthIndex, 1);
    const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

    // Fetch all claims that were paid or approved in this month
    const reimbursements = await prisma.reimbursement.findMany({
      where: {
        OR: [
          {
            paidAt: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          {
            isPaid: true,
            updatedAt: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
        ],
      },
      include: {
        user: { select: { name: true, email: true, designation: true } },
        bills: { include: { bill: true } },
      },
      orderBy: { paidAt: "asc" },
    });

    // Fetch Treasurer Buffer details for this month
    const buffer = await prisma.treasurerBuffer.findFirst({
      where: { currentMonth: targetMonth },
      orderBy: { updatedAt: "desc" },
    });

    const monthlyAdvance = buffer ? buffer.monthlyAdvance : 50000.0;
    const currentBalance = buffer ? buffer.currentBalance : 50000.0;

    const bufferClaims = reimbursements.filter((r) => r.paidFromBuffer || r.withinBuffer);
    const accountantClaims = reimbursements.filter((r) => r.routedToAccountant || !r.withinBuffer);

    const totalFromBuffer = bufferClaims.reduce((sum, r) => sum + r.amount, 0);
    const totalFromAccountant = accountantClaims.reduce((sum, r) => sum + r.amount, 0);
    const totalAllDisbursements = totalFromBuffer + totalFromAccountant;

    const isBufferExhausted = currentBalance <= 0 || totalFromBuffer >= monthlyAdvance;
    const bufferStatusText = isBufferExhausted
      ? "EXHAUSTED (0.00 Balance Remaining)"
      : `SURPLUS AVAILABLE (₹${currentBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })} Remaining)`;

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ClaimNest - Reimbursement Platform";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`Indent_${targetMonth}`, {
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
    });

    // Formatting Helpers
    const fontHeader = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    const fontSubHeader = { name: "Arial", size: 11, bold: true, color: { argb: "FF333333" } };
    const fontBold = { name: "Arial", size: 10, bold: true };
    const fontRegular = { name: "Arial", size: 10 };

    const fillNavy = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
    const fillLightGray = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    const fillHighlight = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isBufferExhausted ? "FFFEE2E2" : "FFDCFCE7" },
    };

    const borderThin = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };

    // Set Column Widths
    sheet.columns = [
      { width: 6 },  // S.No
      { width: 14 }, // Date
      { width: 22 }, // Club / Committee
      { width: 24 }, // Event Name
      { width: 28 }, // Invoices / Receipt Ref
      { width: 20 }, // Payee Name
      { width: 14 }, // Payee Type
      { width: 15 }, // Payment Mode
      { width: 24 }, // Account / UPI ID
      { width: 22 }, // Payment Ref / UTR
      { width: 20 }, // Funding Channel
      { width: 16 }, // Amount (₹)
      { width: 18 }, // Physical Bill Attached
    ];

    // Row 1: Title
    const titleRow = sheet.addRow(["STUDENT BODY GOVERNMENT - TREASURER'S MONTHLY EXPENSE INDENT"]);
    sheet.mergeCells("A1:M1");
    titleRow.font = fontHeader;
    titleRow.fill = fillNavy;
    titleRow.alignment = { vertical: "middle", horizontal: "center" };
    titleRow.height = 36;

    // Row 2: Subtitle
    const subTitleRow = sheet.addRow([
      `Month: ${targetMonth}  |  Generated on: ${now.toLocaleDateString("en-IN")}  |  Generated For: SBG Treasurer`,
    ]);
    sheet.mergeCells("A2:M2");
    subTitleRow.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF4B5563" } };
    subTitleRow.alignment = { vertical: "middle", horizontal: "center" };
    subTitleRow.height = 20;

    sheet.addRow([]); // Blank line

    // Buffer Statement KPI Summary Box
    const kpiHeader = sheet.addRow(["MONTHLY ADVANCE BUFFER RECONCILIATION STATEMENT", "", "", ""]);
    sheet.mergeCells("A4:E4");
    kpiHeader.font = fontSubHeader;
    kpiHeader.fill = fillLightGray;

    const r1 = sheet.addRow(["Total Advance Buffer Allocated for Month:", `₹${monthlyAdvance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, "", "Total Reimbursed from Buffer:", `₹${totalFromBuffer.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`]);
    r1.font = fontRegular;
    r1.getCell(1).font = fontBold;
    r1.getCell(4).font = fontBold;

    const r2 = sheet.addRow(["Current Buffer Available Balance:", `₹${currentBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, "", "Total Reimbursed via Central Accountant:", `₹${totalFromAccountant.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`]);
    r2.font = fontRegular;
    r2.getCell(1).font = fontBold;
    r2.getCell(4).font = fontBold;

    const r3 = sheet.addRow(["Buffer Exhaustion Status:", bufferStatusText, "", "Total Monthly Expenditure (All Sources):", `₹${totalAllDisbursements.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`]);
    r3.font = fontRegular;
    r3.getCell(1).font = fontBold;
    r3.getCell(2).font = { name: "Arial", size: 10, bold: true, color: { argb: isBufferExhausted ? "FF991B1B" : "FF166534" } };
    r3.getCell(2).fill = fillHighlight;
    r3.getCell(4).font = fontBold;

    sheet.addRow([]); // Blank line

    // Claims Table Header
    const tableHeader = sheet.addRow([
      "S.No",
      "Paid Date",
      "Club / Committee",
      "Event Name",
      "Invoices / Receipt Ref",
      "Payee Name",
      "Payee Type",
      "Payment Mode",
      "Account / UPI ID",
      "UTR / Transaction Ref",
      "Funding Channel",
      "Amount (₹)",
      "Physical Copy Attached?",
    ]);
    tableHeader.font = fontSubHeader;
    tableHeader.fill = fillLightGray;
    tableHeader.alignment = { vertical: "middle", horizontal: "center" };
    tableHeader.height = 28;

    for (let c = 1; c <= 13; c++) {
      tableHeader.getCell(c).border = borderThin;
    }

    // Populate Reimbursement Rows
    if (reimbursements.length === 0) {
      const emptyRow = sheet.addRow(["No claims were disbursed or marked paid for this month", "", "", "", "", "", "", "", "", "", "", "", ""]);
      sheet.mergeCells(`A${emptyRow.number}:M${emptyRow.number}`);
      emptyRow.alignment = { horizontal: "center" };
      emptyRow.font = { name: "Arial", size: 10, italic: true };
    } else {
      reimbursements.forEach((claim, idx) => {
        const paidDateStr = claim.paidAt
          ? new Date(claim.paidAt).toLocaleDateString("en-IN")
          : new Date(claim.updatedAt).toLocaleDateString("en-IN");

        const invoiceNumbers = claim.bills
          ?.map((b) => b.bill?.invoiceNumber || b.bill?.transactionId || "Receipt Attached")
          .filter(Boolean)
          .join(", ") || "Bills Attached";

        const accountOrUpi = claim.paymentMode === "UPI"
          ? (claim.upiId || "UPI")
          : `${claim.bankName ? claim.bankName + " - " : ""}${claim.accountNumber || "N/A"} (${claim.ifscCode || ""})`;

        const fundingChannel = claim.paidFromBuffer
          ? "Treasurer Buffer"
          : claim.routedToAccountant
          ? "Central Accountant"
          : "Treasurer Buffer";

        const row = sheet.addRow([
          idx + 1,
          paidDateStr,
          claim.committee,
          claim.event,
          invoiceNumbers,
          claim.beneficiaryName || claim.user?.name || "Payee",
          claim.recipientType || "STUDENT",
          claim.paymentMode || "BANK_TRANSFER",
          accountOrUpi,
          claim.paymentReference || "Disbursed",
          fundingChannel,
          claim.amount,
          "[  ] Attached",
        ]);

        row.font = fontRegular;
        row.getCell(1).alignment = { horizontal: "center" };
        row.getCell(2).alignment = { horizontal: "center" };
        row.getCell(7).alignment = { horizontal: "center" };
        row.getCell(8).alignment = { horizontal: "center" };
        row.getCell(11).alignment = { horizontal: "center" };
        row.getCell(12).alignment = { horizontal: "right" };
        row.getCell(12).numFmt = "₹#,##0.00";
        row.getCell(13).alignment = { horizontal: "center" };

        for (let c = 1; c <= 13; c++) {
          row.getCell(c).border = borderThin;
        }
      });

      // Total Row
      const totalRow = sheet.addRow([
        "TOTAL",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        totalAllDisbursements,
        "",
      ]);
      sheet.mergeCells(`A${totalRow.number}:K${totalRow.number}`);
      totalRow.font = fontBold;
      totalRow.getCell(1).alignment = { horizontal: "right" };
      totalRow.getCell(12).alignment = { horizontal: "right" };
      totalRow.getCell(12).numFmt = "₹#,##0.00";
      totalRow.fill = fillLightGray;

      for (let c = 1; c <= 13; c++) {
        totalRow.getCell(c).border = borderThin;
      }
    }

    sheet.addRow([]);
    sheet.addRow([]);

    // Sign-off section
    const signRow = sheet.addRow([
      "Submitted by:",
      "",
      "",
      "",
      "",
      "Received & Audited by:",
      "",
      "",
      "",
      "",
      "Sanctioned by:",
      "",
      "",
    ]);
    signRow.font = fontBold;

    sheet.addRow([]);
    sheet.addRow([]);

    const nameRow = sheet.addRow([
      "SBG Treasurer",
      "",
      "",
      "",
      "",
      "University Accountant",
      "",
      "",
      "",
      "",
      "Dean Students",
      "",
      "",
    ]);
    nameRow.font = { name: "Arial", size: 10, italic: true };

    // Stream back Excel file
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Treasurer_Monthly_Indent_${targetMonth}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export Treasurer Monthly Indent error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * GET /api/admin/indent/summary?month=YYYY-MM
 * Returns high-level metrics for the indent before generating the XLSX.
 */
async function getIndentSummary(req, res) {
  try {
    const { month } = req.query;
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const targetMonth = month || defaultMonth;

    const [yearStr, monthStr] = targetMonth.split("-");
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1;

    const startOfMonth = new Date(year, monthIndex, 1);
    const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

    const reimbursements = await prisma.reimbursement.findMany({
      where: {
        OR: [
          { paidAt: { gte: startOfMonth, lte: endOfMonth } },
          { isPaid: true, updatedAt: { gte: startOfMonth, lte: endOfMonth } },
        ],
      },
      include: {
        bills: true,
      },
    });

    let buffer = await prisma.treasurerBuffer.findFirst({
      where: { currentMonth: targetMonth },
      orderBy: { updatedAt: "desc" },
    });
    if (!buffer) {
      buffer = await prisma.treasurerBuffer.findFirst({
        orderBy: { updatedAt: "desc" },
      });
    }

    const monthlyAdvance = buffer ? buffer.monthlyAdvance : 50000.0;
    const currentBalance = buffer ? buffer.currentBalance : 50000.0;

    const bufferClaims = reimbursements.filter((r) => r.paidFromBuffer || r.withinBuffer);
    const accountantClaims = reimbursements.filter((r) => r.routedToAccountant || !r.withinBuffer);

    const bufferTotal = bufferClaims.reduce((sum, r) => sum + r.amount, 0);
    const accountantTotal = accountantClaims.reduce((sum, r) => sum + r.amount, 0);
    const totalDisbursed = reimbursements.reduce((sum, r) => sum + r.amount, 0);
    const totalBills = reimbursements.reduce((sum, r) => sum + (r.bills?.length || 0), 0);

    const isBufferExhausted = currentBalance <= 0 || bufferTotal >= monthlyAdvance;

    res.status(200).json({
      targetMonth,
      monthlyAdvance,
      currentBalance,
      isBufferExhausted,
      bufferClaimsCount: bufferClaims.length,
      bufferTotal,
      accountantClaimsCount: accountantClaims.length,
      accountantTotal,
      totalClaimsCount: reimbursements.length,
      totalDisbursed,
      totalBills,
      reimbursements: reimbursements.map((r) => ({
        id: r.id,
        committee: r.committee,
        event: r.event,
        amount: r.amount,
        paidAt: r.paidAt || r.updatedAt,
        beneficiaryName: r.beneficiaryName,
        recipientType: r.recipientType,
        paymentMode: r.paymentMode,
        paymentReference: r.paymentReference,
        fundingChannel: r.paidFromBuffer ? 'Treasurer Buffer' : (r.routedToAccountant ? 'Central Accountant' : 'Treasurer Buffer'),
        billsCount: r.bills?.length || 0,
      })),
    });
  } catch (error) {
    console.error("Get indent summary error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = {
  exportTreasurerMonthlyIndent,
  getIndentSummary,
};
