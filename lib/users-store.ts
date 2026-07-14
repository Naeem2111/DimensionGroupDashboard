import { randomUUID } from "crypto";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { DEFAULT_THEME, normalizeTheme, type ThemePreference } from "@/lib/theme";

export type UserRole = "admin" | "manager" | "user";

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  disabled?: boolean;
  theme: ThemePreference;
  createdAt: string;
}

function defaultBootstrapCreds(): { username: string; password: string } {
  const username = (
    process.env.DG_ADMIN_USERNAME ||
    process.env.BLOCHARCH_ADMIN_USERNAME ||
    "admin"
  )
    .trim()
    .toLowerCase();
  const password = (
    process.env.DG_ADMIN_PASSWORD ||
    process.env.BLOCHARCH_ADMIN_PASSWORD ||
    "changeme"
  ).trim();
  return { username, password };
}

function bootstrapIfEmpty(): UserRecord {
  const { username, password } = defaultBootstrapCreds();
  const now = new Date().toISOString();
  const admin: UserRecord = {
    id: randomUUID(),
    username,
    passwordHash: hashPassword(password),
    role: "admin",
    theme: DEFAULT_THEME,
    createdAt: now,
  };
  return admin;
}

async function ensureBootstrapAdmin(): Promise<void> {
  const userCount = await prisma.user.count();
  if (userCount > 0) return;
  const admin = bootstrapIfEmpty();
  await prisma.user.create({
    data: {
      id: admin.id,
      username: admin.username,
      passwordHash: admin.passwordHash,
      role: admin.role,
      disabled: false,
      createdAt: new Date(admin.createdAt),
    },
  });
}

function toUserRecord(row: {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  disabled: boolean;
  theme?: string | null;
  createdAt: Date;
}): UserRecord {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    role: row.role as UserRole,
    disabled: row.disabled,
    theme: normalizeTheme(row.theme),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  const u = normalizeUsername(username);
  await ensureBootstrapAdmin();
  const row = await prisma.user.findUnique({ where: { username: u } });
  return row ? toUserRecord(row) : null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  await ensureBootstrapAdmin();
  const row = await prisma.user.findUnique({ where: { id } });
  return row ? toUserRecord(row) : null;
}

export async function listUsersPublic(): Promise<Omit<UserRecord, "passwordHash">[]> {
  await ensureBootstrapAdmin();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return users.map(({ passwordHash: _, ...rest }) => ({
    id: rest.id,
    username: rest.username,
    role: rest.role as UserRole,
    disabled: rest.disabled,
    theme: normalizeTheme(rest.theme),
    createdAt: rest.createdAt.toISOString(),
  }));
}

export async function countAdmins(): Promise<number> {
  await ensureBootstrapAdmin();
  return prisma.user.count({ where: { role: "admin", disabled: false } });
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function createUser(input: {
  username: string;
  password: string;
  role: UserRole;
  disabled?: boolean;
}): Promise<{ ok: true; user: Omit<UserRecord, "passwordHash"> } | { ok: false; error: string }> {
  const username = normalizeUsername(input.username);
  if (username.length < 2 || username.length > 64) {
    return { ok: false, error: "Username must be 2–64 characters" };
  }
  if (!/^[a-z0-9_@.-]+$/.test(username)) {
    return { ok: false, error: "Username may only contain letters, digits, _ @ . -" };
  }
  if (input.password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters" };
  }
  await ensureBootstrapAdmin();
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    return { ok: false, error: "Username already exists" };
  }
  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      username,
      passwordHash: hashPassword(input.password),
      role: input.role,
      disabled: input.disabled ?? false,
    },
  });
  const { passwordHash: _, ...pub } = toUserRecord(user);
  return { ok: true, user: pub };
}

export async function updateUser(
  id: string,
  patch: { password?: string; role?: UserRole; disabled?: boolean },
  actorId: string
): Promise<{ ok: true; user: Omit<UserRecord, "passwordHash"> } | { ok: false; error: string }> {
  await ensureBootstrapAdmin();
  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) return { ok: false, error: "User not found" };

  if (patch.password !== undefined && patch.password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters" };
  }

  if (patch.role !== undefined && patch.role !== current.role) {
    if (current.role === "admin" && patch.role !== "admin") {
      const otherActiveAdmins = await prisma.user.count({
        where: { role: "admin", disabled: false, id: { not: current.id } },
      });
      if (otherActiveAdmins === 0) {
        return { ok: false, error: "Cannot demote the last admin" };
      }
    }
  }

  if (patch.disabled !== undefined && patch.disabled !== !!current.disabled) {
    if (current.id === actorId && patch.disabled) {
      return { ok: false, error: "You cannot disable your own account" };
    }
    if (current.role === "admin" && patch.disabled) {
      const otherActiveAdmins = await prisma.user.count({
        where: { role: "admin", disabled: false, id: { not: current.id } },
      });
      if (otherActiveAdmins === 0) {
        return { ok: false, error: "Cannot disable the only active admin" };
      }
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(patch.password !== undefined ? { passwordHash: hashPassword(patch.password) } : {}),
      ...(patch.role !== undefined ? { role: patch.role } : {}),
      ...(patch.disabled !== undefined ? { disabled: patch.disabled } : {}),
    },
  });
  const { passwordHash: _, ...pub } = toUserRecord(updated);
  return { ok: true, user: pub };
}

export async function updateUserPreferences(
  id: string,
  patch: { theme?: ThemePreference }
): Promise<{ ok: true; user: Omit<UserRecord, "passwordHash"> } | { ok: false; error: string }> {
  await ensureBootstrapAdmin();
  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) return { ok: false, error: "User not found" };

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(patch.theme !== undefined ? { theme: patch.theme } : {}),
    },
  });
  const { passwordHash: _, ...pub } = toUserRecord(updated);
  return { ok: true, user: pub };
}

export async function deleteUser(
  id: string,
  actorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (id === actorId) {
    return { ok: false, error: "You cannot delete your own account" };
  }
  await ensureBootstrapAdmin();
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { ok: false, error: "User not found" };
  if (target.role === "admin" && !target.disabled) {
    const otherAdmins = await prisma.user.count({
      where: { role: "admin", disabled: false, id: { not: id } },
    });
    if (otherAdmins === 0) {
      return { ok: false, error: "Cannot delete the only active admin" };
    }
  }
  await prisma.user.delete({ where: { id } });
  return { ok: true };
}
