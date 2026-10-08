export function getAdminInvitationSignUpUrl(
  appBaseUrl: string | undefined,
  allowLocalDevelopment = false,
): string | null {
  if (!appBaseUrl?.trim()) return null;

  try {
    const appUrl = new URL(appBaseUrl);
    const hostname = appUrl.hostname.toLowerCase();
    const isLocalHost =
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname === "0.0.0.0";
    const isAllowedLocalDevelopment =
      allowLocalDevelopment && isLocalHost && appUrl.protocol === "http:";

    if (
      (!isAllowedLocalDevelopment && appUrl.protocol !== "https:") ||
      (isLocalHost && !isAllowedLocalDevelopment) ||
      appUrl.username ||
      appUrl.password ||
      appUrl.pathname !== "/" ||
      appUrl.search ||
      appUrl.hash
    ) {
      return null;
    }

    return new URL("/sign-up", appUrl.origin).toString();
  } catch {
    return null;
  }
}
