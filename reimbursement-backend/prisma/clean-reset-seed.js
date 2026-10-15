const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Clearing all existing data from ClaimNest database...");

  // Delete in dependency order
  await prisma.activityLog.deleteMany({});
  await prisma.reimbursementApproval.deleteMany({});
  await prisma.reimbursementBill.deleteMany({});
  await prisma.bill.deleteMany({});
  await prisma.reimbursement.deleteMany({});
  await prisma.bufferTransaction.deleteMany({});
  await prisma.treasurerBuffer.deleteMany({});
  await prisma.clubBudget.deleteMany({});
  await prisma.projectionItem.deleteMany({});
  await prisma.monthlyProjection.deleteMany({});
  await prisma.projectionWindow.deleteMany({});
  await prisma.clubMentorMapping.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.administrator.deleteMany({});
  await prisma.position.deleteMany({});

  console.log("✅ Database cleared successfully!");
  console.log("🌱 Seeding fresh required accounts & allocations...");

  const defaultPassword = "Password123";
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  // 1. Treasurer (Super Admin)
  const treasurerEmail = "treasurer@reimbursement.com";
  const treasurer = await prisma.administrator.create({
    data: {
      name: "SBG Treasurer",
      email: treasurerEmail,
      password: hashedPassword,
      role: "SUPER_ADMIN",
    },
  });
  console.log(`✅ Treasurer (Super Admin): ${treasurerEmail}`);

  // 2. Faculty Mentor mapped to Music Club
  const profX = await prisma.administrator.create({
    data: {
      name: "Prof. X (Music Faculty Mentor)",
      email: "profx@reimbursement.com",
      password: hashedPassword,
      role: "FACULTY_MENTOR",
    },
  });
  console.log(`✅ Faculty Mentor (Prof X): profx@reimbursement.com`);

  // 3. Dean Students
  const dean = await prisma.administrator.create({
    data: {
      name: "Dean of Student Affairs",
      email: "dean@reimbursement.com",
      password: hashedPassword,
      role: "DEAN_STUDENTS",
    },
  });
  console.log(`✅ Dean Students: dean@reimbursement.com`);

  // 4. Central University Accountant
  const accountant = await prisma.administrator.create({
    data: {
      name: "Central University Accountant",
      email: "accountant@reimbursement.com",
      password: hashedPassword,
      role: "ACCOUNTANT",
    },
  });
  console.log(`✅ Accountant: accountant@reimbursement.com`);

  // 5. Club-to-Faculty Mentor Mapping for Music Club
  await prisma.clubMentorMapping.create({
    data: {
      clubName: "Music Club",
      facultyMentorId: profX.id,
    },
  });
  console.log(`✅ Mapped "Music Club" -> Prof. X`);

  // 6. Music Club Convenor (User)
  const convenor = await prisma.user.create({
    data: {
      name: "Aman Sharma",
      email: "music.convenor@reimbursement.com",
      password: hashedPassword,
      designation: "CONVENOR",
      clubName: "Music Club",
    },
  });
  console.log(`✅ Music Club Convenor: music.convenor@reimbursement.com`);

  // 7. Initialize Current Month's Treasurer Buffer (₹50,000)
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const buffer = await prisma.treasurerBuffer.create({
    data: {
      monthlyAdvance: 50000.0,
      currentBalance: 50000.0,
      currentMonth,
      transactions: {
        create: {
          type: "MONTHLY_REPLENISHMENT",
          amount: 50000.0,
          balanceAfter: 50000.0,
          notes: `Initial monthly advance buffer for ${currentMonth}`,
        },
      },
    },
  });
  console.log(`✅ Treasurer Monthly Buffer seeded: ₹50,000 for ${currentMonth}`);

  // 8. Sanctioned Music Club Budget (₹100,000) for Current Month
  const budget = await prisma.clubBudget.create({
    data: {
      clubName: "Music Club",
      targetMonth: currentMonth,
      allocatedAmount: 100000.0,
      spentAmount: 0.0,
      notes: `Sanctioned operational & event budget for ${currentMonth}`,
    },
  });
  console.log(`✅ Music Club Budget seeded: ₹100,000 for ${currentMonth}`);

  // 9. Active Projection Window for Next Month
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const targetMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const deadline = new Date(now.getFullYear(), now.getMonth(), 28, 23, 59, 59);

  await prisma.projectionWindow.create({
    data: {
      targetMonth,
      deadline,
      instructions: `Please submit itemized event expense projections for ${targetMonth} before the deadline.`,
      isActive: true,
    },
  });
  console.log(`✅ Active Projection Window seeded for ${targetMonth}`);

  console.log("\n🎉 Complete clean database setup finished successfully!");
  console.log("All accounts password: Password123\n");
}

main()
  .catch((e) => {
    console.error("Error during reset & seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
