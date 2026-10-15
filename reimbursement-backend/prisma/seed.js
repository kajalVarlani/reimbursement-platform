const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding ClaimNest database...");

  const defaultPassword = "Password123";
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  // 1. Treasurer (Super Admin)
  const treasurerEmail = "treasurer@reimbursement.com";
  const treasurer = await prisma.administrator.upsert({
    where: { email: treasurerEmail },
    update: { role: "SUPER_ADMIN" },
    create: {
      name: "SBG Treasurer (Super Admin)",
      email: treasurerEmail,
      password: hashedPassword,
      role: "SUPER_ADMIN",
    },
  });
  console.log(`✅ Treasurer: ${treasurerEmail}`);

  // Backwards compatibility super admin
  await prisma.administrator.upsert({
    where: { email: "superadmin@reimbursement.com" },
    update: { role: "SUPER_ADMIN" },
    create: {
      name: "Super Admin",
      email: "superadmin@reimbursement.com",
      password: hashedPassword,
      role: "SUPER_ADMIN",
    },
  });

  // 2. Faculty Mentors (Prof X and Prof Y)
  const profX = await prisma.administrator.upsert({
    where: { email: "profx@reimbursement.com" },
    update: { role: "FACULTY_MENTOR" },
    create: {
      name: "Prof. X (Music & Cultural Mentor)",
      email: "profx@reimbursement.com",
      password: hashedPassword,
      role: "FACULTY_MENTOR",
    },
  });
  console.log(`✅ Faculty Mentor (Prof X): profx@reimbursement.com`);

  const profY = await prisma.administrator.upsert({
    where: { email: "profy@reimbursement.com" },
    update: { role: "FACULTY_MENTOR" },
    create: {
      name: "Prof. Y (Sports & Chess Mentor)",
      email: "profy@reimbursement.com",
      password: hashedPassword,
      role: "FACULTY_MENTOR",
    },
  });
  console.log(`✅ Faculty Mentor (Prof Y): profy@reimbursement.com`);

  // 3. Dean Students
  const dean = await prisma.administrator.upsert({
    where: { email: "dean@reimbursement.com" },
    update: { role: "DEAN_STUDENTS" },
    create: {
      name: "Dean of Student Affairs",
      email: "dean@reimbursement.com",
      password: hashedPassword,
      role: "DEAN_STUDENTS",
    },
  });
  console.log(`✅ Dean Students: dean@reimbursement.com`);

  // 4. Accountant
  const accountant = await prisma.administrator.upsert({
    where: { email: "accountant@reimbursement.com" },
    update: { role: "ACCOUNTANT" },
    create: {
      name: "Central University Accountant",
      email: "accountant@reimbursement.com",
      password: hashedPassword,
      role: "ACCOUNTANT",
    },
  });
  console.log(`✅ Accountant: accountant@reimbursement.com`);

  // 5. Club-Mentor Mappings
  await prisma.clubMentorMapping.upsert({
    where: { clubName: "Music Club" },
    update: { facultyMentorId: profX.id },
    create: {
      clubName: "Music Club",
      facultyMentorId: profX.id,
    },
  });

  await prisma.clubMentorMapping.upsert({
    where: { clubName: "Chess Club" },
    update: { facultyMentorId: profY.id },
    create: {
      clubName: "Chess Club",
      facultyMentorId: profY.id,
    },
  });

  await prisma.clubMentorMapping.upsert({
    where: { clubName: "Cultural Committee" },
    update: { facultyMentorId: profX.id },
    create: {
      clubName: "Cultural Committee",
      facultyMentorId: profX.id,
    },
  });
  console.log(`✅ Club-to-Faculty Mappings seeded.`);

  // 6. Users (1 C and 1 DC per Club)
  await prisma.user.upsert({
    where: { email: "music.convenor@reimbursement.com" },
    update: { clubName: "Music Club", designation: "CONVENOR" },
    create: {
      name: "Aman Sharma",
      email: "music.convenor@reimbursement.com",
      password: hashedPassword,
      designation: "CONVENOR",
      clubName: "Music Club",
    },
  });

  await prisma.user.upsert({
    where: { email: "music.dc@reimbursement.com" },
    update: { clubName: "Music Club", designation: "DEPUTY_CONVENOR" },
    create: {
      name: "Riya Verma",
      email: "music.dc@reimbursement.com",
      password: hashedPassword,
      designation: "DEPUTY_CONVENOR",
      clubName: "Music Club",
    },
  });

  await prisma.user.upsert({
    where: { email: "chess.convenor@reimbursement.com" },
    update: { clubName: "Chess Club", designation: "CONVENOR" },
    create: {
      name: "Kabir Mehta",
      email: "chess.convenor@reimbursement.com",
      password: hashedPassword,
      designation: "CONVENOR",
      clubName: "Chess Club",
    },
  });
  console.log(`✅ Convenors and Deputy Convenors seeded.`);

  // 7. Initialize Current Month's Treasurer Buffer (₹50,000)
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const existingBuffer = await prisma.treasurerBuffer.findFirst({
    where: { currentMonth },
  });

  if (!existingBuffer) {
    await prisma.treasurerBuffer.create({
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
    console.log(`✅ Treasurer Monthly Buffer seeded (₹50,000 for ${currentMonth}).`);
  }

  // 8. Active Projection Window for Next Month
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const targetMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const deadline = new Date(now.getFullYear(), now.getMonth(), 28, 23, 59, 59);

  await prisma.projectionWindow.upsert({
    where: { targetMonth },
    update: { deadline, isActive: true },
    create: {
      targetMonth,
      deadline,
      instructions: `Please submit your itemized event expense projections for ${targetMonth} before the deadline so the Treasurer can obtain the monthly advance buffer.`,
      isActive: true,
    },
  });
  // 9. Initial Club Budgets for Current Month
  await prisma.clubBudget.upsert({
    where: {
      clubName_targetMonth: {
        clubName: "Music Club",
        targetMonth: currentMonth,
      },
    },
    update: {},
    create: {
      clubName: "Music Club",
      targetMonth: currentMonth,
      allocatedAmount: 25000.0,
      spentAmount: 0.0,
      notes: `Sanctioned monthly operational budget for ${currentMonth}`,
    },
  });

  await prisma.clubBudget.upsert({
    where: {
      clubName_targetMonth: {
        clubName: "Chess Club",
        targetMonth: currentMonth,
      },
    },
    update: {},
    create: {
      clubName: "Chess Club",
      targetMonth: currentMonth,
      allocatedAmount: 15000.0,
      spentAmount: 0.0,
      notes: `Sanctioned monthly tournament budget for ${currentMonth}`,
    },
  });
  console.log(`✅ Initial Club Budgets seeded for Music Club & Chess Club.`);

  console.log("\n🎉 Database seeding completed successfully!");
  console.log("All accounts use password: Password123");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
