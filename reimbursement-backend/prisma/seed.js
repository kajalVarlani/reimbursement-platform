const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const superAdminEmail = "superadmin@reimbursement.com";
  const superAdminPassword = "superadmin123";

  // Check if super admin already exists
  const existingSuperAdmin = await prisma.administrator.findUnique({
    where: { email: superAdminEmail },
  });

  if (!existingSuperAdmin) {
    const hashedPassword = await bcrypt.hash(superAdminPassword, 10);
    const superAdmin = await prisma.administrator.create({
      data: {
        name: "Super Admin",
        email: superAdminEmail,
        password: hashedPassword,
        role: "SUPER_ADMIN",
      },
    });
    console.log(`✅ Super Admin bootstrapped successfully.`);
    console.log(`Email: ${superAdminEmail}`);
    console.log(`Password: ${superAdminPassword}`);
  } else {
    console.log(`ℹ️ Super Admin already exists (${superAdminEmail}). Skipping creation.`);
  }

  // Optionally bootstrap a default position (e.g. Level 1 Reviewer) if none exists
  const existingPositions = await prisma.position.findMany();
  if (existingPositions.length === 0) {
    const defaultPosition = await prisma.position.create({
      data: {
        name: "Finance Executive",
        priority: 1,
      },
    });
    console.log(`✅ Default Level 1 Position bootstrapped: ${defaultPosition.name}`);
  }

  console.log("Database seeding completed.");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
