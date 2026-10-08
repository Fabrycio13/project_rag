function firstHeaderValue(value: string | null): string | null {
  const firstValue = value?.split(",", 1)[0]?.trim();
  return firstValue || null;
}

export function isSameOriginRequest(
  originHeader: string | null,
  hostHeader: string | null,
  forwardedHostHeader: string | null,
  forwardedProtocolHeader: string | null,
  requestUrl: string,
): boolean {
  if (!originHeader) return false;

  try {
    const origin = new URL(originHeader);
    const expectedHost = firstHeaderValue(forwardedHostHeader) ?? hostHeader;
    const expectedProtocol = firstHeaderValue(forwardedProtocolHeader);
    const requestProtocol = new URL(requestUrl).protocol;
    const protocol = expectedProtocol
      ? expectedProtocol.endsWith(":")
        ? expectedProtocol
        : `${expectedProtocol}:`
      : requestProtocol;

    return Boolean(
      expectedHost &&
        origin.host.toLowerCase() === expectedHost.toLowerCase() &&
        origin.protocol === protocol,
    );
  } catch {
    return false;
  }
}
