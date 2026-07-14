import { PrismaClient } from "@prisma/client";

const username = process.argv[2];
if (!username) {
  console.error("Usage: node scripts/promote-user-admin.mjs <username>");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const user = await prisma.user.update({
    where: { username: username.trim().toLowerCase() },
    data: { role: "admin" },
    select: { username: true, role: true, disabled: true },
  });
  console.log("Updated:", user);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
