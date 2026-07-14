import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
try {
  const projects = await prisma.opsProject.findMany({
    where: {
      OR: [
        { name: { contains: "Bishops", mode: "insensitive" } },
        { address: { contains: "Bishops", mode: "insensitive" } },
      ],
    },
    include: {
      client: {
        select: { id: true, name: true, slug: true, publicPortalEnabled: true, status: true },
      },
      assignedAthlete: { select: { fullName: true, athleteCode: true } },
      plannerBoards: { where: { kind: "project" }, select: { id: true } },
    },
  });
  console.log(JSON.stringify(projects, null, 2));
} finally {
  await prisma.$disconnect();
}
