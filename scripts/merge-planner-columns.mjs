import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Inline merge — mirrors lib/planner-columns-seed.ts for one-off maintenance. */
const DEFAULT_COLUMNS = [
  { title: "General", sortOrder: 0, linkedLabelName: null },
  { title: "This Week", sortOrder: 1, linkedLabelName: "This Week" },
  { title: "Tomorrow", sortOrder: 2, linkedLabelName: "Tomorrow" },
  { title: "Urgent", sortOrder: 3, linkedLabelName: "Urgent" },
  { title: "Urgent Today", sortOrder: 4, linkedLabelName: "Urgent Today" },
  { title: "Waiting", sortOrder: 5, linkedLabelName: "Waiting" },
  { title: "Done", sortOrder: 6, linkedLabelName: null },
];

const GENERAL = /^(general|backlog|inbox|todo|to do)\b/i;

function mergeKey(col) {
  if (col.linkedLabelName) return `label:${col.linkedLabelName}`;
  const titleLower = col.title.trim().toLowerCase();
  if (GENERAL.test(col.title)) return "general";
  if (/^(done|completed)\b/i.test(col.title.trim())) return "done";
  const def = DEFAULT_COLUMNS.find((d) => d.title.toLowerCase() === titleLower);
  if (def?.linkedLabelName) return `label:${def.linkedLabelName}`;
  if (def?.title === "General") return "general";
  if (def?.title === "Done") return "done";
  return `title:${titleLower}`;
}

async function mergeBoard(boardId) {
  const columns = await prisma.plannerColumn.findMany({
    where: { boardId },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { tasks: true } } },
  });

  const groups = new Map();
  for (const col of columns) {
    const key = mergeKey(col);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(col);
  }

  let merged = 0;
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const keeper = [...group].sort((a, b) => {
      if (a.linkedLabelName && !b.linkedLabelName) return -1;
      if (!a.linkedLabelName && b.linkedLabelName) return 1;
      if (a._count.tasks !== b._count.tasks) return b._count.tasks - a._count.tasks;
      return a.sortOrder - b.sortOrder;
    })[0];

    for (const dup of group) {
      if (dup.id === keeper.id) continue;
      const tasks = await prisma.plannerTask.findMany({
        where: { columnId: dup.id },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });
      if (tasks.length) {
        const maxOrder = await prisma.plannerTask.aggregate({
          where: { columnId: keeper.id },
          _max: { sortOrder: true },
        });
        let next = (maxOrder._max.sortOrder ?? -1) + 1;
        for (const task of tasks) {
          await prisma.plannerTask.update({
            where: { id: task.id },
            data: { columnId: keeper.id, sortOrder: next++ },
          });
        }
      }
      await prisma.plannerColumn.delete({ where: { id: dup.id } });
      merged += 1;
    }
  }

  return merged;
}

const nameFilter = process.argv[2] ?? "";

try {
  const athletes = nameFilter
    ? await prisma.opsAthlete.findMany({
        where: {
          OR: [
            { fullName: { contains: nameFilter, mode: "insensitive" } },
            { user: { username: { contains: nameFilter, mode: "insensitive" } } },
          ],
        },
        select: { id: true, fullName: true, user: { select: { username: true } } },
      })
    : [];

  const boardWhere = nameFilter
    ? { athleteId: { in: athletes.map((a) => a.id) } }
    : {};

  const boards = await prisma.plannerBoard.findMany({
    where: boardWhere,
    select: {
      id: true,
      title: true,
      athlete: { select: { fullName: true } },
      columns: {
        orderBy: { sortOrder: "asc" },
        select: { title: true, linkedLabelName: true },
      },
    },
    orderBy: { title: "asc" },
  });

  console.log(`Boards to process: ${boards.length}${nameFilter ? ` (athlete ~${nameFilter})` : ""}`);
  if (nameFilter && athletes.length) {
    for (const a of athletes) {
      console.log(`  matched: ${a.fullName} (@${a.user.username})`);
    }
  }

  let totalMerged = 0;
  for (const board of boards) {
    const before = board.columns.map((c) => c.title).join(" | ");
    const merged = await mergeBoard(board.id);
    totalMerged += merged;
    const afterCols = await prisma.plannerColumn.findMany({
      where: { boardId: board.id },
      orderBy: { sortOrder: "asc" },
      select: { title: true },
    });
    const after = afterCols.map((c) => c.title).join(" | ");
    if (merged > 0 || before !== after) {
      console.log(`\n${board.athlete?.fullName ?? "?"} — ${board.title}`);
      console.log(`  before (${board.columns.length}): ${before}`);
      console.log(`  merged: ${merged}`);
      console.log(`  after  (${afterCols.length}): ${after}`);
    }
  }

  console.log(`\nTotal duplicate columns removed: ${totalMerged}`);
} finally {
  await prisma.$disconnect();
}
