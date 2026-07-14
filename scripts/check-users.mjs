import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, disabled: true, passwordHash: true },
    orderBy: { createdAt: "asc" },
  });
  console.log("user_count", users.length);
  for (const u of users) {
    const hashKind = u.passwordHash.startsWith("scrypt$")
      ? "scrypt"
      : u.passwordHash.length === 64
        ? "sha256?"
        : "other";
    console.log({ username: u.username, role: u.role, disabled: u.disabled, hashKind });
  }
} finally {
  await prisma.$disconnect();
}
