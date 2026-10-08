export function normalizeOrganizationName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  const length = Array.from(name).length;
  return length >= 1 && length <= 120 ? name : null;
}

export function canManageOrganizations(user: { role: string; status: string } | null): boolean {
  return user?.status === "active" && (user.role === "owner" || user.role === "admin");
}
