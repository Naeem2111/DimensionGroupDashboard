import type { UserRole } from "@/lib/user-role";

/** Feature areas within the single Dimension Group console domain. */
export type AppModule = "marketing" | "planner" | "admin" | "ops" | "athlete_portal";

const MODULE_ROLES: Record<AppModule, readonly UserRole[]> = {
  /** Lead directory, map, outreach — internal Dimension Group staff only. */
  marketing: ["admin", "manager"],
  /** Kanban / project boards — all signed-in users. */
  planner: ["admin", "manager", "user"],
  /** User management and system settings. */
  admin: ["admin"],
  /** Athlete operations admin — clients, commercial, project tracker (/dashboard/ops). */
  ops: ["admin"],
  /** Athlete-facing workspace — dashboard, submissions, my projects (/dashboard/athlete). */
  athlete_portal: ["admin", "user"],
};

export function canAccessModule(role: UserRole, module: AppModule): boolean {
  return MODULE_ROLES[module].includes(role);
}

/** Ops overview + athlete performance (managers) vs full ops console (admin). */
export function canAccessOpsOverview(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canAccessOpsDashboardPath(role: UserRole, path: string): boolean {
  if (role === "admin" && canAccessModule(role, "ops")) return true;
  if (role === "manager") return path === "/dashboard/ops";
  return false;
}

export function canAccessOpsApiPath(role: UserRole, path: string): boolean {
  const normalized = path.split("?")[0] ?? path;
  if (role === "admin" && canAccessModule(role, "ops")) return true;
  if (role === "manager") return normalized === "/api/ops/overview";
  return false;
}

/** First screen after login for each role. */
export function defaultDashboardPath(role: UserRole): string {
  if (canAccessModule(role, "marketing")) return "/dashboard";
  if (canAccessModule(role, "admin")) return "/dashboard/admin/users";
  return "/login?error=forbidden";
}

export function isMarketingDashboardPath(path: string): boolean {
  if (path === "/dashboard") return true;
  if (path.startsWith("/dashboard/practices")) return true;
  if (path.startsWith("/dashboard/map")) return true;
  if (path.startsWith("/dashboard/automation")) return true;
  if (path.startsWith("/dashboard/marketing")) return true;
  return false;
}

export function isMarketingApiPath(path: string): boolean {
  if (path.startsWith("/api/practices")) return true;
  if (path === "/api/stats") return true;
  if (path.startsWith("/api/leads")) return true;
  if (path.startsWith("/api/marketing")) return true;
  if (path.startsWith("/api/workflow")) return true;
  if (path === "/api/templates") return true;
  if (path.startsWith("/api/geocode")) return true;
  return false;
}

export function isAdminDashboardPath(path: string): boolean {
  return path.startsWith("/dashboard/admin");
}

export function isAdminApiPath(path: string): boolean {
  return path.startsWith("/api/admin/");
}

export function isOpsDashboardPath(path: string): boolean {
  return path === "/dashboard/ops" || path.startsWith("/dashboard/ops/");
}

export function isOpsApiPath(path: string): boolean {
  return path.startsWith("/api/ops/");
}

export function isAthleteDashboardPath(path: string): boolean {
  return path === "/dashboard/athlete" || path.startsWith("/dashboard/athlete/");
}

export function isAthleteApiPath(path: string): boolean {
  return path.startsWith("/api/athlete/");
}
