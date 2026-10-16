require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function clearTransactions() {
  console.log("🧹 Clearing all transactional data while preserving Users and Administrators...");

  // Delete in foreign key dependency order
  const deletedActivityLogs = await prisma.activityLog.deleteMany({});
  console.log(`Deleted ${deletedActivityLogs.count} ActivityLogs`);

  const deletedApprovals = await prisma.reimbursementApproval.deleteMany({});
  console.log(`Deleted ${deletedApprovals.count} ReimbursementApprovals`);

  const deletedReimbursementBills = await prisma.reimbursementBill.deleteMany({});
  console.log(`Deleted ${deletedReimbursementBills.count} ReimbursementBills`);

  const deletedBills = await prisma.bill.deleteMany({});
  console.log(`Deleted ${deletedBills.count} Bills`);

  const deletedReimbursements = await prisma.reimbursement.deleteMany({});
  console.log(`Deleted ${deletedReimbursements.count} Reimbursements`);

  const deletedBufferTx = await prisma.bufferTransaction.deleteMany({});
  console.log(`Deleted ${deletedBufferTx.count} BufferTransactions`);

  const deletedProjectionItems = await prisma.projectionItem.deleteMany({});
  console.log(`Deleted ${deletedProjectionItems.count} ProjectionItems`);

  const deletedProjections = await prisma.monthlyProjection.deleteMany({});
  console.log(`Deleted ${deletedProjections.count} MonthlyProjections`);

  const deletedWindows = await prisma.projectionWindow.deleteMany({});
  console.log(`Deleted ${deletedWindows.count} ProjectionWindows`);

  // Reset or clear Club Budgets & Treasurer Buffer to fresh state
  await prisma.clubBudget.deleteMany({});
  console.log(`Reset Club Budgets`);

  // Ensure fresh Treasurer buffer exists with 50,000 balance
  await prisma.treasurerBuffer.deleteMany({});
  await prisma.treasurerBuffer.create({
    data: {
      monthlyAdvance: 50000.0,
      currentBalance: 50000.0,
      currentMonth: new Date().toISOString().slice(0, 7), // e.g. "2026-10"
    },
  });
  console.log(`Reset Treasurer Buffer to ₹50,000 for current month`);

  // Ensure default Club Budget exists for Music Club
  await prisma.clubBudget.create({
    data: {
      clubName: "Music Club",
      targetMonth: new Date().toISOString().slice(0, 7),
      allocatedAmount: 25000.0,
      spentAmount: 0.0,
      notes: "Initial testing budget",
    },
  });
  console.log(`Created test budget for Music Club: ₹25,000`);

  // Verify accounts
  const users = await prisma.user.findMany({ select: { name: true, email: true, clubName: true } });
  const admins = await prisma.administrator.findMany({ select: { name: true, email: true, role: true } });

  console.log("\n✅ Users preserved:", users);
  console.log("✅ Admins preserved:", admins);
  console.log("\n🎉 Database ready for a clean test cycle!");
}

clearTransactions()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Error clearing transactions:", e);
    process.exit(1);
  });
