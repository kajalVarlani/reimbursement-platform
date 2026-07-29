const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const email = "kajalamitvarlani@gmail.com";
  const plainPassword = "Password123";
  const name = "Super Admin";

  // Check if already exists
  const existing = await prisma.administrator.findUnique({
    where: { email },
  });

  if (existing) {
    console.log(`⚠️  Administrator with email ${email} already exists. Aborting.`);
    return;
  }

  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const admin = await prisma.administrator.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: "SUPER_ADMIN",
      positionId: null, // positionId is optional in your schema
    },
  });

  console.log(`✅ Super Admin created successfully!`);
  console.log(`   ID:       ${admin.id}`);
  console.log(`   Name:     ${admin.name}`);
  console.log(`   Email:    ${admin.email}`);
  console.log(`   Role:     ${admin.role}`);
  console.log(`   Password: ${plainPassword}  (stored as bcrypt hash)`);
}

main()
  .catch((e) => {
    console.error("❌ Error creating super admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
