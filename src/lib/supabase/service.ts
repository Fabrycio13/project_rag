import "server-only";

import { createClient } from "@supabase/supabase-js";

type ConfigurationReason = "missing_url" | "invalid_url" | "missing_private_key" | "invalid_private_key" | "client_initialization_failed";

export class SupabaseServiceConfigurationError extends Error {
  constructor(readonly reason: ConfigurationReason) {
    // Never retain provider exceptions, environment values or token contents.
    super("Privileged Supabase client unavailable.");
    this.name = "SupabaseServiceConfigurationError";
  }
}

export function createServiceRoleSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl) throw new SupabaseServiceConfigurationError("missing_url");
  try {
    const url = new URL(supabaseUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
  } catch {
    throw new SupabaseServiceConfigurationError("invalid_url");
  }
  if (!secretKey) throw new SupabaseServiceConfigurationError("missing_private_key");
  // Credential-kind check only; parsing a legacy JWT does not authenticate it.
  let privateKey = /^sb_secret_\S+$/.test(secretKey);
  if (!privateKey) {
    try {
      const parts = secretKey.split(".");
      privateKey = parts.length === 3 && JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role === "service_role";
    } catch { /* Malformed or public credentials must fail closed. */ }
  }
  if (!privateKey) throw new SupabaseServiceConfigurationError("invalid_private_key");
  try {
    return createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  } catch {
    throw new SupabaseServiceConfigurationError("client_initialization_failed");
  }
}
