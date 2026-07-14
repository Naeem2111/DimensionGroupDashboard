/**
 * Restore planner / Kanban data from a Neon point-in-time branch into the live DB.
 *
 * 1. Neon Console → Branches → Create branch → Point in time (before the wipe).
 * 2. Set RESTORE_DATABASE_URL to that branch; keep DATABASE_URL as production.
 * 3. Run:
 *      node scripts/restore-planner-from-neon-pitr.mjs --confirm
 *      node scripts/restore-planner-from-neon-pitr.mjs --confirm --owner=jethro@blocharch.com
 */
import { PrismaClient } from "@prisma/client";

const restoreUrl = process.env.RESTORE_DATABASE_URL;
const liveUrl = process.env.DATABASE_URL;

if (!restoreUrl || !liveUrl) {
  console.error("Set RESTORE_DATABASE_URL (PITR branch) and DATABASE_URL (live).");
  process.exit(1);
}

const restoreDb = new PrismaClient({ datasources: { db: { url: restoreUrl } } });
const liveDb = new PrismaClient({ datasources: { db: { url: liveUrl } } });

function ownerArg() {
  const raw = process.argv.find((a) => a.startsWith("--owner="));
  return raw ? raw.slice("--owner=".length).trim().toLowerCase() : null;
}

async function loadUsernamesById(db) {
  const users = await db.user.findMany({ select: { id: true, username: true } });
  return new Map(users.map((u) => [u.id, u.username.toLowerCase()]));
}

function userExistsOnLive(userId, restoreNames, liveNames) {
  const name = restoreNames.get(userId);
  return name ? liveNames.has(name) : false;
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("Refusing without --confirm");
    console.error("Example: node scripts/restore-planner-from-neon-pitr.mjs --confirm --owner=jethro@blocharch.com");
    process.exit(1);
  }

  const ownerUsername = ownerArg();
  const [restoreNames, liveNames] = await Promise.all([
    loadUsernamesById(restoreDb),
    loadUsernamesById(liveDb),
  ]);

  let restoreOwnerId = null;
  if (ownerUsername) {
    for (const [id, name] of restoreNames) {
      if (name === ownerUsername) {
        restoreOwnerId = id;
        break;
      }
    }
    if (!restoreOwnerId || !liveNames.has(ownerUsername)) {
      console.error(`User ${ownerUsername} must exist on both restore branch and live DB.`);
      process.exit(1);
    }
    console.log(`Restoring planner data for ${ownerUsername} only.`);
  }

  const sourceBoards = await restoreDb.plannerBoard.findMany({
    where: restoreOwnerId ? { ownerId: restoreOwnerId } : {},
    orderBy: { createdAt: "asc" },
  });

  if (sourceBoards.length === 0) {
    console.error("No planner boards on restore branch for this filter.");
    process.exit(1);
  }

  const liveAthleteIds = new Set(
    (await liveDb.opsAthlete.findMany({ select: { id: true } })).map((a) => a.id)
  );
  const liveProjectIds = new Set(
    (await liveDb.opsProject.findMany({ select: { id: true } })).map((p) => p.id)
  );

  const boardsToCopy = [];
  for (const b of sourceBoards) {
    if (!userExistsOnLive(b.ownerId, restoreNames, liveNames)) {
      console.log(`  skip "${b.title}" — owner not on live`);
      continue;
    }
    if (b.athleteId && !liveAthleteIds.has(b.athleteId)) {
      console.log(`  skip "${b.title}" — athlete missing on live`);
      continue;
    }
    if (b.opsProjectId && !liveProjectIds.has(b.opsProjectId)) {
      console.log(`  skip "${b.title}" — project missing on live`);
      continue;
    }
    boardsToCopy.push(b);
  }

  if (boardsToCopy.length === 0) {
    console.error("No boards eligible after FK checks.");
    process.exit(1);
  }

  const boardIds = boardsToCopy.map((b) => b.id);
  console.log(`Restoring ${boardsToCopy.length} board(s):`);
  for (const b of boardsToCopy) console.log(`  - ${b.title} (${b.kind})`);

  const [columns, labels, members, tasks, taskLabels, todos] = await Promise.all([
    restoreDb.plannerColumn.findMany({ where: { boardId: { in: boardIds } } }),
    restoreDb.plannerLabel.findMany({ where: { boardId: { in: boardIds } } }),
    restoreDb.plannerBoardMember.findMany({ where: { boardId: { in: boardIds } } }),
    restoreDb.plannerTask.findMany({ where: { column: { boardId: { in: boardIds } } } }),
    restoreDb.plannerTaskLabel.findMany({
      where: { task: { column: { boardId: { in: boardIds } } } },
    }),
    restoreDb.plannerTodoItem.findMany({
      where: { task: { column: { boardId: { in: boardIds } } } },
    }),
  ]);

  const taskIds = new Set(tasks.map((t) => t.id));
  const liveUserIds = new Set(
    (await liveDb.user.findMany({ select: { id: true } })).map((u) => u.id)
  );

  console.log(`Source: ${tasks.length} tasks, ${columns.length} columns`);

  console.log("\nClearing live planner + outbox queue…");
  await liveDb.plannerTodoItem.deleteMany();
  await liveDb.plannerTaskLabel.deleteMany();
  await liveDb.plannerTask.deleteMany();
  await liveDb.plannerColumn.deleteMany();
  await liveDb.plannerLabel.deleteMany();
  await liveDb.plannerBoardMember.deleteMany();
  await liveDb.opsOutboxTask.deleteMany();
  await liveDb.plannerBoard.deleteMany();

  await liveDb.plannerBoard.createMany({
    data: boardsToCopy.map((b) => ({
      id: b.id,
      title: b.title,
      scope: b.scope,
      kind: b.kind,
      color: b.color,
      ownerId: b.ownerId,
      athleteId: b.athleteId,
      opsProjectId: b.opsProjectId,
      isSystem: b.isSystem,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    })),
  });

  const memberRows = members
    .filter((m) => userExistsOnLive(m.userId, restoreNames, liveNames))
    .map((m) => ({ id: m.id, boardId: m.boardId, userId: m.userId, role: m.role }));
  if (memberRows.length) await liveDb.plannerBoardMember.createMany({ data: memberRows });

  if (columns.length) {
    await liveDb.plannerColumn.createMany({
      data: columns.map((c) => ({
        id: c.id,
        boardId: c.boardId,
        title: c.title,
        color: c.color,
        sortOrder: c.sortOrder,
      })),
    });
  }

  if (labels.length) {
    await liveDb.plannerLabel.createMany({
      data: labels.map((l) => ({
        id: l.id,
        boardId: l.boardId,
        name: l.name,
        color: l.color,
      })),
    });
  }

  if (tasks.length) {
    await liveDb.plannerTask.createMany({
      data: tasks.map((t) => ({
        id: t.id,
        columnId: t.columnId,
        title: t.title,
        summary: t.summary,
        description: t.description,
        sortOrder: t.sortOrder,
        assigneeId: t.assigneeId && liveUserIds.has(t.assigneeId) ? t.assigneeId : null,
        dueAt: t.dueAt,
        architectUrl: t.architectUrl,
        customFields: t.customFields ?? undefined,
        linkedFromTaskId:
          t.linkedFromTaskId && taskIds.has(t.linkedFromTaskId) ? t.linkedFromTaskId : null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  }

  if (taskLabels.length) {
    await liveDb.plannerTaskLabel.createMany({
      data: taskLabels.map((tl) => ({ taskId: tl.taskId, labelId: tl.labelId })),
    });
  }

  const todoRows = todos
    .filter((todo) => userExistsOnLive(todo.userId, restoreNames, liveNames))
    .map((todo) => ({
      id: todo.id,
      userId: todo.userId,
      taskId: todo.taskId,
      sortOrder: todo.sortOrder,
      completed: todo.completed,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
    }));
  if (todoRows.length) await liveDb.plannerTodoItem.createMany({ data: todoRows });

  const [afterBoards, afterTasks] = await Promise.all([
    liveDb.plannerBoard.count(),
    liveDb.plannerTask.count(),
  ]);
  console.log(`\nDone. Live: ${afterBoards} board(s), ${afterTasks} task(s). Refresh Project planner.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await restoreDb.$disconnect();
    await liveDb.$disconnect();
  });
