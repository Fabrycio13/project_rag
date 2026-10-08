export function getPlatformUserCheckState(
  user: { readonly status: string } | null,
): "active" | "inactive" | "missing" {
  if (user === null) {
    return "missing";
  }

  return user.status === "active" ? "active" : "inactive";
}
