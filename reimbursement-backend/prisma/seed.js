const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Seed default Positions
  const positions = [
    { name: "Finance Officer", priority: 1 },
    { name: "Finance Head", priority: 2 },
    { name: "Director", priority: 3 },
  ];

  const seededPositions = {};
  for (const pos of positions) {
    const p = await prisma.position.upsert({
      where: { name: pos.name },
      update: { priority: pos.priority },
      create: { name: pos.name, priority: pos.priority },
    });
    seededPositions[pos.priority] = p;
    console.log(`Seeded position: ${p.name} with priority ${p.priority}`);
  }

  // 2. Clear old transactions
  await prisma.reimbursementApproval.deleteMany();
  await prisma.reimbursement.deleteMany();

  // 3. Clear old administrators except SUPER_ADMIN
  await prisma.administrator.deleteMany({
    where: {
      role: { not: "SUPER_ADMIN" },
    },
  });

  // 4. Seed SUPER_ADMIN
  const superAdminEmail = "superadmin@reimbursement.com";
  const superAdminPassword = await bcrypt.hash("SuperAdminPassword123", 10);
  const superAdmin = await prisma.administrator.upsert({
    where: { email: superAdminEmail },
    update: { password: superAdminPassword },
    create: {
      name: "System Super Admin",
      email: superAdminEmail,
      password: superAdminPassword,
      role: "SUPER_ADMIN",
    },
  });
  console.log(`Seeded SUPER_ADMIN: ${superAdmin.email}`);

  // Seed default User (Treasurer)
  const userEmail = "user@reimbursement.com";
  const userPassword = await bcrypt.hash("Password123", 10);
  const user = await prisma.user.upsert({
    where: { email: userEmail },
    update: { password: userPassword },
    create: {
      name: "Test Treasurer",
      email: userEmail,
      password: userPassword,
    },
  });
  console.log(`Seeded user: ${user.email}`);

  // 5. Seed target administrators with password "Password123"
  const defaultPassword = await bcrypt.hash("Password123", 10);

  const adminsToCreate = [
    // Level 1: Alice, Bob
    {
      name: "Alice Finance",
      email: "202512017@dau.ac.in",
      role: "ADMINISTRATOR",
      positionId: seededPositions[1].id,
    },
    {
      name: "Bob Finance",
      email: "bob@reimbursement.com",
      role: "ADMINISTRATOR",
      positionId: seededPositions[1].id,
    },
    // Level 2: Chloe
    {
      name: "Chloe Head",
      email: "chloe@reimbursement.com",
      role: "ADMINISTRATOR",
      positionId: seededPositions[2].id,
    },
    // Level 3: Den
    {
      name: "Den Director",
      email: "den@reimbursement.com",
      role: "ADMINISTRATOR",
      positionId: seededPositions[3].id,
    },
  ];

  for (const adm of adminsToCreate) {
    const created = await prisma.administrator.create({
      data: {
        name: adm.name,
        email: adm.email,
        password: defaultPassword,
        role: adm.role,
        positionId: adm.positionId,
      },
    });
    console.log(`Seeded administrator: ${created.name} (${created.email}) at level ${adm.positionId === seededPositions[1].id ? 1 : adm.positionId === seededPositions[2].id ? 2 : 3}`);
  }

  console.log("Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
