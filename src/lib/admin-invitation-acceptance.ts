export function normalizeInvitationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidInvitationEmail(email: string): boolean {
  const normalizedEmail = normalizeInvitationEmail(email);
  return (
    normalizedEmail.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  );
}

export function isVerifiedInvitationEmailMatch(
  invitedEmail: string,
  accountEmail: string,
  verificationStatus: string | null | undefined,
): boolean {
  return (
    verificationStatus === "verified" &&
    normalizeInvitationEmail(invitedEmail) === normalizeInvitationEmail(accountEmail)
  );
}

export function getAdminInvitationReference(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const platformRole = Object.getOwnPropertyDescriptor(metadata, "platformRole")?.value;
  const invitationRef = Object.getOwnPropertyDescriptor(metadata, "invitationRef")?.value;

  if (
    platformRole !== "admin" ||
    typeof invitationRef !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      invitationRef,
    )
  ) {
    return null;
  }

  return invitationRef;
}
