import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const users = await prisma.user.findMany({ select: { id: true, username: true, role: true } });
  const boards = await prisma.plannerBoard.findMany({
    select: { id: true, title: true, kind: true, scope: true, owner: { select: { username: true } }, _count: { select: { columns: true } } },
    orderBy: { title: "asc" },
  });
  const taskCount = await prisma.plannerTask.count();
  console.log("users", users);
  console.log("boards", boards.length);
  for (const b of boards) {
    console.log(`  - ${b.title} (${b.kind}, ${b.scope}) owner=${b.owner.username} cols=${b._count.columns}`);
  }
  console.log("tasks", taskCount);
} finally {
  await prisma.$disconnect();
}
