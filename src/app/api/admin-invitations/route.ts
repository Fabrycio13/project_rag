import { auth, clerkClient } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isValidInvitationEmail,
  normalizeInvitationEmail,
} from "@/lib/admin-invitation-acceptance";
import { getAdminInvitationSignUpUrl } from "@/lib/admin-invitation-redirect";
import { isSameOriginRequest } from "@/lib/same-origin-request";

function getStringField(value: unknown, field: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const fieldValue = Object.getOwnPropertyDescriptor(value, field)?.value;
  return typeof fieldValue === "string" ? fieldValue : null;
}

async function getActiveOwner() {
  const { userId } = await auth();
  if (!userId) {
    return { response: Response.json({ error: "Entre na sua conta para continuar." }, { status: 401 }) };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("platform_users")
    .select("role, status")
    .maybeSingle();

  if (error) {
    return { response: Response.json({ error: "Não foi possível validar seu acesso." }, { status: 503 }) };
  }

  if (data?.role !== "owner" || data.status !== "active") {
    return { response: Response.json({ error: "Somente o owner ativo pode gerenciar convites." }, { status: 403 }) };
  }

  return { supabase, userId };
}

export async function POST(request: Request) {
  if (
    !isSameOriginRequest(
      request.headers.get("origin"),
      request.headers.get("host"),
      request.headers.get("x-forwarded-host"),
      request.headers.get("x-forwarded-proto"),
      request.url,
    )
  ) {
    return Response.json({ error: "Solicitação inválida." }, { status: 403 });
  }

  const owner = await getActiveOwner();
  if ("response" in owner) return owner.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }

  const email = getStringField(body, "email");
  if (!email || !isValidInvitationEmail(email)) {
    return Response.json({ error: "Informe um endereço de e-mail válido." }, { status: 400 });
  }

  const normalizedEmail = normalizeInvitationEmail(email);
  const signUpRedirectUrl = getAdminInvitationSignUpUrl(
    process.env.APP_BASE_URL ??
      (process.env.NODE_ENV === "development" ? "http://localhost:3000" : undefined),
    process.env.NODE_ENV === "development",
  );
  if (!signUpRedirectUrl) {
    return Response.json(
      {
        error:
          "O envio de convites está indisponível. Avise o responsável pela plataforma para revisar o endereço de acesso.",
      },
      { status: 503 },
    );
  }

  const { data: invitationRef, error: createError } = await owner.supabase.rpc(
    "admin_invitation_create",
    { p_email_address: normalizedEmail },
  );

  if (createError || typeof invitationRef !== "string") {
    const isDuplicate = createError?.code === "23505";
    return Response.json(
      {
        error: isDuplicate
          ? "Já existe um convite pendente para esse e-mail."
          : "Não foi possível registrar o convite. Tente novamente.",
      },
      { status: isDuplicate ? 409 : 503 },
    );
  }

  let clerkInvitationId: string;
  try {
    const clerk = await clerkClient();
    const invitation = await clerk.invitations.createInvitation({
      emailAddress: normalizedEmail,
      expiresInDays: 30,
      ignoreExisting: false,
      notify: true,
      redirectUrl: signUpRedirectUrl,
      publicMetadata: {
        platformRole: "admin",
        invitationRef,
      },
    });
    clerkInvitationId = invitation.id;
  } catch {
    await owner.supabase.rpc("admin_invitation_mark_failed", {
      p_invitation_ref: invitationRef,
    });
    return Response.json(
      { error: "O Clerk não enviou o convite. Verifique se já existe uma conta ou convite para esse e-mail." },
      { status: 502 },
    );
  }

  const { error: sentError } = await owner.supabase.rpc("admin_invitation_mark_sent", {
    p_invitation_ref: invitationRef,
    p_clerk_invitation_id: clerkInvitationId,
  });

  if (sentError) {
    try {
      const clerk = await clerkClient();
      await clerk.invitations.revokeInvitation(clerkInvitationId);
    } catch {
      // Keep the original registration error; the invitation is not exposed to the client.
    }
    await owner.supabase.rpc("admin_invitation_mark_failed", {
      p_invitation_ref: invitationRef,
    });
    return Response.json(
      { error: "O convite foi enviado, mas não conseguimos registrar o envio. Tente novamente ou verifique a lista." },
      { status: 503 },
    );
  }

  return Response.json(
    { message: "Convite enviado. A pessoa receberá um link válido por 30 dias." },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  if (
    !isSameOriginRequest(
      request.headers.get("origin"),
      request.headers.get("host"),
      request.headers.get("x-forwarded-host"),
      request.headers.get("x-forwarded-proto"),
      request.url,
    )
  ) {
    return Response.json({ error: "Solicitação inválida." }, { status: 403 });
  }

  const owner = await getActiveOwner();
  if ("response" in owner) return owner.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Convite inválido." }, { status: 400 });
  }

  const invitationRef = getStringField(body, "invitationRef");
  if (!invitationRef) {
    return Response.json({ error: "Convite inválido." }, { status: 400 });
  }

  const { data: invitation, error: lookupError } = await owner.supabase
    .from("admin_invitations")
    .select("id, clerk_invitation_id, status")
    .eq("id", invitationRef)
    .maybeSingle();

  if (lookupError) {
    return Response.json({ error: "Não foi possível consultar o convite." }, { status: 503 });
  }
  if (!invitation) {
    return Response.json({ error: "Convite não encontrado." }, { status: 404 });
  }
  if (invitation.status !== "pending" || !invitation.clerk_invitation_id) {
    return Response.json({ error: "Este convite não está mais pendente." }, { status: 409 });
  }

  try {
    const clerk = await clerkClient();
    await clerk.invitations.revokeInvitation(invitation.clerk_invitation_id);
  } catch {
    return Response.json({ error: "Não foi possível cancelar o convite no Clerk." }, { status: 502 });
  }

  const { data: revoked, error: revokeError } = await owner.supabase.rpc(
    "admin_invitation_revoke",
    { p_invitation_ref: invitationRef },
  );

  if (revokeError || revoked !== true) {
    return Response.json({ error: "O convite foi invalidado, mas não conseguimos atualizar o registro." }, { status: 503 });
  }

  return Response.json({ message: "Convite cancelado." });
}
