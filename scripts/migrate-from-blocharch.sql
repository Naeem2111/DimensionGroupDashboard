-- Run once if migrating from a Blocharch-origin database.
-- Renames legacy enum values and column names to Dimension Group naming.

ALTER TYPE "PlannerBoardKind" RENAME VALUE 'blocharch_outbox' TO 'system_outbox';
ALTER TYPE "PlannerBoardKind" RENAME VALUE 'blocharch_inbox' TO 'system_inbox';

ALTER TABLE "ops_athletes" RENAME COLUMN "blocharch_start_date" TO "member_start_date";
